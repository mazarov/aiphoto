import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { loadStickerPackExamples } from "@/lib/sticker-pack-examples";

/** Pack grids the bot already published. Public, no user data; a new example shows up within 10 min. */
export async function GET() {
  try {
    const packs = await loadStickerPackExamples(createSupabaseServer());
    return NextResponse.json(
      {
        packs: packs.map((pack) => ({
          id: pack.id,
          name: pack.name,
          description: pack.description,
          stickerCount: pack.stickerCount,
          exampleUrl: pack.exampleUrl,
        })),
      },
      {
        headers: {
          "Cache-Control": packs.length
            ? "public, s-maxage=300, stale-while-revalidate=3600"
            : "public, s-maxage=30",
        },
      },
    );
  } catch (err) {
    console.error("[sticker-pack-examples] failed", err);
    return NextResponse.json({ error: "sticker_pack_examples_failed" }, { status: 500 });
  }
}
