import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";
import { isStvOpenGenerateDebugEnabled } from "@/lib/stv-open-generate-debug";
import {
  toUserGenerationPhotos,
  USER_GENERATION_PHOTOS_BUCKET,
  type UserGenerationPhoto,
  type UserGenerationPhotoRow,
} from "@/lib/user-generation-photos";
import sharp from "sharp";

const MAX_SIZE_MB = 10;
const MAX_PX = 2048;
const JPEG_QUALITY = 85;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);

    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const openDebug = isStvOpenGenerateDebugEnabled(user.email);
    const pipelineTrace = getStvPipelineTrace(req);
    const supabase = createSupabaseServer();
    const storageUserId = user.id;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const saveToLibrary = formData.get("saveToLibrary") === "true";
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG or WebP" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const sizeMb = bytes.byteLength / (1024 * 1024);
    if (sizeMb > MAX_SIZE_MB) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(bytes);
    const resized = await sharp(buffer)
      .resize(MAX_PX, MAX_PX, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true });

    const timestamp = Math.floor(Date.now() / 1000);
    const ext = "jpg";
    const path = `${storageUserId}/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(USER_GENERATION_PHOTOS_BUCKET)
      .upload(path, resized.data, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("upload-generation-photo storage error:", uploadError);
      return NextResponse.json(
        { error: "Upload failed: " + uploadError.message },
        { status: 500 }
      );
    }

    let photo: UserGenerationPhoto | null = null;
    if (saveToLibrary) {
      const originalFilename = file.name.trim().slice(0, 255) || null;
      const { data: photoRow, error: libraryError } = await supabase
        .from("landing_user_photos")
        .insert({
          auth_user_id: storageUserId,
          storage_path: path,
          original_filename: originalFilename,
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
        console.error("upload-generation-photo library error:", libraryError?.message);
        return NextResponse.json({ error: "Photo library save failed" }, { status: 500 });
      }

      [photo] = await toUserGenerationPhotos(supabase, [
        photoRow as UserGenerationPhotoRow,
      ]);
    }

    stvLog("upload.reference_ok", {
      pipelineTrace,
      userId: storageUserId,
      openDebug,
      storagePath: path,
      bytesOut: resized.data.length,
    });

    return NextResponse.json({ storagePath: path, ...(photo ? { photo } : {}) });
  } catch (err) {
    console.error("upload-generation-photo error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
