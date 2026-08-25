/** Compact admin history/generation rows — mobile matches imageprompt.tools density. */

export const adminDenseListClass = "space-y-2 sm:space-y-3";

export const adminDenseRowClass =
  "flex gap-2.5 rounded-xl border border-zinc-200 bg-white p-2.5 sm:gap-3 sm:rounded-2xl sm:p-3 sm:shadow-sm";

export const adminDenseThumbClass =
  "h-14 w-14 shrink-0 overflow-hidden rounded-md bg-zinc-100 sm:h-20 sm:w-20 sm:rounded-xl";

export const adminDenseBadgeClass = "rounded-full px-1.5 py-px text-[10px] font-semibold";

export const adminDenseMetaClass =
  "flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500";

export const adminDensePromptClass =
  "line-clamp-1 text-left text-xs leading-4 text-zinc-800 sm:mt-1 sm:line-clamp-2 sm:text-sm sm:leading-5";

export const adminDenseActionsClass =
  "mt-0.5 flex flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] font-semibold sm:mt-2 sm:flex-wrap sm:gap-3 sm:text-xs";

export const adminDenseFilterClass = (active: boolean) =>
  `rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:rounded-xl sm:px-3 sm:py-2 ${
    active
      ? "bg-indigo-600 text-white"
      : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
  }`;

export function formatAdminRowWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
