import assert from "node:assert/strict";
import test from "node:test";
import { getSeoContent } from "./seo-content";
import {
  MIN_PROMTY_DLYA_II_FOTOSESSII_CARDS,
  PROMTY_DLYA_II_FOTOSESSII_CHILDREN,
  PROMTY_DLYA_II_FOTOSESSII_HUB_PATH,
  PROMTY_DLYA_II_FOTOSESSII_PERMANENT_REDIRECTS,
  findPromtyDlyaIiFotosessiiChild,
  getPromtyDlyaIiFotosessiiChildPath,
  getPromtyDlyaIiFotosessiiChipNavigation,
  isPromtyDlyaIiFotosessiiHubPath,
  isPromtyDlyaIiFotosessiiPath,
  listingGenerateIdleCta,
} from "./promty-dlya-ii-fotosessii-cluster";

test("hub path and L2 children use query slugs", () => {
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_HUB_PATH, "/promty-dlya-ii-fotosessii");
  assert.deepEqual(
    PROMTY_DLYA_II_FOTOSESSII_CHILDREN.map((child) => child.slug),
    [
      "muzhskie",
      "zhenskie",
      "pary",
      "den-rozhdeniya",
      "detskie",
      "semeynye",
      "studiynye",
      "zimnyaya",
      "beremennye",
      "s-voennymi",
      "dlya-dvoih",
      "novogodnyaya",
      "vesennie",
      "delovoy-stil",
      "nyuborn",
      "s-mashinoy",
      "cherno-belye",
    ]
  );
  assert.equal(
    getPromtyDlyaIiFotosessiiChildPath("zhenskie"),
    "/promty-dlya-ii-fotosessii/zhenskie"
  );
  assert.equal(
    getPromtyDlyaIiFotosessiiChildPath("pary"),
    "/promty-dlya-ii-fotosessii/pary"
  );
  assert.equal(findPromtyDlyaIiFotosessiiChild("devushki"), null);
  assert.equal(findPromtyDlyaIiFotosessiiChild("zhenskie")?.tagValue, "devushka");
  assert.equal(findPromtyDlyaIiFotosessiiChild("muzhskie")?.tagValue, "muzhchina");
  assert.equal(findPromtyDlyaIiFotosessiiChild("pary")?.tagValue, "para");
  assert.equal(findPromtyDlyaIiFotosessiiChild("semeynye")?.tagValue, "semya");
  assert.equal(findPromtyDlyaIiFotosessiiChild("detskie")?.tagValue, "detskie");
  assert.equal(
    findPromtyDlyaIiFotosessiiChild("beremennye")?.tagValue,
    "beremennaya"
  );
  assert.equal(
    findPromtyDlyaIiFotosessiiChild("den-rozhdeniya")?.tagValue,
    "den_rozhdeniya"
  );
  assert.equal(findPromtyDlyaIiFotosessiiChild("studiynye")?.tagValue, "studiynoe");
  assert.equal(findPromtyDlyaIiFotosessiiChild("zimnyaya")?.tagValue, "zima");
  assert.equal(findPromtyDlyaIiFotosessiiChild("s-voennymi")?.tagValue, "v_forme");
  assert.equal(
    findPromtyDlyaIiFotosessiiChild("dlya-dvoih")?.tagValue,
    "vlyublennykh"
  );
  assert.equal(
    findPromtyDlyaIiFotosessiiChild("novogodnyaya")?.tagValue,
    "novyy_god"
  );
  assert.equal(findPromtyDlyaIiFotosessiiChild("vesennie")?.tagValue, "vesna");
  assert.equal(findPromtyDlyaIiFotosessiiChild("delovoy-stil")?.tagValue, "delovoe");
  assert.equal(findPromtyDlyaIiFotosessiiChild("nyuborn")?.tagValue, "malysh");
  assert.equal(findPromtyDlyaIiFotosessiiChild("s-mashinoy")?.tagValue, "s_mashinoy");
  assert.equal(
    findPromtyDlyaIiFotosessiiChild("cherno-belye")?.tagValue,
    "cherno_beloe"
  );
  assert.equal(MIN_PROMTY_DLYA_II_FOTOSESSII_CARDS, 8);
});

test("legacy fotosessii slug redirects to the new hub", () => {
  assert.deepEqual(PROMTY_DLYA_II_FOTOSESSII_PERMANENT_REDIRECTS, [
    {
      source: "/promty-dlya-fotosessii",
      destination: "/promty-dlya-ii-fotosessii",
    },
  ]);
});

test("path helpers treat hub and children as the cluster", () => {
  assert.equal(isPromtyDlyaIiFotosessiiHubPath("/promty-dlya-ii-fotosessii/"), true);
  assert.equal(isPromtyDlyaIiFotosessiiHubPath("/promty-dlya-ii-fotosessii/zhenskie"), false);
  assert.equal(isPromtyDlyaIiFotosessiiPath("/promty-dlya-ii-fotosessii/zhenskie/"), true);
  assert.equal(isPromtyDlyaIiFotosessiiPath("/promty-dlya-foto-devushki"), false);
});

test("generate FAB on the hub and children is photoshoot, not generic photo", () => {
  assert.equal(
    listingGenerateIdleCta({
      pathname: "/promty-dlya-ii-fotosessii",
      isAuthed: true,
    }),
    "Создать ИИ фотосессию",
  );
  assert.equal(
    listingGenerateIdleCta({
      pathname: "/promty-dlya-ii-fotosessii/cherno-belye/",
      isAuthed: true,
    }),
    "Создать ИИ фотосессию",
  );
  assert.equal(
    listingGenerateIdleCta({
      pathname: "/promty-dlya-ii-fotosessii/zhenskie",
      isAuthed: false,
    }),
    "Войти и создать ИИ фотосессию",
  );
  assert.equal(
    listingGenerateIdleCta({ pathname: "/generaciya-foto", isAuthed: true }),
    "Создать фото",
  );
  assert.equal(
    listingGenerateIdleCta({ pathname: "/", isAuthed: false }),
    "Войти и создать фото",
  );
});

test("audience L1 no longer owns the photoshoot head in H1", () => {
  const women = getSeoContent("devushka");
  const men = getSeoContent("muzhchina");
  assert.equal(women?.h1, "Промты для фото девушки");
  assert.doesNotMatch(women?.h1 ?? "", /фотосесс/i);
  assert.doesNotMatch(women?.metaTitle ?? "", /фотосесс/i);
  assert.match(women?.intro ?? "", /промтах для ИИ фотосессии женских/i);
  assert.equal(
    women?.popularLinks?.[0]?.href,
    "/promty-dlya-ii-fotosessii/zhenskie"
  );
  assert.equal(men?.popularLinks?.[0]?.href, "/promty-dlya-ii-fotosessii/muzhskie");
  assert.equal(
    getSeoContent("para")?.popularLinks?.[0]?.href,
    "/promty-dlya-ii-fotosessii/pary"
  );
  assert.equal(
    getSeoContent("semya")?.popularLinks?.[0]?.href,
    "/promty-dlya-ii-fotosessii/semeynye"
  );
  assert.equal(
    getSeoContent("detskie")?.popularLinks?.[0]?.href,
    "/promty-dlya-ii-fotosessii/detskie"
  );
  assert.equal(
    getSeoContent("beremennaya")?.popularLinks?.[0]?.href,
    "/promty-dlya-ii-fotosessii/beremennye"
  );
});

test("chip nav on hub is children only; on L2 hub chip is first", () => {
  const hub = getPromtyDlyaIiFotosessiiChipNavigation(null);
  assert.equal(hub.length, 17);
  assert.equal(hub.some((item) => item.kind === "hub"), false);
  assert.equal(hub[0].href, "/promty-dlya-ii-fotosessii/muzhskie");
  assert.equal(hub[1].href, "/promty-dlya-ii-fotosessii/zhenskie");
  assert.equal(hub[2].href, "/promty-dlya-ii-fotosessii/pary");
  assert.equal(hub[3].href, "/promty-dlya-ii-fotosessii/den-rozhdeniya");

  const child = getPromtyDlyaIiFotosessiiChipNavigation("muzhskie");
  assert.equal(child[0].kind, "hub");
  assert.equal(child[0].href, PROMTY_DLYA_II_FOTOSESSII_HUB_PATH);
  assert.equal(child.find((item) => item.active)?.href, "/promty-dlya-ii-fotosessii/muzhskie");
});
