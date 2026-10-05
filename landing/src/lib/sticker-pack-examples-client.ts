/**
 * Browser cache for `GET /api/sticker-pack-examples` — one fetch per page session.
 */

export type StickerPackExampleClient = {
  id: string;
  name: string;
  description: string;
  stickerCount: number;
  exampleUrl: string;
};

export const STICKER_PACK_EXAMPLES_ENDPOINT = "/api/sticker-pack-examples";

let pending: Promise<StickerPackExampleClient[]> | null = null;
let resolved: StickerPackExampleClient[] | null = null;

export function peekStickerPackExamples(): StickerPackExampleClient[] | null {
  return resolved;
}

export function loadStickerPackExamplesClient(
  fetchImpl: typeof fetch = fetch,
): Promise<StickerPackExampleClient[]> {
  if (resolved) return Promise.resolve(resolved);
  if (pending) return pending;
  pending = fetchImpl(STICKER_PACK_EXAMPLES_ENDPOINT, { credentials: "omit" })
    .then(async (res) => {
      if (!res.ok) throw new Error(`sticker pack examples ${res.status}`);
      const data = (await res.json()) as { packs?: StickerPackExampleClient[] };
      const packs = Array.isArray(data.packs) ? data.packs : [];
      resolved = packs;
      return packs;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** Tests only. */
export function resetStickerPackExamplesClientCache(): void {
  pending = null;
  resolved = null;
}
