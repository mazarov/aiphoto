export type PricingPlan = {
  id: "basic" | "standard" | "pro" | "ultimate";
  name: string;
  level: string;
  price: number;
  credits: number;
  photos: number;
  videos: number;
  discount?: number;
  recommended?: boolean;
  features: Array<{
    label: string;
    included: boolean;
  }>;
};

const CORE_FEATURES = [
  "Генерация фото",
  "Генерация видео",
  "Готовые идеи",
] as const;

const ADVANCED_FEATURES = [
  "ИИ-инструменты",
  "Приоритетная обработка",
  "Мультигенерация",
] as const;

function features(advanced: boolean): PricingPlan["features"] {
  return [
    ...CORE_FEATURES.map((label) => ({ label, included: true })),
    ...ADVANCED_FEATURES.map((label) => ({ label, included: advanced })),
  ];
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "basic",
    name: "Basic",
    level: "Новичок",
    price: 199,
    credits: 70,
    photos: 14,
    videos: 2,
    features: features(false),
  },
  {
    id: "standard",
    name: "Standard",
    level: "Базовый",
    price: 399,
    credits: 175,
    photos: 35,
    videos: 5,
    discount: 20,
    features: features(false),
  },
  {
    id: "pro",
    name: "Pro",
    level: "Стандарт",
    price: 899,
    credits: 700,
    photos: 140,
    videos: 15,
    discount: 55,
    features: features(false),
  },
  {
    id: "ultimate",
    name: "Ultimate",
    level: "Продвинутый",
    price: 1499,
    credits: 1550,
    photos: 310,
    videos: 35,
    discount: 66,
    recommended: true,
    features: features(true),
  },
];
