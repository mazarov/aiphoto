"use client";

import Link from "next/link";
import {
  FOTO_V_PROMT_BANNER_COPY,
  FOTO_V_PROMT_BANNER_PATH,
  type FotoVPromtBannerPlacement,
} from "@/lib/foto-v-promt-banner-copy";
import { trackFotoVPromtBannerClick } from "@/lib/foto-v-promt-banner-metrics";
import { FVP_FOCUS_RING } from "@/components/foto-v-promt/foto-v-promt-tokens";
import { LISTING_MOBILE_CHROME_INSET } from "@/lib/listing-shell-surface";

/** Solid gradient — listing bar and card sticky bar (white bg behind). */
const GRADIENT_SOLID =
  "bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-indigo-500/25 ring-1 ring-inset ring-white/20 transition-[background,box-shadow,transform] hover:shadow-indigo-500/35";

/** Glass gradient — sits over a photo (mobile immersive). */
const GRADIENT_GLASS =
  "bg-indigo-600/80 backdrop-blur-md ring-1 ring-inset ring-white/20 shadow-lg shadow-black/20 transition-[background,box-shadow,transform] hover:bg-indigo-600/90";

const TEXT = {
  title: "text-sm font-semibold leading-snug text-white antialiased",
  subtitle: "text-xs font-medium leading-snug text-white/80 antialiased",
  icon: "h-5 w-5 shrink-0 text-white",
  ctaButton:
    "foto-v-promt-mini-banner__cta shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm antialiased transition-colors hover:bg-indigo-50",
  ctaButtonGlass:
    "foto-v-promt-mini-banner__cta shrink-0 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white shadow-sm antialiased ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/30",
} as const;

export type FotoVPromtMiniBannerVariant = "listing" | "card" | "cardImmersive";

type Props = {
  variant: FotoVPromtMiniBannerVariant;
  className?: string;
};

function GeneratePhotoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M7 15l3-3 2 2 4-5" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M17 3l1.5 3 3 1.5-3 1.5L17 12l-1.5-3-3-1.5 3-1.5L17 3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function placementFromVariant(variant: FotoVPromtMiniBannerVariant): FotoVPromtBannerPlacement {
  return variant === "listing" ? "listing" : "card";
}

type VariantConfig = {
  shell: string;
  ctaButton: string;
};

const VARIANT: Record<FotoVPromtMiniBannerVariant, VariantConfig> = {
  listing: {
    shell: `${GRADIENT_SOLID} ${LISTING_MOBILE_CHROME_INSET} rounded-b-xl rounded-t-none`,
    ctaButton: TEXT.ctaButton,
  },
  card: {
    shell: `${GRADIENT_SOLID} rounded-xl px-3 sm:px-4`,
    ctaButton: TEXT.ctaButton,
  },
  cardImmersive: {
    shell: `${GRADIENT_GLASS} rounded-xl px-3 sm:px-4`,
    ctaButton: TEXT.ctaButtonGlass,
  },
};

export function FotoVPromtMiniBanner({ variant, className = "" }: Props) {
  const placement = placementFromVariant(variant);
  const copy = FOTO_V_PROMT_BANNER_COPY.listing;
  const { shell, ctaButton } = VARIANT[variant];

  return (
    <Link
      href={FOTO_V_PROMT_BANNER_PATH}
      target="_blank"
      rel="noopener noreferrer"
      prefetch={false}
      onClick={() => trackFotoVPromtBannerClick(placement)}
      className={`foto-v-promt-mini-banner font-inherit ${shell} ${FVP_FOCUS_RING} ${className}`}
      role="complementary"
      aria-label="Получить промт по фото — открыть PromptShot в новой вкладке"
    >
      <span className="foto-v-promt-mini-banner__icon" aria-hidden>
        <GeneratePhotoIcon className={TEXT.icon} />
      </span>
      <span className="foto-v-promt-mini-banner__text">
        <span className={`foto-v-promt-mini-banner__title ${TEXT.title}`}>
          {FOTO_V_PROMT_BANNER_COPY.title}
        </span>
        <span className={`foto-v-promt-mini-banner__subtitle ${TEXT.subtitle}`}>
          {copy.subtitle}
        </span>
      </span>
      <span className={ctaButton}>
        {FOTO_V_PROMT_BANNER_COPY.cta}
      </span>
    </Link>
  );
}
