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
    ? "max-lg:flex max-lg:h-[100svh] max-lg:min-h-0 max-lg:max-h-[100svh] max-lg:flex-col max-lg:overflow-hidden"
    : "";
  // Photo cards: one visible viewport. The card shrinks; the site footer stays inside it.
  const desktopFit = hideMobileChrome
    ? "lg:flex lg:h-dvh lg:max-h-dvh lg:flex-col lg:overflow-hidden"
    : "";

  return (
    <div className={`${mobileImmersive} ${desktopFit}`}>
      <div className="max-lg:hidden">
        <HeaderClient />
      </div>
      <div
        className={`flex min-h-0 flex-1 max-lg:flex-1 ${
          hideMobileChrome ? "lg:min-h-0 lg:overflow-hidden" : "lg:min-h-screen"
        }`}
      >
        <div className="max-lg:hidden">
          <SidebarNav menu={CARD_MENU} showBrand={false} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:overflow-hidden">
          {children}
          <div className="mt-auto shrink-0 max-lg:hidden">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
