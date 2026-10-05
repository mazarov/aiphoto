import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { defaultStickerStyleId, loadStickerCatalog } from "@/lib/sticker-catalog-db";

/** Styles / emotions / motions for the sticker tool. Public, no user data; bot edits reach the site within 5 min. */
export async function GET() {
  try {
    const catalog = await loadStickerCatalog(createSupabaseServer());
    return NextResponse.json(
      {
        groups: catalog.groups,
        styles: catalog.styles.map((style) => ({
          id: style.id,
          label: style.label,
          hint: style.hint,
          prompt: style.prompt,
          groupId: style.groupId ?? null,
          emoji: style.emoji ?? null,
          description: style.description ?? null,
          isDefault: Boolean(style.isDefault),
        })),
        defaultStyleId: defaultStickerStyleId(catalog.styles),
        emotions: catalog.emotions,
        motions: catalog.motions,
        fromDb: catalog.fromDb,
      },
      {
        headers: {
          "Cache-Control": catalog.fromDb
            ? "public, s-maxage=300, stale-while-revalidate=3600"
            : "public, s-maxage=30",
        },
      },
    );
  } catch (err) {
    console.error("[sticker-catalog] failed", err);
    return NextResponse.json({ error: "sticker_catalog_failed" }, { status: 500 });
  }
}
