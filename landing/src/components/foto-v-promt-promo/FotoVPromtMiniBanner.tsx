"use client";

import Link from "next/link";
import {
  FOTO_V_PROMT_BANNER_COPY,
  FOTO_V_PROMT_BANNER_PATH,
  type FotoVPromtBannerPlacement,
} from "@/lib/foto-v-promt-banner-copy";
import { trackFotoVPromtBannerClick } from "@/lib/foto-v-promt-banner-metrics";
import { FVP_FOCUS_RING } from "@/components/foto-v-promt/foto-v-promt-tokens";
import {
  LISTING_MOBILE_CHROME_INSET,
  LISTING_MOBILE_CHROME_LEADING_CELL,
} from "@/lib/listing-shell-surface";

const PROMO_GRADIENT_SURFACE =
  "bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 shadow-lg shadow-indigo-500/25 ring-1 ring-inset ring-white/20 transition-[background,box-shadow,transform] hover:shadow-indigo-500/35";

const LIGHT_PROMO_TEXT = {
  title: "text-sm font-semibold leading-snug text-white antialiased",
  subtitle: "text-xs font-medium leading-snug text-white/90 antialiased",
  icon: "h-5 w-5 shrink-0 text-white",
  ctaButton:
    "shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm antialiased transition-colors hover:bg-indigo-50",
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

const LISTING_GRID_SHELL = `grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 font-inherit ${PROMO_GRADIENT_SURFACE}`;

const SKIN: Record<
  FotoVPromtMiniBannerVariant,
  { shell: string; title: string; subtitle: string; ctaButton: string; icon: string }
> = {
  listing: {
    shell: `${LISTING_GRID_SHELL} ${LISTING_MOBILE_CHROME_INSET} min-h-11 rounded-b-xl rounded-t-none py-2.5 sm:min-h-[3.25rem]`,
    ...LIGHT_PROMO_TEXT,
  },
  card: {
    shell: `${LISTING_GRID_SHELL} min-h-11 rounded-xl px-3 py-2.5 sm:min-h-[3.25rem] sm:px-4`,
    ...LIGHT_PROMO_TEXT,
  },
  cardImmersive: {
    shell: `${LISTING_GRID_SHELL} min-h-11 rounded-xl px-3 py-2.5 sm:min-h-[3.25rem] sm:px-4`,
    ...LIGHT_PROMO_TEXT,
  },
};

export function FotoVPromtMiniBanner({ variant, className = "" }: Props) {
  const placement = placementFromVariant(variant);
  const copy = FOTO_V_PROMT_BANNER_COPY.listing;
  const skin = SKIN[variant];

  return (
    <Link
      href={FOTO_V_PROMT_BANNER_PATH}
      target="_blank"
      rel="noopener noreferrer"
      prefetch={false}
      onClick={() => trackFotoVPromtBannerClick(placement)}
      className={`${skin.shell} ${FVP_FOCUS_RING} ${className}`}
      role="complementary"
      aria-label="Получить промт по фото — открыть PromptShot в новой вкладке"
    >
      <span className={LISTING_MOBILE_CHROME_LEADING_CELL}>
        <GeneratePhotoIcon className={skin.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block ${skin.title}`}>{FOTO_V_PROMT_BANNER_COPY.title}</span>
        <span className={`mt-0.5 block truncate ${skin.subtitle}`}>{copy.subtitle}</span>
      </span>
      <span className={skin.ctaButton}>{FOTO_V_PROMT_BANNER_COPY.cta}</span>
    </Link>
  );
}
