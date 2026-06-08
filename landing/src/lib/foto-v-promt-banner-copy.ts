/** RU copy for LexyGPT promo mini banner (listing vs card). */

import { LEXYGPT_IMAGE_PLAYGROUND_URL } from "@/lib/lexygpt-generate";

export const FOTO_V_PROMT_BANNER_PATH = LEXYGPT_IMAGE_PLAYGROUND_URL;

export const FOTO_V_PROMT_BANNER_COPY = {
  title: "Сгенерировать аналог",
  cta: "Подробнее",
  listing: {
    subtitle: "Быстро и просто — фото по референсу за секунды",
  },
  card: {
    subtitle: "Похожее фото за пару кликов",
  },
} as const;

export type FotoVPromtBannerPlacement = "listing" | "card";
