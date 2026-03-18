import { fetchMenuCounts } from "@/lib/supabase";
import { getMenuRouteMap, applyCountsToMenu } from "@/lib/menu";
import { HeaderClient } from "./HeaderClient";
import { SidebarNav } from "./SidebarNav";
import { Footer } from "./Footer";

type Props = {
  children: React.ReactNode;
  counts?: Record<string, number>;
};

export async function PageLayout({ children, counts: precomputedCounts }: Props) {
  const routeMap = getMenuRouteMap();
  const counts = precomputedCounts ?? await fetchMenuCounts(routeMap);
  const menu = applyCountsToMenu(counts);

  return (
    <>
      <HeaderClient />
      <div className="flex min-h-[calc(100vh-57px)]">
        <SidebarNav menu={menu} />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <Footer />
        </div>
      </div>
    </>
  );
}
