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
  STICKER_TEXT_MAX_CHARS,
  buildStickerTextPromptText,
  isStickerEditKind,
  normalizeStickerOverlayText,
} from "@/lib/sticker";
import { addTextToStickerPng, type StickerTextPosition } from "@/lib/sticker-text-overlay";

const MAX_SOURCE_MB = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ParentRow = {
  id: string;
  user_id: string;
  requester_auth_user_id: string | null;
  status: string;
  modality: string | null;
  edit_kind: string | null;
  model: string;
  executed_model: string | null;
  aspect_ratio: string;
  image_size: string;
  client_source: string | null;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
};

/**
 * «Добавить текст» — free, synchronous. Takes a finished sticker PNG, composites a caption badge,
 * stores the result as a new completed `landing_generations` row (0 credits, parent = source sticker).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  noteMemoryRoute("generation.sticker-text");
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "validation_error", message: "Некорректный стикер" }, { status: 400 });
    }
    const body = (await req.json().catch(() => ({}))) as { text?: unknown; position?: unknown };
    const text = normalizeStickerOverlayText(body.text);
    if (!text) {
      return NextResponse.json(
        { error: "validation_error", message: `Введите текст до ${STICKER_TEXT_MAX_CHARS} символов` },
        { status: 400 },
      );
    }
    const position: StickerTextPosition = body.position === "top" ? "top" : "bottom";

    const supabase = createSupabaseServer();
    const { data: parentRaw, error: parentError } = await supabase
      .from("landing_generations")
      .select(
        "id,user_id,requester_auth_user_id,status,modality,edit_kind,model,executed_model,aspect_ratio,image_size,client_source,result_storage_bucket,result_storage_path",
      )
      .eq("id", id)
      .eq("requester_auth_user_id", user.id)
      .maybeSingle();
    if (parentError) {
      console.error("[sticker-text] parent lookup failed", { id, error: parentError.message });
      return NextResponse.json({ error: "parent_lookup_failed" }, { status: 500 });
    }
    const parent = parentRaw as ParentRow | null;
    if (!parent) {
      return NextResponse.json({ error: "forbidden", message: "Стикер недоступен" }, { status: 403 });
    }
    if (
      parent.status !== "completed" ||
      !parent.result_storage_bucket ||
      !parent.result_storage_path ||
      (parent.modality || "image") !== "image" ||
      !isStickerEditKind(parent.edit_kind)
    ) {
      return NextResponse.json(
        { error: "sticker_parent_not_sticker", message: "Текст добавляется на готовый стикер" },
        { status: 400 },
      );
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(parent.result_storage_bucket)
      .download(parent.result_storage_path);
    if (downloadError || !file) {
      console.error("[sticker-text] source download failed", { id, error: downloadError?.message });
      return NextResponse.json({ error: "source_unavailable", message: "Исходный стикер недоступен" }, { status: 409 });
    }
    const source = Buffer.from(await readBlobBytes(file, MAX_SOURCE_MB * 1024 * 1024));

    let output: Buffer;
    try {
      output = await runSharpLimited(() => addTextToStickerPng(source, text, position));
    } catch (err) {
      if (isSharpBusyError(err)) {
        return NextResponse.json({ error: "busy", message: "Сервер занят, попробуйте ещё раз" }, { status: 503 });
      }
      throw err;
    }

    const newId = crypto.randomUUID();
    const resultPath = `${parent.user_id}/${newId}/text.png`;
    const { error: uploadError } = await supabase.storage
      .from(parent.result_storage_bucket)
      .upload(resultPath, output, publicObjectUploadOptions({ contentType: "image/png", upsert: false }));
    if (uploadError) {
      console.error("[sticker-text] upload failed", { id, error: uploadError.message });
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }

    const acquisition = readAcquisitionRequestIds(req);
    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from("landing_generations").insert({
      id: newId,
      user_id: parent.user_id,
      requester_auth_user_id: parent.requester_auth_user_id ?? user.id,
      status: "completed",
      prompt_text: buildStickerTextPromptText(text),
      model: parent.model,
      executed_model: parent.executed_model,
      aspect_ratio: parent.aspect_ratio,
      image_size: parent.image_size,
      credits_spent: 0,
      input_photo_paths: [],
      client_source: parent.client_source,
      create_ugc: false,
      parent_generation_id: parent.id,
      edit_instruction: text,
      edit_kind: STICKER_EDIT_KIND,
      modality: "image",
      visitor_id: acquisition.visitorId,
      session_id: acquisition.sessionId,
      result_storage_bucket: parent.result_storage_bucket,
      result_storage_path: resultPath,
      generation_started_at: now,
      generation_completed_at: now,
    });
    if (insertError) {
      console.error("[sticker-text] insert failed", { id, newId, error: insertError.message });
      await supabase.storage.from(parent.result_storage_bucket).remove([resultPath]).catch(() => {});
      return NextResponse.json({ error: "insert_failed" }, { status: 500 });
    }

    console.log("[sticker-text] created", { parentId: parent.id, id: newId, textLength: text.length, position });
    return NextResponse.json({
      id: newId,
      parentGenerationId: parent.id,
      editKind: STICKER_EDIT_KIND,
      resultUrl: getStoragePublicUrl(parent.result_storage_bucket, resultPath),
    });
  } catch (err) {
    console.error("[sticker-text] failed", err);
    return NextResponse.json({ error: "sticker_text_failed" }, { status: 500 });
  }
}
