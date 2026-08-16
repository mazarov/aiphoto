import type { PromptCardFull } from "@/lib/supabase";

export function ListingCardDebugOverlay({ card }: { card: PromptCardFull }) {
  const hasEnOnly = !card.hasRuPrompt && card.promptTexts.length > 0;
  const ruLabel = card.hasRuPrompt ? "RU: есть" : hasEnOnly ? "EN only" : "нет промпта";
  const ruColor = card.hasRuPrompt
    ? "bg-emerald-600"
    : hasEnOnly
      ? "bg-amber-500"
      : "bg-red-500";
  const scoreColor =
    card.seoReadinessScore >= 60
      ? "bg-emerald-600"
      : card.seoReadinessScore >= 40
        ? "bg-blue-500"
        : "bg-zinc-500";

  return (
    <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
      <div className="space-y-1 bg-black/70 px-2.5 py-2 backdrop-blur-sm">
        <div className="pointer-events-auto break-all font-mono text-[9px] leading-tight text-white/50 select-all">
          {card.id}
        </div>
        <div className="font-mono text-[10px] leading-tight text-white/70">
          {card.datasetSlug && <span>{card.datasetSlug}</span>}
          {card.sourceMessageId && <span> · msg {card.sourceMessageId}</span>}
          {card.sourceDate && <span> · {card.sourceDate}</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-zinc-600 px-1.5 py-px text-[9px] font-medium text-white">
            photos: {card.photoCount}
          </span>
          <span className="rounded-full bg-zinc-600 px-1.5 py-px text-[9px] font-medium text-white">
            prompts: {card.promptCount}
          </span>
          <span
            className={`rounded-full ${scoreColor} px-1.5 py-px text-[9px] font-medium text-white`}
          >
            score: {card.seoReadinessScore}
          </span>
          <span
            className={`rounded-full ${ruColor} px-1.5 py-px text-[9px] font-medium text-white`}
          >
            {ruLabel}
          </span>
          {card.beforePhotoUrl ? (
            <span className="rounded-full bg-teal-600 px-1.5 py-px text-[9px] font-medium text-white">
              было
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
