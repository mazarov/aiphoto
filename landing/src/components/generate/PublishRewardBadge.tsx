type Props = {
  credits?: number;
  /** Replaces `+N✦` when the offer is a cap, e.g. `до +50✦`. */
  label?: string;
  className?: string;
};

const BASE =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums text-white shadow-sm bg-emerald-500 shadow-emerald-500/35";

export function PublishRewardBadge({ credits, label, className = "" }: Props) {
  const text = label ?? (typeof credits === "number" ? `+${credits}✦` : "");
  if (!text) return null;
  return (
    <span className={`${BASE} ${className}`.trim()}>
      {text}
    </span>
  );
}
