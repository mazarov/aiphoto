import { NextRequest, NextResponse } from "next/server";
import { noteMemoryRoute } from "@/lib/runtime-memory";
import { readBlobBytes } from "@/lib/request-byte-limit";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { STICKER_PACK_COUNT, stickerPackTileFilename, stickerPackTilePathsForJob, isStickerPackEditKind } from "@/lib/sticker-pack";
import { buildStoreZip } from "@/lib/zip-store";

/** One 378-px sticker PNG is ~100–300 KB; the cap is per file, the sum stays far below the route budget. */
const MAX_TILE_MB = 4;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PackRow = {
  id: string;
  status: string;
  modality: string | null;
  edit_kind: string | null;
  result_storage_bucket: string | null;
  result_storage_path: string | null;
  photoshoot_tile_paths: unknown;
  generation_completed_at: string | null;
};

/**
 * All 16 stickers of a finished pack as one ZIP (`sticker-01.png` … `sticker-16.png`).
 * Owner-only; built in memory from the stored tiles (STORE method — PNGs are already compressed),
 * nothing is persisted. One click instead of sixteen browser downloads.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  noteMemoryRoute("generation.sticker-pack-zip");
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: "validation_error", message: "Некорректный стикер пак" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const { data: rowRaw, error: rowError } = await supabase
      .from("landing_generations")
      .select("id,status,modality,edit_kind,result_storage_bucket,result_storage_path,photoshoot_tile_paths,generation_completed_at")
      .eq("id", id)
      .eq("requester_auth_user_id", user.id)
      .maybeSingle();
    if (rowError) {
      console.error("[sticker-pack-zip] lookup failed", { id, error: rowError.message });
      return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
    }
    const row = rowRaw as PackRow | null;
    if (!row) {
      return NextResponse.json({ error: "forbidden", message: "Стикер пак недоступен" }, { status: 403 });
    }
    if (
      row.status !== "completed" ||
      !row.result_storage_bucket ||
      (row.modality || "image") !== "image" ||
      !isStickerPackEditKind(row.edit_kind)
    ) {
      return NextResponse.json({ error: "not_a_sticker_pack", message: "Архив доступен только для готового стикер пака" }, { status: 400 });
    }
    const tilePaths = stickerPackTilePathsForJob({
      tilePaths: row.photoshoot_tile_paths,
      previewPath: row.result_storage_path,
    });
    if (!tilePaths || tilePaths.length !== STICKER_PACK_COUNT) {
      return NextResponse.json({ error: "tiles_unavailable", message: "Стикеры пака ещё не готовы" }, { status: 409 });
    }

    const bucket = row.result_storage_bucket;
    const mtime = row.generation_completed_at ? new Date(row.generation_completed_at) : new Date();
    const entries = await Promise.all(
      tilePaths.map(async (path, index) => {
        const { data: file, error: downloadError } = await supabase.storage.from(bucket).download(path);
        if (downloadError || !file) {
          throw new Error(`tile ${index + 1} unavailable: ${downloadError?.message ?? "empty"}`);
        }
        const data = await readBlobBytes(file, MAX_TILE_MB * 1024 * 1024);
        return { name: stickerPackTileFilename(index + 1), data, mtime };
      }),
    ).catch((err: unknown) => {
      console.error("[sticker-pack-zip] tile download failed", { id, error: err instanceof Error ? err.message : err });
      return null;
    });
    if (!entries) {
      return NextResponse.json({ error: "source_unavailable", message: "Часть стикеров пака недоступна" }, { status: 409 });
    }

    const zip = buildStoreZip(entries);
    return new NextResponse(zip, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.length),
        "Content-Disposition": `attachment; filename="promptshot-stickers-${row.id}.zip"`,
        "Cache-Control": "private, max-age=3600",
        "X-Sticker-Pack-Count": String(entries.length),
      },
    });
  } catch (err) {
    console.error("[sticker-pack-zip] unexpected error", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
