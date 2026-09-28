import { GENERACIYA_PO_FOTO_SEO } from "./generaciya-foto-seo-copy";
import {
  GENERACIYA_FOTO_SCENARIO_ROUTES,
  GENERACIYA_PO_FOTO_PATH,
  getGeneraciyaFotoScenarioPath,
} from "./generaciya-foto-routes";

/** Scenario chips return to the photo hub — the 22 children are «со своего снимка». */
export const GENERACIYA_FOTO_HUB_PATH = GENERACIYA_PO_FOTO_PATH;

export type GeneraciyaFotoChipNavItem = {
  label: string;
  href: string;
  kind: "hub" | "scenario";
  active: boolean;
  dimension?: string;
  value?: string;
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
    dimension: route.dimension,
    value: route.tagValue,
  }));
  if (activeSlug == null) return scenarios;
  return [
    {
      label: GENERACIYA_PO_FOTO_SEO.chipHubLabel,
      href: GENERACIYA_FOTO_HUB_PATH,
      kind: "hub",
      active: false,
    },
    ...scenarios,
  ];
}
