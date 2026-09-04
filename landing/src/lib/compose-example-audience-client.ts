import {
  isComposeExampleAudienceTag,
  type ComposeExampleAudienceTag,
} from "./compose-example-audience";
import { composeExamplePickerEndpoint } from "./generaciya-foto-compose-example";
import { isPhotoPromptEphemeralId } from "./generate-photo-prompt";

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
): string | null {
  return composeExamplePickerEndpoint({
    query: "",
    filter: null,
    audienceMatch,
  });
}

export function prefetchComposeExampleListing(
  audienceMatch: ComposeExampleAudienceTag | null,
): void {
  if (typeof fetch === "undefined") return;
  const url = composeExampleAudienceListingUrl(audienceMatch);
  if (!url) return;
  void fetch(url, { cache: "default", credentials: "same-origin" });
}
