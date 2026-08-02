export type PricingPlan = {
  id: "basic" | "standard" | "pro" | "ultimate";
  name: string;
  level: string;
  price: number;
  credits: number;
  photos: number;
  discount?: number;
  recommended?: boolean;
};

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic",
    level: "Новичок",
    price: 199,
    credits: 70,
    photos: 14,
  },
  {
    id: "standard",
    name: "Standard",
    level: "Базовый",
    price: 399,
    credits: 175,
    photos: 35,
    discount: 20,
  },
  {
    id: "pro",
    name: "Pro",
    level: "Стандарт",
    price: 899,
    credits: 700,
    photos: 140,
    discount: 55,
  },
  {
    id: "ultimate",
    name: "Ultimate",
    level: "Продвинутый",
    price: 1499,
    credits: 1550,
    photos: 310,
    discount: 66,
    recommended: true,
  },
];
