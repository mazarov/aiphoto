import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { getStvPipelineTrace, stvLog } from "@/lib/stv-pipeline-log";
import sharp from "sharp";

const BUCKET = "web-generation-uploads";
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

    const pipelineTrace = getStvPipelineTrace(req);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
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
      .toBuffer();

    const timestamp = Math.floor(Date.now() / 1000);
    const ext = "jpg";
    const path = `${user.id}/${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = createSupabaseServer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, resized, {
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

    stvLog("upload.reference_ok", {
      pipelineTrace,
      userId: user.id,
      storagePath: path,
      bytesOut: resized.length,
    });

    return NextResponse.json({ storagePath: path });
  } catch (err) {
    console.error("upload-generation-photo error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
