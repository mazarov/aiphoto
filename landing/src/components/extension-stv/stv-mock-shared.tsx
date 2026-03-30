import type { ReactNode } from "react";

/** Референс для мокапа Pain и hero-пина (UGC / web-generation-results на Storage). */
export const PAIN_REFERENCE_IMAGE_SRC =
  "https://bk07-67ud-ea1y.gw-1a.dockhost.net/storage/v1/render/image/public/web-generation-results/5fbdb74f-63c5-4f9a-a823-2164bf6ac813/d9e221f0-ab33-4168-952f-b3df201180d7.png?width=768&quality=70";

/** Пример «слабого» черновика для контраста (не совпадает с референсом). */
const WEAK_DRAFT_PROMPT_TEXT = `nice photo good light professional studio sharp high quality 4k beautiful face`;

/** Пример более структурированного промпта (всё ещё не попадает в вайб референса без анализа кадра). */
const STRUCTURED_BUT_OFF_PROMPT_TEXT = `Portrait photo of a person, soft lighting, blurred background, DSLR, 50mm, natural colors, social media style, slight smile, indoor, neutral wall behind subject, smartphone camera look, generic stock photo mood`;

/** Текст в поле «копировать» (мокап черновика до extract). */
export const DRAFT_PROMPT_COPY_VALUE = `${WEAK_DRAFT_PROMPT_TEXT}\n\n${STRUCTURED_BUT_OFF_PROMPT_TEXT}`;

/** SVG path — как в extension/content-script.js */
export const STV_OVERLAY_STAR_PATH =
  "M10.788 3.21c.448-1.077 1.656-1.077 2.104 0l2.052 4.96 5.35.434c1.161.094 1.548 1.603.748 2.384l-4.09 3.941 1.14 5.348c.25 1.17-1.036 2.017-2.1 1.51l-4.828-2.29-4.827 2.29c-1.064.507-2.35-.34-2.1-1.51l1.14-5.348-4.09-3.941c-.8-.781-.413-2.384.748-2.384l5.35-.434 2.052-4.96Z";

/** Кнопка оверлея — визуал content-script (мокап, не кликабельно). */
export function OverlayButtonMock({
  className,
  headline = "Steal this vibe",
  headlineClassName,
}: {
  className?: string;
  /** Подпись на лендинге расширения и т.п.; дефолт совпадает с живым content-script. */
  headline?: string;
  headlineClassName?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`Extension overlay: ${headline} — PromptShot`}
      className={
        "pointer-events-none min-h-[46px] select-none rounded-[12px] border border-white/10 bg-[rgba(24,24,27,0.94)] text-left text-[#fafafa] shadow-[0_0_0_1px_rgba(99,102,241,0.22),0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_28px_rgba(0,0,0,0.45),0_4px_16px_rgba(99,102,241,0.18)] " +
        (className ?? "")
      }
    >
      <div className="flex items-center gap-2.5 whitespace-nowrap py-2 pl-2 pr-3.5 sm:gap-[10px] sm:py-2 sm:pl-2 sm:pr-3.5">
        <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white shadow-[0_2px_12px_rgba(99,102,241,0.4)] sm:h-[34px] sm:w-[34px] sm:rounded-[10px]">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            className="block h-[15px] w-[15px] sm:h-[17px] sm:w-[17px]"
          >
            <path fillRule="evenodd" d={STV_OVERLAY_STAR_PATH} clipRule="evenodd" />
          </svg>
        </div>
        <div className="flex flex-col items-start gap-px leading-tight">
          <span
            className={`font-semibold tracking-tight text-[#fafafa] ${headlineClassName ?? "text-[12px] sm:text-[13px]"}`}
          >
            {headline}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a1a1aa]">PromptShot</span>
        </div>
      </div>
    </div>
  );
}

type StvPinShellProps = {
  tall?: boolean;
  /** Высота медиа-блока (компакт для сайдбай-секций) */
  density?: "feed" | "compact";
  /**
   * Растянуть карточку по высоте колонки (grid/flex): медиа `flex-1`, футер фиксирован.
   * Использовать в паре с родителем `flex h-full flex-col` + `flex-1` на карточке.
   */
  fillHeight?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Карточка «пина» Pinterest: медиа + нижняя полоска с аватаром/скелетом заголовка.
 * Дети — слой `relative` (градиенты и оверлей с `absolute`).
 */
export function StvPinShell({
  tall,
  density = "feed",
  fillHeight = false,
  className,
  children,
}: StvPinShellProps) {
  const mediaMinH = fillHeight
    ? "min-h-0 flex-1 basis-0"
    : density === "compact"
      ? tall
        ? "min-h-[140px] sm:min-h-[160px]"
        : "min-h-[88px] sm:min-h-[100px]"
      : tall
        ? "min-h-[200px] sm:min-h-[240px]"
        : "min-h-[120px] sm:min-h-[140px]";

  return (
    <div
      className={`overflow-hidden rounded-2xl bg-[#3d3d3d] shadow-md ring-1 ring-black/40 ${
        fillHeight ? "flex min-h-0 flex-col" : ""
      } ${className ?? ""}`}
    >
      <div className={fillHeight ? `relative min-h-0 ${mediaMinH}` : `relative ${mediaMinH}`}>{children}</div>
      <div className="border-t border-black/20 bg-[#2a2a2a] px-2.5 py-2">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-600" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-2 w-[72%] max-w-[140px] rounded-full bg-zinc-600/90" />
            <div className="h-1.5 w-[45%] max-w-[80px] rounded-full bg-zinc-600/60" />
          </div>
        </div>
      </div>
    </div>
  );
}

