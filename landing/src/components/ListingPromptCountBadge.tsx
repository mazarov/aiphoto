import { pluralPrompts } from "@/lib/plural-prompts";

type Props = {
  count: number;
};

export function ListingPromptCountBadge({ count }: Props) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-zinc-100 px-3 py-1 text-sm tabular-nums text-zinc-600">
      {pluralPrompts(count)}
    </span>
  );
}
