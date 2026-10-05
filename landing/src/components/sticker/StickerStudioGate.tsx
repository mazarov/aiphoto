"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { GF_BRAND_CTA, GF_EYEBROW, GF_H2, GF_LEAD } from "@/components/generate/generaciya-foto-ui";
import { StickerHeroCta } from "@/components/sticker/StickerHeroCta";
import { readCachedStickerEnabled, writeCachedStickerEnabled } from "@/lib/sticker-availability";
import { STIKER_IZ_FOTO_SEO } from "@/lib/stiker-iz-foto-seo-copy";

type Props = {
  /** `sticker_generation_enabled` as seen by the ISR render — the public (SEO) state. */
  enabled: boolean;
};

/**
 * The page is cached for everyone, so the server can only render the public flag.
 * Allowlisted internals (`isStickerUnlocked` in `/api/generation-config`) see the studio
 * after one client check — same gate the dock tile and `POST /api/generate` use.
 */
export function StickerStudioGate({ enabled }: Props) {
  const { user } = useAuth();
  // Starts from the server value so SSR and hydration match; the session cache / API upgrade it after mount.
  const [unlocked, setUnlocked] = useState<boolean>(enabled);

  useEffect(() => {
    if (enabled || unlocked) return;
    if (readCachedStickerEnabled() === true) {
      setUnlocked(true);
      return;
    }
    if (!user) return;
    let cancelled = false;
    void fetch("/api/generation-config?modality=image", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { stickerEnabled?: boolean } | null) => {
        if (cancelled || typeof data?.stickerEnabled !== "boolean") return;
        writeCachedStickerEnabled(data.stickerEnabled);
        if (data.stickerEnabled) setUnlocked(true);
      })
      .catch(() => {
        /* stay locked */
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, unlocked, user]);

  if (unlocked) {
    return (
      <>
        <h2 id="studio-heading" className={GF_H2}>
          {STIKER_IZ_FOTO_SEO.studioTitle}
        </h2>
        <StickerHeroCta />
      </>
    );
  }
  return (
    <>
      <p className={GF_EYEBROW}>Скоро</p>
      <h2 id="studio-heading" className={`mt-2 ${GF_H2}`}>
        {STIKER_IZ_FOTO_SEO.lockedTitle}
      </h2>
      <p className={GF_LEAD}>{STIKER_IZ_FOTO_SEO.lockedLead}</p>
      <a href={STIKER_IZ_FOTO_SEO.botUrl} target="_blank" rel="noopener noreferrer" className={`mt-5 ${GF_BRAND_CTA}`}>
        {STIKER_IZ_FOTO_SEO.lockedCta}
      </a>
    </>
  );
}
