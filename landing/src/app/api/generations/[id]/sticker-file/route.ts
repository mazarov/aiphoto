import { NextRequest, NextResponse } from "next/server";
import { noteMemoryRoute } from "@/lib/runtime-memory";
import { readBlobBytes } from "@/lib/request-byte-limit";
import { isSharpBusyError, runSharpLimited } from "@/lib/sharp-runtime";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { isStickerEditKind, stickerPlatformById } from "@/lib/sticker";
import { exportStickerForPlatform } from "@/lib/sticker-export";

const MAX_SOURCE_MB = 8;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type StickerRow = {
  id: string;
  status: string;
  modality: string | null;
  edit_kind: string | null;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
};

/**
 * Ready-to-upload sticker file for a messenger: `?platform=telegram|whatsapp|max`.
 * Owner-only. Converts the stored 512×512 PNG into the platform's format/size on the fly —
 * nothing extra is stored, so adding a platform is one entry in `STICKER_PLATFORMS`.
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
      .select("id,status,modality,edit_kind,result_storage_bucket,result_storage_path")
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
    if (
      row.status !== "completed" ||
      !row.result_storage_bucket ||
      !row.result_storage_path ||
      (row.modality || "image") !== "image" ||
      !isStickerEditKind(row.edit_kind)
    ) {
      return NextResponse.json({ error: "not_a_sticker", message: "Файл доступен только для готового стикера" }, { status: 400 });
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from(row.result_storage_bucket)
      .download(row.result_storage_path);
    if (downloadError || !file) {
      console.error("[sticker-file] source download failed", { id, error: downloadError?.message });
      return NextResponse.json({ error: "source_unavailable", message: "Исходный стикер недоступен" }, { status: 409 });
    }
    const source = Buffer.from(await readBlobBytes(file, MAX_SOURCE_MB * 1024 * 1024));

    let exported;
    try {
      exported = await runSharpLimited(() => exportStickerForPlatform(source, platform));
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

    return new NextResponse(new Uint8Array(exported.buffer), {
      status: 200,
      headers: {
        "Content-Type": exported.contentType,
        "Content-Length": String(exported.buffer.length),
        "Content-Disposition": `attachment; filename="${platform.filename}"`,
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
