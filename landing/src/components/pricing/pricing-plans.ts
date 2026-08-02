export type PricingPlan = {
  id: "trial" | "start" | "pro" | "max";
  name: string;
  tagline: string;
  price: number;
  credits: number;
  photos: number;
  discount?: number;
  recommended?: boolean;
  ctaLabel: string;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "trial",
    name: "Проба",
    tagline: "Чтобы попробовать PromptShot",
    price: 199,
    credits: 70,
    photos: 14,
    ctaLabel: "Попробовать",
  },
  {
    id: "start",
    name: "Старт",
    tagline: "Для личных идей",
    price: 399,
    credits: 175,
    photos: 35,
    discount: 20,
    ctaLabel: "Купить пакет",
  },
  {
    id: "pro",
    name: "Про",
    tagline: "Для частых генераций",
    price: 899,
    credits: 700,
    photos: 140,
    discount: 55,
    ctaLabel: "Купить пакет",
  },
  {
    id: "max",
    name: "Максимум",
    tagline: "Максимум выгоды",
    price: 1499,
    credits: 1550,
    photos: 310,
    discount: 66,
    recommended: true,
    ctaLabel: "Купить пакет",
  },
];
