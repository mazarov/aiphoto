"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  getAiImageDescriberChromeUrl,
  type AiImageDescriberChromePlacement,
} from "@/lib/foto-v-promt-config";
import { FOTO_V_PROMT_CTA } from "@/lib/foto-v-promt-copy";
import { trackFotoVPromtAddToChromeClick } from "@/lib/yandex-metrika";
import { ChromeMark } from "./ChromeMark";
import { FVP_FOCUS_RING, FVP_SECTION_CONTAINER } from "./foto-v-promt-tokens";

type FotoVPromtChromeCtaProps = {
  placement: Extract<
    AiImageDescriberChromePlacement,
    "foto_v_promt_floating_cta" | "foto_v_promt_mobile_floating_cta"
  >;
};

export function FotoVPromtChromeCta({ placement }: FotoVPromtChromeCtaProps) {
  return (
    <a
      href={getAiImageDescriberChromeUrl(placement)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackFotoVPromtAddToChromeClick(placement)}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_36px_rgba(0,0,0,0.5)] ring-1 ring-inset ring-white/25 transition hover:bg-zinc-800 ${FVP_FOCUS_RING}`}
    >
      <ChromeMark className="h-5 w-5 shrink-0" />
      <span>{FOTO_V_PROMT_CTA.floatingLabel}</span>
    </a>
  );
}

export function FotoVPromtFloatingCta() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[50] hidden floating-cta-above-mobile-tab-bar lg:left-72 lg:right-0 lg:block">
      <div className={`${FVP_SECTION_CONTAINER} pt-4`}>
        <div className="flex justify-center">
          <div className="pointer-events-auto">
            <FotoVPromtChromeCta placement="foto_v_promt_floating_cta" />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
