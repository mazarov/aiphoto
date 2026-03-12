import { fetchMenuCounts } from "@/lib/supabase";
import { getMenuRouteMap, applyCountsToMenu } from "@/lib/menu";
import { HeaderClient } from "./HeaderClient";

export async function Header() {
  const routeMap = getMenuRouteMap();
  const counts = await fetchMenuCounts(routeMap);
  const menuWithCounts = applyCountsToMenu(counts);

  return <HeaderClient menu={menuWithCounts} />;
}
