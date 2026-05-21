/** Общие константы для маркетинговых страниц /extension-stv/*. */
export const STV_CHROME_STORE_URL =
  process.env.NEXT_PUBLIC_STV_CHROME_STORE_URL || "#stv-chrome-store";

export const STV_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]";

/**
 * Единая система секций (отступы, ширина, типографика, «лавандовый» визуальный блок под моки).
 * Тёмная тема лендинга; акцент — violet/indigo как в референсах SaaS.
 */
export const STV_SECTION_CONTAINER = "mx-auto max-w-6xl px-4 sm:px-6";
export const STV_SECTION_PY = "py-14 sm:py-16";
export const STV_SECTION_DIVIDER = "border-t border-white/[0.06]";
export const STV_SECTION_BG_MUTED = "bg-[rgb(9_9_11/0.35)]";
export const STV_SECTION_TITLE =
  "text-center text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl text-balance";
export const STV_SECTION_SUBTITLE =
  "mx-auto mt-3 max-w-2xl text-center text-[15px] leading-relaxed text-zinc-500 sm:text-base text-pretty";
/** Оболочка для иллюстраций: мягкий градиент + бордер (аналог светлой подложки в референсе). */
export const STV_VISUAL_SHELL =
  "rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.14] via-indigo-500/[0.07] to-transparent p-6 shadow-[0_24px_80px_-40px_rgba(99,102,241,0.35)] ring-1 ring-inset ring-white/[0.05] sm:p-8";
/** Подпись над моком (eyebrow). */
export const STV_MOCK_EYEBROW =
  "mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-300/80 lg:text-left";
