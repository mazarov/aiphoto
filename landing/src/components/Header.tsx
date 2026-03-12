import { fetchMenuCounts } from "@/lib/supabase";
import { getMenuRouteMap, applyCountsToMenu } from "@/lib/menu";
import { HeaderClient } from "./HeaderClient";

type Props = {
  /** Pre-computed counts (from homepage sections). Skips ~80 RPC calls when provided. */
  counts?: Record<string, number>;
};

export async function Header({ counts: precomputedCounts }: Props = {}) {
  const routeMap = getMenuRouteMap();
  const counts = precomputedCounts ?? await fetchMenuCounts(routeMap);
  const menuWithCounts = applyCountsToMenu(counts);

  return <HeaderClient menu={menuWithCounts} />;
}
