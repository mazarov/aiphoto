type Props = {
  credits: number;
  className?: string;
};

const BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums text-white shadow-sm bg-emerald-500 shadow-emerald-500/35";

export function PublishRewardBadge({ credits, className = "" }: Props) {
  return (
    <span className={`${BASE} ${className}`.trim()}>
      +{credits}✦
    </span>
  );
}
