"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAiImageDescriberChromeUrl } from "@/lib/foto-v-promt-config";
import { FOTO_V_PROMT_CTA } from "@/lib/foto-v-promt-copy";
import { ChromeMark } from "./ChromeMark";
import { FVP_FOCUS_RING, FVP_SECTION_CONTAINER } from "./foto-v-promt-tokens";

export function FotoVPromtFloatingCta() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[50] floating-cta-above-mobile-tab-bar lg:left-60 lg:right-0">
      <div className={`${FVP_SECTION_CONTAINER} pt-4`}>
        <div className="flex justify-center">
          <a
            href={getAiImageDescriberChromeUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={`pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(99,102,241,0.35)] ring-1 ring-inset ring-indigo-500/20 transition hover:bg-indigo-700 ${FVP_FOCUS_RING}`}
          >
            <ChromeMark className="h-5 w-5 shrink-0" />
            <span>{FOTO_V_PROMT_CTA.floatingLabel}</span>
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
