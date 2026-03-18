import { applyCountsToMenu } from "@/lib/menu";
import { HeaderClient } from "./HeaderClient";
import { SidebarNav } from "./SidebarNav";
import { Footer } from "./Footer";

const MENU_STRUCTURE = applyCountsToMenu({});

export function PageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeaderClient />
      <div className="flex min-h-[calc(100vh-57px)]">
        <SidebarNav menu={MENU_STRUCTURE} />
        <div className="flex min-w-0 flex-1 flex-col">
          {children}
          <Footer />
        </div>
      </div>
    </>
  );
}
