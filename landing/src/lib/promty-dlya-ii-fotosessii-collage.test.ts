import assert from "node:assert/strict";
import test from "node:test";
import {
  FOTOSESSII_THEME_COLLAGE_MIN_PHOTOS,
  collectFotosessiiCollagePhotos,
  filterFotosessiiCollageItems,
} from "./promty-dlya-ii-fotosessii-collage";

const album = (stem: string) => ({
  photoUrls: [1, 2, 3, 4].map((n) => `https://cdn/${stem}-${n}.jpg`),
});

test("two albums fill six collage cells, lead frames first", () => {
  const photos = collectFotosessiiCollagePhotos([album("a"), album("b")], 6);
  assert.deepEqual(photos, [
    "https://cdn/a-1.jpg",
    "https://cdn/b-1.jpg",
    "https://cdn/a-2.jpg",
    "https://cdn/b-2.jpg",
    "https://cdn/a-3.jpg",
    "https://cdn/b-3.jpg",
  ]);
});

test("six albums keep one lead frame each; duplicates dropped", () => {
  const cards = ["a", "b", "c", "d", "e", "f"].map(album);
  const photos = collectFotosessiiCollagePhotos([...cards, album("a")], 6);
  assert.deepEqual(
    photos,
    ["a", "b", "c", "d", "e", "f"].map((s) => `https://cdn/${s}-1.jpg`)
  );
  assert.deepEqual(collectFotosessiiCollagePhotos([], 6), []);
});

test("one album cycles its frames into the two spare cells; partial album stays short", () => {
  assert.deepEqual(collectFotosessiiCollagePhotos([album("a")], 6), [
    "https://cdn/a-1.jpg",
    "https://cdn/a-2.jpg",
    "https://cdn/a-3.jpg",
    "https://cdn/a-4.jpg",
    "https://cdn/a-2.jpg",
    "https://cdn/a-3.jpg",
  ]);
  assert.deepEqual(
    collectFotosessiiCollagePhotos(
      [{ photoUrls: album("p").photoUrls.slice(0, 3) }],
      6
    ),
    ["https://cdn/p-1.jpg", "https://cdn/p-2.jpg", "https://cdn/p-3.jpg"]
  );
});

test("scenario without a full album leaves the hub collage", () => {
  const items = [
    { href: "/ii-fotosessiya/zhenskie" },
    { href: "/ii-fotosessiya/muzhskie" },
    { href: "/ii-fotosessiya/zimnyaya" },
  ];
  const photosByHref = {
    "/ii-fotosessiya/zhenskie": album("w").photoUrls,
    "/ii-fotosessiya/muzhskie": album("m").photoUrls.slice(0, 3),
  };
  assert.equal(FOTOSESSII_THEME_COLLAGE_MIN_PHOTOS, 4);
  assert.deepEqual(
    filterFotosessiiCollageItems(items, photosByHref).map((i) => i.href),
    ["/ii-fotosessiya/zhenskie"]
  );
});
