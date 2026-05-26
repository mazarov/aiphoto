import { applyCountsToMenu } from "@/lib/menu";
import { Footer } from "./Footer";
import { HeaderClient } from "./HeaderClient";
import { SidebarNav } from "./SidebarNav";

const CARD_MENU = applyCountsToMenu({});

/**
 * Лэйаут `/p/[slug]`: на мобиле при наличии фото скрывает шапку/сайдбар/футер —
 * страница ведёт себя как fullscreen-просмотр (закрытие — клиентски).
 * 
 * `isModal`: когда рендерится внутри модального overlay — убирает внешние layout-элементы.
 */
export function CardPageLayout({
  hideMobileChrome,
  isModal = false,
  children,
}: {
  hideMobileChrome: boolean;
  isModal?: boolean;
  children: React.ReactNode;
}) {
  // In modal mode, we don't need the surrounding layout chrome
  if (isModal) {
    return (
      <div className="flex flex-col">
        {children}
      </div>
    );
  }

  const mobileImmersive = hideMobileChrome
    ? "max-md:flex max-md:h-[100dvh] max-md:min-h-0 max-md:max-h-[100dvh] max-md:flex-col max-md:overflow-hidden"
    : "";

  return (
    <div className={mobileImmersive}>
      <div className="max-md:hidden">
        <HeaderClient />
      </div>
      <div className="flex min-h-[calc(100vh-57px)] min-h-0 flex-1 max-md:flex-1">
        <div className="max-md:hidden">
          <SidebarNav menu={CARD_MENU} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
          <div className="mt-auto max-md:hidden">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
