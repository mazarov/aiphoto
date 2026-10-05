import { NextRequest, NextResponse } from "next/server";
import { noteMemoryRoute } from "@/lib/runtime-memory";
import { readBlobBytes } from "@/lib/request-byte-limit";
import { isSharpBusyError, runSharpLimited } from "@/lib/sharp-runtime";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { parseStickerBorderPxFromPrompt, stickerPlatformById } from "@/lib/sticker";
import { exportStickerForPlatform } from "@/lib/sticker-export";
import { stickerPackTileFilename } from "@/lib/sticker-pack";
import {
  STICKER_SOURCE_ROW_COLUMNS,
  resolveStickerSourceFile,
  stickerSourceErrorCode,
  stickerSourceErrorMessage,
  type StickerSourceRow,
} from "@/lib/sticker-source-row";

const MAX_SOURCE_MB = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StickerRow = StickerSourceRow & {
  id: string;
  prompt_text: string | null;
};

/**
 * Ready-to-upload sticker file for a messenger: `?platform=telegram|whatsapp|max`.
 * Owner-only. Converts the stored PNG (512 single sticker, 378 pack tile) into the platform's
 * format/size on the fly — nothing extra is stored, so adding a platform is one entry in `STICKER_PLATFORMS`.
 * Sticker pack rows need `?tile=1..16`; the response is `sticker-NN.<ext>`.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  noteMemoryRoute("generation.sticker-file");
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "validation_error", message: "Некорректный стикер" }, { status: 400 });
    }
    const platform = stickerPlatformById(req.nextUrl.searchParams.get("platform"));
    if (!platform) {
      return NextResponse.json({ error: "validation_error", message: "Неизвестная платформа" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: rowRaw, error: rowError } = await supabase
      .from("landing_generations")
      .select(`id,prompt_text,${STICKER_SOURCE_ROW_COLUMNS}`)
      .eq("id", id)
      .eq("requester_auth_user_id", user.id)
      .maybeSingle();
    if (rowError) {
      console.error("[sticker-file] lookup failed", { id, error: rowError.message });
      return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
    const row = rowRaw as StickerRow | null;
    if (!row) {
      return NextResponse.json({ error: "forbidden", message: "Стикер недоступен" }, { status: 403 });
    }
    const src = resolveStickerSourceFile(row, req.nextUrl.searchParams.get("tile"));
    if (!src.ok) {
      return NextResponse.json(
        {
          error: stickerSourceErrorCode(src.reason),
          message: stickerSourceErrorMessage(src.reason, "Файл доступен только для готового стикера"),
        },
        { status: 400 },
      );
    }

    const { data: file, error: downloadError } = await supabase.storage.from(src.bucket).download(src.path);
    if (downloadError || !file) {
      console.error("[sticker-file] source download failed", { id, error: downloadError?.message });
      return NextResponse.json({ error: "source_unavailable", message: "Исходный стикер недоступен" }, { status: 409 });
    }
    const source = Buffer.from(await readBlobBytes(file, MAX_SOURCE_MB * 1024 * 1024));

    let exported;
    try {
      // Only a «Обводка» row gets its white ring snapped; a plain sticker keeps the soft edge the worker saved.
      const hasBorder = parseStickerBorderPxFromPrompt(row.prompt_text) !== null;
      exported = await runSharpLimited(() => exportStickerForPlatform(source, platform, { hasBorder }));
    } catch (err) {
      if (isSharpBusyError(err)) {
        return NextResponse.json({ error: "busy", message: "Сервер занят, попробуйте ещё раз" }, { status: 503 });
      }
      throw err;
    }
    if (exported.buffer.length > platform.maxBytes) {
      console.warn("[sticker-file] over platform limit after export", {
        id,
        platform: platform.id,
        bytes: exported.buffer.length,
        maxBytes: platform.maxBytes,
      });
    }

    const filename = src.tile
      ? stickerPackTileFilename(src.tile, platform.filename.split(".").pop() || "png")
      : platform.filename;
    return new NextResponse(new Uint8Array(exported.buffer), {
      status: 200,
      headers: {
        "Content-Type": exported.contentType,
        "Content-Length": String(exported.buffer.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Sticker-Platform": platform.id,
        "X-Sticker-Quality": exported.quality === null ? "lossless" : String(exported.quality),
      },
    });
  } catch (err) {
    console.error("[sticker-file] unexpected error", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
