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
  LISTING_NAV_SHELL_SURFACE,
  LISTING_SEARCH_FIELD_SURFACE,
} from "@/lib/listing-shell-surface";

/** Card sticky bar — same fill as catalog search field. */
const CARD_PROMO_SURFACE = `${LISTING_SEARCH_FIELD_SURFACE} transition-[background,box-shadow] hover:bg-white/90`;

const LIGHT_PROMO_TEXT = {
  title: "text-sm font-semibold leading-snug text-zinc-950 antialiased",
  subtitle: "text-xs font-medium leading-snug text-zinc-800 antialiased",
  icon: "h-5 w-5 shrink-0 text-indigo-700",
  ctaButton:
    "shrink-0 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white antialiased",
} as const;

export type FotoVPromtMiniBannerVariant = "listing" | "card" | "cardImmersive";

type Props = {
  variant: FotoVPromtMiniBannerVariant;
  className?: string;
};

function ImageToPromptIcon({ className }: { className?: string }) {
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
      <path d="M14 5v-2h7v7h-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function placementFromVariant(variant: FotoVPromtMiniBannerVariant): FotoVPromtBannerPlacement {
  return variant === "listing" ? "listing" : "card";
}

const SKIN: Record<
  FotoVPromtMiniBannerVariant,
  { shell: string; title: string; subtitle: string; ctaButton: string; icon: string }
> = {
  listing: {
    shell: `flex w-full font-inherit ${LISTING_NAV_SHELL_SURFACE} min-h-11 items-center gap-3 rounded-b-xl rounded-t-none px-3 py-2.5 transition-[background] hover:bg-white/90 sm:min-h-[3.25rem] sm:px-4`,
    ...LIGHT_PROMO_TEXT,
  },
  card: {
    shell: `flex w-full font-inherit ${CARD_PROMO_SURFACE} min-h-12 items-center gap-2.5 rounded-xl px-3 py-2 sm:gap-3 sm:px-4`,
    ...LIGHT_PROMO_TEXT,
    subtitle: `${LIGHT_PROMO_TEXT.subtitle} min-w-0 flex-1 sm:truncate`,
  },
  cardImmersive: {
    shell:
      "flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-black/25 px-3 py-2 backdrop-blur-md transition-colors hover:bg-black/32 sm:gap-3 sm:px-4",
    title: "text-[13px] font-semibold leading-snug text-white antialiased",
    subtitle: "min-w-0 flex-1 truncate text-[11px] font-medium leading-snug text-white/85 antialiased",
    icon: "h-5 w-5 shrink-0 text-white",
    ctaButton:
      "shrink-0 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-semibold text-white antialiased",
  },
};

export function FotoVPromtMiniBanner({ variant, className = "" }: Props) {
  const placement = placementFromVariant(variant);
  const copy =
    placement === "listing" ? FOTO_V_PROMT_BANNER_COPY.listing : FOTO_V_PROMT_BANNER_COPY.card;
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
      aria-label="Инструмент Фото в промт — открыть страницу сервиса в новой вкладке"
    >
      <ImageToPromptIcon className={skin.icon} />
      <span className="min-w-0 flex-1">
        <span className={`block ${skin.title}`}>{FOTO_V_PROMT_BANNER_COPY.title}</span>
        <span className={`mt-0.5 block truncate ${skin.subtitle}`}>{copy.subtitle}</span>
      </span>
      <span className={skin.ctaButton}>{FOTO_V_PROMT_BANNER_COPY.cta}</span>
    </Link>
  );
}
