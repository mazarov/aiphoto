import type { PricingPaywallVariant } from "./pricing-paywall-attribution";

export const PRICING_PLAN_IDS = ["trial", "start", "pro", "max"] as const;

export type PricingPlanId = (typeof PRICING_PLAN_IDS)[number];

export type PricingPlan = {
  id: PricingPlanId;
  name: string;
  tagline: string;
  price: number;
  credits: number;
  badge?: string;
  discount?: number;
  recommended?: boolean;
  ctaLabel: string;
};

export const DEFAULT_PRICING_PLAN_ID: PricingPlanId = "start";
export const CONTROL_DEFAULT_PRICING_PLAN_ID: PricingPlanId = "max";
export const BASE_IMAGE_CREDITS = 5;
export const PREMIUM_IMAGE_CREDITS = 10;

export function getPricingPlanPhotoEconomics(
  plan: Pick<PricingPlan, "credits" | "price">,
): {
  minPhotos: number;
  maxPhotos: number;
  fromRubPerPhoto: number;
} {
  const minPhotos = Math.floor(plan.credits / PREMIUM_IMAGE_CREDITS);
  const maxPhotos = Math.floor(plan.credits / BASE_IMAGE_CREDITS);
  return {
    minPhotos,
    maxPhotos,
    fromRubPerPhoto: Math.ceil(plan.price / maxPhotos),
  };
}

export const CONTROL_PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: "pro",
    name: "Про",
    tagline: "Для частых генераций",
    price: 899,
    credits: 700,
    discount: 55,
    ctaLabel: "Купить пакет",
  },
  {
    id: "trial",
    name: "Проба",
    tagline: "Чтобы попробовать PromptShot",
    price: 199,
    credits: 70,
    ctaLabel: "Попробовать",
  },
  {
    id: "start",
    name: "Старт",
    tagline: "Для личных идей",
    price: 399,
    credits: 175,
    discount: 20,
    ctaLabel: "Купить пакет",
  },
  {
    id: "max",
    name: "Максимум",
    tagline: "Максимум выгоды",
    price: 1499,
    credits: 1550,
    discount: 66,
    badge: "Выгодно",
    recommended: true,
    ctaLabel: "Купить пакет",
  },
];

export const TREATMENT_PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: "pro",
    name: "Большой",
    tagline: "Для частых фотосессий",
    price: 469,
    credits: 200,
    ctaLabel: "Получить 200 токенов",
  },
  {
    id: "trial",
    name: "Пробный",
    tagline: "Чтобы попробовать PromptShot",
    price: 99,
    credits: 30,
    ctaLabel: "Получить 30 токенов",
  },
  {
    id: "start",
    name: "Оптимальный",
    tagline: "Для личных идей",
    price: 299,
    credits: 100,
    recommended: true,
    ctaLabel: "Получить 100 токенов",
  },
  {
    id: "max",
    name: "Максимум",
    tagline: "Максимум выгоды",
    price: 990,
    credits: 500,
    badge: "Выгодно",
    ctaLabel: "Получить 500 токенов",
  },
];

/** Backwards-compatible alias: callers without an experiment variant use the new offer. */
export const PRICING_PLANS = TREATMENT_PRICING_PLANS;

const PRICING_PLAN_BY_VARIANT = {
  control: new Map(CONTROL_PRICING_PLANS.map((plan) => [plan.id, plan])),
  treatment: new Map(TREATMENT_PRICING_PLANS.map((plan) => [plan.id, plan])),
} satisfies Record<PricingPaywallVariant, Map<PricingPlanId, PricingPlan>>;

export function getPricingPlans(
  variant: PricingPaywallVariant,
): readonly PricingPlan[] {
  return variant === "control"
    ? CONTROL_PRICING_PLANS
    : TREATMENT_PRICING_PLANS;
}

/**
 * Mobile swipe order: a higher-priced pack first, then the cheapest,
 * then the remaining catalog order. Checkout still keys plans by id.
 */
export function getPricingPlansByAscendingPrice(
  plans: readonly PricingPlan[],
): PricingPlan[] {
  return [...plans].sort((a, b) => a.price - b.price || a.credits - b.credits);
}

export function getPaywallSwipePlans(
  plans: readonly PricingPlan[],
): PricingPlan[] {
  if (plans.length < 2) return [...plans];
  const cheapest = plans.reduce((lead, plan) =>
    plan.price < lead.price ? plan : lead,
  );
  const expensiveLead =
    plans.find((plan) => plan.id !== cheapest.id) ?? cheapest;
  return [
    expensiveLead,
    cheapest,
    ...plans.filter(
      (plan) => plan.id !== expensiveLead.id && plan.id !== cheapest.id,
    ),
  ];
}

export function getDefaultPricingPlanId(
  variant: PricingPaywallVariant,
): PricingPlanId {
  return variant === "control"
    ? CONTROL_DEFAULT_PRICING_PLAN_ID
    : DEFAULT_PRICING_PLAN_ID;
}

export function getPricingPlan(
  planId: unknown,
  variant: PricingPaywallVariant = "treatment",
): PricingPlan | null {
  if (typeof planId !== "string") return null;
  return (
    PRICING_PLAN_BY_VARIANT[variant].get(planId as PricingPlanId) ?? null
  );
}
