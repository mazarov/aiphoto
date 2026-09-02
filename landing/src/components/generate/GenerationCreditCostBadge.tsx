type Props = {
  cost: number;
  unaffordable?: boolean;
  compact?: boolean;
  className?: string;
};

const BASE =
  "inline-flex items-center rounded-full font-semibold tabular-nums text-white shadow-sm";

export function GenerationCreditCostBadge({
  cost,
  unaffordable = false,
  compact = false,
  className = "",
}: Props) {
  return (
    <span
      className={`${BASE} ${
        compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-[13px]"
      } ${
        unaffordable
          ? "bg-rose-500 shadow-rose-500/30"
          : "bg-gradient-to-r from-indigo-500 to-violet-500 shadow-indigo-500/35"
      } ${className}`.trim()}
    >
      {cost}✦
    </span>
  );
}
