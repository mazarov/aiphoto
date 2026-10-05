"use client";

import { useGenerateDock } from "@/context/GenerateDockContext";
import { GF_BRAND_CTA, GF_LEAD } from "@/components/generate/generaciya-foto-ui";
import { STICKER_GENERATE_CTA } from "@/lib/sticker";
import { STIKER_IZ_FOTO_SEO } from "@/lib/stiker-iz-foto-seo-copy";

export function StickerHeroCta() {
  const { seedSticker } = useGenerateDock();

  return (
    <>
      <p className={GF_LEAD}>{STIKER_IZ_FOTO_SEO.studioLead}</p>
      <button
        type="button"
        className={`mt-5 ${GF_BRAND_CTA}`}
        onClick={() => seedSticker({ entrySource: "hero" })}
      >
        {STICKER_GENERATE_CTA}
      </button>
    </>
  );
}
