import type { PromptCardFull } from "@/lib/supabase";
import { PromptCard } from "./PromptCard";

type Props = {
  cards: PromptCardFull[];
};

export function PromptGrid({ cards }: Props) {
  if (cards.length === 0) {
    return (
      <p className="py-12 text-center text-stone-500">
        Карточки не найдены. Пока нет опубликованных промптов.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map((card) => (
        <PromptCard key={card.id} card={card} />
      ))}
    </div>
  );
}
