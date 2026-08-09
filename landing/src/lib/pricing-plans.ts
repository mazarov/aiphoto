export const PRICING_PLAN_IDS = ["trial", "start", "pro", "max"] as const;

export type PricingPlanId = (typeof PRICING_PLAN_IDS)[number];

export type PricingPlan = {
  id: PricingPlanId;
  name: string;
  tagline: string;
  price: number;
  credits: number;
  photos: number;
  discount?: number;
  recommended?: boolean;
  ctaLabel: string;
};

export const PRICING_PLANS: readonly PricingPlan[] = [
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

const PRICING_PLAN_BY_ID = new Map(PRICING_PLANS.map((plan) => [plan.id, plan]));

export function getPricingPlan(planId: unknown): PricingPlan | null {
  if (typeof planId !== "string") return null;
  return PRICING_PLAN_BY_ID.get(planId as PricingPlanId) ?? null;
}
