"use client";

import { getAiImageDescriberChromeUrl } from "@/lib/foto-v-promt-config";
import { FOTO_V_PROMT_CTA } from "@/lib/foto-v-promt-copy";
import { ChromeMark } from "./ChromeMark";
import { FVP_FOCUS_RING, FVP_SECTION_CONTAINER } from "./foto-v-promt-tokens";

export function FotoVPromtFloatingCta() {
  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[60] lg:left-60 lg:right-0">
      <div
        className={`${FVP_SECTION_CONTAINER} pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:pb-[max(2rem,env(safe-area-inset-bottom))]`}
      >
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
    </div>
  );
}
