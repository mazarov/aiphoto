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
    | "foto_v_promt_hero_cta"
    | "foto_v_promt_mobile_header_cta"
    | "foto_v_promt_floating_cta"
  >;
  variant: "hero" | "mobile" | "floating";
};

export function FotoVPromtChromeCta({
  placement,
  variant,
}: FotoVPromtChromeCtaProps) {
  const variantClass = {
    hero: "px-6 py-3 shadow-[0_8px_24px_rgba(99,102,241,0.25)]",
    mobile: "w-full px-4 py-2.5 shadow-[0_6px_20px_rgba(99,102,241,0.25)]",
    floating: "px-6 py-3 shadow-[0_8px_32px_rgba(99,102,241,0.35)]",
  }[variant];

  return (
    <a
      href={getAiImageDescriberChromeUrl(placement)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackFotoVPromtAddToChromeClick()}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-indigo-600 text-sm font-semibold text-white ring-1 ring-inset ring-indigo-500/20 transition hover:bg-indigo-700 ${variantClass} ${FVP_FOCUS_RING}`}
    >
      <ChromeMark className="h-5 w-5 shrink-0" />
      <span>{FOTO_V_PROMT_CTA.floatingLabel}</span>
    </a>
  );
}

export function FotoVPromtFloatingCta() {
  const [mounted, setMounted] = useState(false);
  const [widgetVisible, setWidgetVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const widget = document.getElementById("foto-v-promt-widget");
    if (!widget) return;

    const observer = new IntersectionObserver(
      ([entry]) => setWidgetVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(widget);
    return () => observer.disconnect();
  }, [mounted]);

  if (!mounted || widgetVisible) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 z-[50] floating-cta-above-mobile-tab-bar lg:left-60 lg:right-0">
      <div className={`${FVP_SECTION_CONTAINER} pt-4`}>
        <div className="flex justify-center">
          <div className="pointer-events-auto">
            <FotoVPromtChromeCta
              placement="foto_v_promt_floating_cta"
              variant="floating"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
