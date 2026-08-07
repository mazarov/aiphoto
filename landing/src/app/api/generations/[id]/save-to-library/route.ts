import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { resolveSharedDbUserId } from "@/lib/resolve-db-user-id";
import { landingGenerationsOwnerOrFilter } from "@/lib/landing-generations-access";
import {
  toUserGenerationPhotos,
  USER_GENERATION_PHOTOS_BUCKET,
  type UserGenerationPhotoRow,
} from "@/lib/user-generation-photos";

const MAX_SIZE_MB = 10;
const MAX_PX = 2048;
const JPEG_QUALITY = 85;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabase = createSupabaseServer();
    const resolved = await resolveSharedDbUserId(supabase, user);
    const dbUserId = resolved?.dbUserId ?? user.id;
    const ownerFilter = landingGenerationsOwnerOrFilter(user.id, dbUserId);

    const { data: gen, error: fetchError } = await supabase
      .from("landing_generations")
      .select("id, status, result_storage_bucket, result_storage_path")
      .eq("id", id)
      .or(ownerFilter)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!gen) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (gen.status !== "completed" || !gen.result_storage_bucket || !gen.result_storage_path) {
      return NextResponse.json(
        { error: "Generation result is not available" },
        { status: 400 }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(gen.result_storage_bucket)
      .download(gen.result_storage_path);

    if (downloadError || !fileData) {
      console.error("save-to-library download error:", downloadError?.message);
      return NextResponse.json({ error: "Failed to read result" }, { status: 500 });
    }

    const bytes = Buffer.from(await fileData.arrayBuffer());
    const sizeMb = bytes.byteLength / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const resized = await sharp(bytes)
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true });

    const timestamp = Math.floor(Date.now() / 1000);
    const path = `${user.id}/${timestamp}_${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(USER_GENERATION_PHOTOS_BUCKET)
      .upload(path, resized.data, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("save-to-library upload error:", uploadError);
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    const { data: photoRow, error: libraryError } = await supabase
      .from("landing_user_photos")
      .insert({
        auth_user_id: user.id,
        storage_path: path,
        original_filename: `generation-${gen.id}.jpg`,
        byte_size: resized.data.length,
        width: resized.info.width,
        height: resized.info.height,
      })
      .select(
        "id,auth_user_id,storage_path,original_filename,byte_size,width,height,created_at"
      )
      .single();

    if (libraryError || !photoRow) {
      await supabase.storage.from(USER_GENERATION_PHOTOS_BUCKET).remove([path]);
      console.error("save-to-library library error:", libraryError?.message);
      return NextResponse.json({ error: "Photo library save failed" }, { status: 500 });
    }

    const [photo] = await toUserGenerationPhotos(supabase, [
      photoRow as UserGenerationPhotoRow,
    ]);

    return NextResponse.json({ photo, storagePath: path });
  } catch (err) {
    console.error("save-to-library error:", err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
