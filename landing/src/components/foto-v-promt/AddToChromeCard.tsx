"use client";

import {
  getAiImageDescriberChromeUrl,
  type AiImageDescriberChromePlacement,
} from "@/lib/foto-v-promt-config";
import {
  trackDesktopSidebarAddToChromeClick,
  trackFotoVPromtAddToChromeClick,
} from "@/lib/yandex-metrika";
import { ChromeMark } from "./ChromeMark";

const CARD_CLASS =
  "flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

export function AddToChromeCard({
  placement,
  onNavigate,
  className,
}: {
  placement: AiImageDescriberChromePlacement;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <a
      href={getAiImageDescriberChromeUrl(placement)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        if (placement === "desktop_sidebar") {
          trackDesktopSidebarAddToChromeClick();
        } else {
          trackFotoVPromtAddToChromeClick(placement);
        }
        onNavigate?.();
      }}
      className={className ? `${CARD_CLASS} ${className}` : CARD_CLASS}
    >
      <ChromeMark className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-zinc-900">
          Добавить в Chrome
        </span>
        <span className="mt-0.5 block text-xs font-normal leading-snug text-zinc-500 line-clamp-2">
          Преврати фото с любого сайта в готовый промт
        </span>
      </span>
    </a>
  );
}
