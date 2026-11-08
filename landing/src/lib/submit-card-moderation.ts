import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseCardModerationStatus,
  type CardModerationStatus,
} from "@/lib/publish-reward";

export type CardModerationSubmission = {
  cardId: string;
  slug: string;
  isPublished: boolean;
  moderationStatus: CardModerationStatus;
  alreadyPublished: boolean;
};

/**
 * Author asked to publish. The card stays off the showcase until an admin
 * approves it. Already-live cards are left live.
 */
export async function submitPromptCardForModeration(
  supabase: SupabaseClient,
  cardId: string,
): Promise<CardModerationSubmission> {
  const { data: card, error } = await supabase
    .from("prompt_cards")
    .select("id,slug,is_published,moderation_status")
    .eq("id", cardId)
    .maybeSingle();
  if (error) throw new Error(`card_lookup_failed:${error.message}`);
  if (!card?.id || !card.slug) throw new Error("card_not_found");

  const slug = card.slug as string;
  if (card.is_published) {
    return {
      cardId: card.id as string,
      slug,
      isPublished: true,
      moderationStatus: "approved",
      alreadyPublished: true,
    };
  }

  const requestedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("prompt_cards")
    .update({
      moderation_status: "pending",
      moderation_requested_at: requestedAt,
      updated_at: requestedAt,
    })
    .eq("id", cardId)
    .eq("is_published", false);
  if (updateError) throw new Error(`moderation_submit_failed:${updateError.message}`);

  return {
    cardId: card.id as string,
    slug,
    isPublished: false,
    moderationStatus: parseCardModerationStatus("pending"),
    alreadyPublished: false,
  };
}
