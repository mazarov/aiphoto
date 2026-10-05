import { NextRequest, NextResponse } from "next/server";
import { noteMemoryRoute } from "@/lib/runtime-memory";
import { readBlobBytes } from "@/lib/request-byte-limit";
import { isSharpBusyError, runSharpLimited } from "@/lib/sharp-runtime";
import { createSupabaseServer, getStoragePublicUrl } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { readAcquisitionRequestIds } from "@/lib/acquisition-request";
import { publicObjectUploadOptions } from "@/lib/storage-cache-control";
import {
  STICKER_EDIT_KIND,
  buildStickerBorderPromptText,
  clampStickerBorderPx,
} from "@/lib/sticker";
import { addWhiteBorderToStickerPng } from "@/lib/sticker-border";
import {
  STICKER_SOURCE_ROW_COLUMNS,
  resolveStickerSourceFile,
  stickerSourceErrorCode,
  stickerSourceErrorMessage,
  type StickerSourceRow,
} from "@/lib/sticker-source-row";

const MAX_SOURCE_MB = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ParentRow = StickerSourceRow & {
  id: string;
  user_id: string;
  requester_auth_user_id: string | null;
  model: string;
  executed_model: string | null;
  aspect_ratio: string;
  image_size: string;
  client_source: string | null;
};

/**
 * «Обводка» — free, synchronous, same role as the bot's `toggle_border`.
 * Paints a white die-cut on a finished sticker and stores a new completed row (0 credits).
 * Body (optional JSON): `{ borderPx, tile }` — width on the 512 canvas, clamped to the shared bounds;
 * `tile` 1..16 picks the sticker when the parent is a sticker pack. The new row is a single sticker.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  noteMemoryRoute("generation.sticker-border");
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "validation_error", message: "Некорректный стикер" }, { status: 400 });
    }
    const body = (await req.json().catch(() => ({}))) as { borderPx?: unknown; tile?: unknown } | null;
    const borderPx = clampStickerBorderPx(body?.borderPx);

    const supabase = createSupabaseServer();
    const { data: parentRaw, error: parentError } = await supabase
      .from("landing_generations")
      .select(
        `id,user_id,requester_auth_user_id,model,executed_model,aspect_ratio,image_size,client_source,${STICKER_SOURCE_ROW_COLUMNS}`,
      )
      .eq("id", id)
      .eq("requester_auth_user_id", user.id)
      .maybeSingle();
    if (parentError) {
      console.error("[sticker-border] parent lookup failed", { id, error: parentError.message });
      return NextResponse.json({ error: "parent_lookup_failed" }, { status: 500 });
    }
    const parent = parentRaw as ParentRow | null;
    if (!parent) {
      return NextResponse.json({ error: "forbidden", message: "Стикер недоступен" }, { status: 403 });
    }
    const src = resolveStickerSourceFile(parent, body?.tile);
    if (!src.ok) {
      return NextResponse.json(
        {
          error: stickerSourceErrorCode(src.reason) === "pack_tile_required" ? "pack_tile_required" : "sticker_parent_not_sticker",
          message: stickerSourceErrorMessage(src.reason, "Обводка добавляется на готовый стикер"),
        },
        { status: 400 },
      );
    }

    const { data: file, error: downloadError } = await supabase.storage.from(src.bucket).download(src.path);
    if (downloadError || !file) {
      console.error("[sticker-border] source download failed", { id, tile: src.tile, error: downloadError?.message });
      return NextResponse.json({ error: "source_unavailable", message: "Исходный стикер недоступен" }, { status: 409 });
    }
    const source = Buffer.from(await readBlobBytes(file, MAX_SOURCE_MB * 1024 * 1024));

    let output: Buffer;
    try {
      output = await runSharpLimited(() => addWhiteBorderToStickerPng(source, borderPx));
    } catch (err) {
      if (isSharpBusyError(err)) {
        return NextResponse.json({ error: "busy", message: "Сервер занят, попробуйте ещё раз" }, { status: 503 });
      }
      throw err;
    }

    const newId = crypto.randomUUID();
    const resultPath = `${parent.user_id}/${newId}/border.png`;
    const { error: uploadError } = await supabase.storage
      .from(src.bucket)
      .upload(resultPath, output, publicObjectUploadOptions({ contentType: "image/png", upsert: false }));
    if (uploadError) {
      console.error("[sticker-border] upload failed", { id, error: uploadError.message });
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    const acquisition = readAcquisitionRequestIds(req);
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("landing_generations").insert({
      id: newId,
      user_id: parent.user_id,
      requester_auth_user_id: parent.requester_auth_user_id ?? user.id,
      status: "completed",
      prompt_text: buildStickerBorderPromptText(borderPx),
      model: parent.model,
      executed_model: parent.executed_model,
      aspect_ratio: parent.aspect_ratio,
      image_size: parent.image_size,
      credits_spent: 0,
      input_photo_paths: [],
      client_source: parent.client_source,
      create_ugc: false,
      parent_generation_id: parent.id,
      edit_instruction: "border",
      edit_kind: STICKER_EDIT_KIND,
      modality: "image",
      visitor_id: acquisition.visitorId,
      session_id: acquisition.sessionId,
      result_storage_bucket: src.bucket,
      result_storage_path: resultPath,
      generation_started_at: now,
      generation_completed_at: now,
    });
    if (insertError) {
      console.error("[sticker-border] insert failed", { id, newId, error: insertError.message });
      await supabase.storage.from(src.bucket).remove([resultPath]).catch(() => {});
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }

    console.log("[sticker-border] created", { parentId: parent.id, id: newId, borderPx, tile: src.tile });
    return NextResponse.json({
      id: newId,
      parentGenerationId: parent.id,
      editKind: STICKER_EDIT_KIND,
      borderPx,
      resultUrl: getStoragePublicUrl(src.bucket, resultPath),
    });
  } catch (err) {
    console.error("[sticker-border] failed", err);
    return NextResponse.json({ error: "sticker_border_failed" }, { status: 500 });
  }
}
