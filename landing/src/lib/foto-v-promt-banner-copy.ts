/** RU copy for Foto-v-promt mini banner (listing vs card). */

export const FOTO_V_PROMT_BANNER_PATH = "/foto-v-promt";

export const FOTO_V_PROMT_BANNER_COPY = {
  title: "Фото в промт",
  cta: "Попробовать",
  listing: {
    subtitle: "Промпт из любого фото за секунды — без регистрации",
  },
  card: {
    subtitle: "Нужен промт с другого снимка? Загрузите фото",
  },
} as const;

export type FotoVPromtBannerPlacement = "listing" | "card";
