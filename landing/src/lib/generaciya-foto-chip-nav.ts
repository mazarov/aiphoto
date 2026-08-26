import { GENERACIYA_FOTO_SEO } from "./generaciya-foto-seo-copy";
import {
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  getGeneraciyaFotoScenarioPath,
} from "./generaciya-foto-routes";

export const GENERACIYA_FOTO_HUB_PATH = "/generaciya-foto";

export type GeneraciyaFotoChipNavItem = {
  label: string;
  href: string;
  kind: "hub" | "scenario";
  active: boolean;
};

/** On a scenario page: hub chip first, then the 22 pages. On the hub: scenarios only. */
export function getGeneraciyaFotoChipNavigation(
  activeSlug: string | null = null
): GeneraciyaFotoChipNavItem[] {
  const scenarios = GENERACIYA_FOTO_SCENARIO_ROUTES.map((route) => ({
    label: route.label,
    href: getGeneraciyaFotoScenarioPath(route.slug),
    kind: "scenario" as const,
    active: route.slug === activeSlug,
  }));
  if (activeSlug == null) return scenarios;
  return [
    {
      label: GENERACIYA_FOTO_SEO.chipHubLabel,
      href: GENERACIYA_FOTO_HUB_PATH,
      kind: "hub",
      active: false,
    },
    ...scenarios,
  ];
}
