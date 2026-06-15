/** RU copy for Foto-v-promt promo mini banner (listing vs card). */

export const FOTO_V_PROMT_BANNER_PATH = "https://promptshot.ru/foto-v-promt";

export const FOTO_V_PROMT_BANNER_COPY = {
  title: "Промт не попадает в фото?",
  cta: "Промт по фото",
  listing: {
    subtitle: "Загрузи референс и получи промт под кадр",
  },
  card: {
    subtitle: "Загрузи фото и получи промт под свой референс",
  },
} as const;

export type FotoVPromtBannerPlacement = "listing" | "card";
