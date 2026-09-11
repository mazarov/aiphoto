import {
  isComposeExampleAudienceTag,
  type ComposeExampleAudienceTag,
} from "./compose-example-audience";
import {
  composeExamplePickerEndpoint,
  SEO_COMPOSE_EXAMPLE_LIMIT,
} from "./generaciya-foto-compose-example";
import { isPhotoPromptEphemeralId } from "./generate-photo-prompt";
import type { PromptCardFull } from "./supabase";

export const COMPOSE_EXAMPLE_AUDIENCE_CACHE_VERSION = "child-v1";

export type ComposeExampleMatchPhotoInput = {
  id: string;
  dataUrl?: string | null;
  audienceTag?: string | null;
};

const audienceMemoryCache = new Map<string, ComposeExampleAudienceTag | null>();
const audienceFlights = new Map<string, Promise<ComposeExampleAudienceTag | null>>();

export function composeExampleMatchPhotoKey(
  photo: ComposeExampleMatchPhotoInput,
): string {
  const dataUrl = photo.dataUrl?.trim() || "";
  if (dataUrl) {
    return `${COMPOSE_EXAMPLE_AUDIENCE_CACHE_VERSION}:data:${dataUrl.length}:${dataUrl.slice(0, 40)}:${dataUrl.slice(-24)}`;
  }
  return `${COMPOSE_EXAMPLE_AUDIENCE_CACHE_VERSION}:${photo.id}`;
}

export function peekComposeExampleAudience(
  photo: ComposeExampleMatchPhotoInput,
): ComposeExampleAudienceTag | null | undefined {
  if (isComposeExampleAudienceTag(photo.audienceTag)) return photo.audienceTag;
  const key = composeExampleMatchPhotoKey(photo);
  if (!audienceMemoryCache.has(key)) return undefined;
  return audienceMemoryCache.get(key);
}

export function readComposeExampleAudience(
  photo: ComposeExampleMatchPhotoInput | null | undefined,
  enabled: boolean,
): ComposeExampleAudienceTag | null {
  if (!enabled || !photo) return null;
  const peeked = peekComposeExampleAudience(photo);
  return peeked === undefined ? null : peeked;
}

export function rememberComposeExampleAudience(
  photo: ComposeExampleMatchPhotoInput,
  tag: ComposeExampleAudienceTag | null,
): void {
  audienceMemoryCache.set(composeExampleMatchPhotoKey(photo), tag);
}

function classifyPayload(
  photo: ComposeExampleMatchPhotoInput,
): Record<string, string> | null {
  if (isPhotoPromptEphemeralId(photo.id)) {
    const dataUrl = photo.dataUrl?.trim() || "";
    return dataUrl ? { image_base64: dataUrl } : null;
  }
  return photo.id ? { photoId: photo.id } : null;
}

export async function prefetchComposeExampleAudience(
  photo: ComposeExampleMatchPhotoInput,
): Promise<ComposeExampleAudienceTag | null> {
  const cached = peekComposeExampleAudience(photo);
  if (cached !== undefined) {
    rememberComposeExampleAudience(photo, cached);
    return cached;
  }
  const payload = classifyPayload(photo);
  if (!payload) return null;

  const key = composeExampleMatchPhotoKey(photo);
  const pending = audienceFlights.get(key);
  if (pending) return pending;

  const flight = (async () => {
    try {
      const response = await fetch("/api/compose/classify-audience", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        audienceTag?: unknown;
      };
      const tag = isComposeExampleAudienceTag(data.audienceTag)
        ? data.audienceTag
        : null;
      rememberComposeExampleAudience(photo, tag);
      return tag;
    } catch {
      return null;
    } finally {
      audienceFlights.delete(key);
    }
  })();
  audienceFlights.set(key, flight);
  return flight;
}

export function composeExampleAudienceListingUrl(
  audienceMatch: ComposeExampleAudienceTag | null,
  filter?: { dimension: string; value: string } | null,
): string | null {
  return composeExamplePickerEndpoint({
    query: "",
    filter: filter ?? null,
    audienceMatch,
  });
}

export type ComposeExampleListingPage = {
  cards?: PromptCardFull[];
  ranked_batch_size?: number;
  total_count?: number;
  has_more?: boolean;
};

const listingMemoryCache = new Map<string, ComposeExampleListingPage>();
const listingFlights = new Map<string, Promise<ComposeExampleListingPage | null>>();

export function peekComposeExampleListing(
  url: string,
): ComposeExampleListingPage | undefined {
  return listingMemoryCache.get(url);
}

export function rememberComposeExampleListing(
  url: string,
  page: ComposeExampleListingPage,
): void {
  listingMemoryCache.set(url, page);
}

function warmupComposeExampleListingImages(page: ComposeExampleListingPage): void {
  if (typeof window === "undefined") return;
  const cards = page.cards ?? [];
  for (const card of cards.slice(0, SEO_COMPOSE_EXAMPLE_LIMIT)) {
    const src = card.photoUrls?.[0]?.trim() || "";
    if (!src) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  }
}

/**
 * Shared listing fetch. Not abortable: closing the sheet must not cancel
 * dock warmup, and two consumers share one in-flight.
 */
export async function loadComposeExampleListing(
  url: string,
): Promise<ComposeExampleListingPage | null> {
  const cached = listingMemoryCache.get(url);
  if (cached) return cached;
  const pending = listingFlights.get(url);
  if (pending) return pending;
  if (typeof fetch === "undefined") return null;

  const flight = (async () => {
    try {
      const response = await fetch(url, {
        cache: "default",
        credentials: "same-origin",
      });
      if (!response.ok) return null;
      const payload = (await response.json()) as ComposeExampleListingPage;
      rememberComposeExampleListing(url, payload);
      warmupComposeExampleListingImages(payload);
      return payload;
    } catch {
      return null;
    } finally {
      listingFlights.delete(url);
    }
  })();
  listingFlights.set(url, flight);
  return flight;
}

export function prefetchComposeExampleListing(
  audienceMatch: ComposeExampleAudienceTag | null,
  filter?: { dimension: string; value: string } | null,
): void {
  prefetchComposeExamplePickerFirstPage({ audienceMatch, filter });
}

/** Warm the catalog grid the example sheet will open on. */
export function prefetchComposeExamplePickerFirstPage(input?: {
  audienceMatch?: ComposeExampleAudienceTag | null;
  filter?: { dimension: string; value: string } | null;
}): void {
  const url = composeExampleAudienceListingUrl(
    input?.audienceMatch ?? null,
    input?.filter ?? null,
  );
  if (!url) return;
  void loadComposeExampleListing(url);
}
