import assert from "node:assert/strict";
import test from "node:test";
import { listingGenerateIdleIntent } from "./generate-dock-path";
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
  assert.equal(PROMTY_DLYA_II_FOTOSESSII_HUB_PATH, "/ii-fotosessiya");
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
    "/ii-fotosessiya/zhenskie"
  );
  assert.equal(
    getPromtyDlyaIiFotosessiiChildPath("pary"),
    "/ii-fotosessiya/pary"
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
      destination: "/ii-fotosessiya",
    },
    {
      source: "/promty-dlya-ii-fotosessii",
      destination: "/ii-fotosessiya",
    },
    {
      source: "/promty-dlya-ii-fotosessii/:slug",
      destination: "/ii-fotosessiya/:slug",
    },
  ]);
});

test("path helpers treat hub and children as the cluster", () => {
  assert.equal(isPromtyDlyaIiFotosessiiHubPath("/ii-fotosessiya/"), true);
  assert.equal(isPromtyDlyaIiFotosessiiHubPath("/ii-fotosessiya/zhenskie"), false);
  assert.equal(isPromtyDlyaIiFotosessiiPath("/ii-fotosessiya/zhenskie/"), true);
  assert.equal(isPromtyDlyaIiFotosessiiPath("/promty-dlya-foto-devushki"), false);
});

test("generate FAB on the hub and children is photoshoot, not generic photo", () => {
  assert.equal(
    listingGenerateIdleCta({
      pathname: "/ii-fotosessiya",
      isAuthed: true,
    }),
    "Создать ИИ фотосессию",
  );
  assert.equal(
    listingGenerateIdleCta({
      pathname: "/ii-fotosessiya/cherno-belye/",
      isAuthed: true,
    }),
    "Создать ИИ фотосессию",
  );
  assert.equal(
    listingGenerateIdleCta({
      pathname: "/ii-fotosessiya/zhenskie",
      isAuthed: false,
    }),
    "Создать ИИ фотосессию",
  );
  assert.equal(
    listingGenerateIdleCta({ pathname: "/generaciya-foto", isAuthed: true }),
    "Создать фото",
  );
  assert.equal(
    listingGenerateIdleCta({ pathname: "/", isAuthed: false }),
    "Создать фото",
  );
  assert.equal(
    listingGenerateIdleCta({ pathname: "/foto-v-promt", isAuthed: false }),
    "Создать промт по фото",
  );
  assert.equal(
    listingGenerateIdleCta({ pathname: "/foto-v-promt/", isAuthed: true }),
    "Создать промт по фото",
  );
  assert.equal(
    listingGenerateIdleCta({
      pathname: "/promty-dlya-ii-fotosessii",
      isAuthed: true,
    }),
    "Создать ИИ фотосессию",
  );
});

test("fotosessii listings seed photoshoot intent on idle FAB", () => {
  assert.equal(listingGenerateIdleIntent("/ii-fotosessiya"), "photoshoot");
  assert.equal(
    listingGenerateIdleIntent("/ii-fotosessiya/zhenskie"),
    "photoshoot",
  );
});

test("audience L1 keeps кадр key in H1 and holds fotosessii prompts in H2", () => {
  const women = getSeoContent("devushka");
  const men = getSeoContent("muzhchina");
  const couples = getSeoContent("para");
  assert.equal(women?.h1, "Промты для фото девушки");
  assert.doesNotMatch(women?.h1 ?? "", /фотосесс/i);
  assert.doesNotMatch(women?.metaTitle ?? "", /фотосесс/i);
  assert.equal(women?.seoTextBlocks?.[0]?.h2, "Промты для ИИ фотосессии женские");
  assert.match(women?.intro ?? "", /Промты для ИИ фотосессии женские/);
  assert.match(women?.intro ?? "", /женской ИИ фотосессии/i);
  assert.equal(men?.seoTextBlocks?.[0]?.h2, "Промты для ИИ фотосессии мужские");
  assert.equal(couples?.seoTextBlocks?.[0]?.h2, "Промты для ИИ фотосессии пары");
  assert.doesNotMatch(men?.h1 ?? "", /фотосесс/i);
  assert.doesNotMatch(couples?.h1 ?? "", /фотосесс/i);
  assert.equal(
    women?.popularLinks?.[0]?.href,
    "/ii-fotosessiya/zhenskie"
  );
  assert.equal(men?.popularLinks?.[0]?.href, "/ii-fotosessiya/muzhskie");
  assert.equal(couples?.popularLinks?.[0]?.href, "/ii-fotosessiya/pary");
  assert.equal(
    getSeoContent("semya")?.popularLinks?.[0]?.href,
    "/ii-fotosessiya/semeynye"
  );
  assert.equal(
    getSeoContent("detskie")?.popularLinks?.[0]?.href,
    "/ii-fotosessiya/detskie"
  );
  assert.equal(
    getSeoContent("beremennaya")?.popularLinks?.[0]?.href,
    "/ii-fotosessiya/beremennye"
  );
});

test("chip nav on hub is children only; on L2 hub chip is first", () => {
  const hub = getPromtyDlyaIiFotosessiiChipNavigation(null);
  assert.equal(hub.length, 17);
  assert.equal(hub.some((item) => item.kind === "hub"), false);
  assert.equal(hub[0].href, "/ii-fotosessiya/muzhskie");
  assert.equal(hub[1].href, "/ii-fotosessiya/zhenskie");
  assert.equal(hub[2].href, "/ii-fotosessiya/pary");
  assert.equal(hub[3].href, "/ii-fotosessiya/den-rozhdeniya");

  const child = getPromtyDlyaIiFotosessiiChipNavigation("muzhskie");
  assert.equal(child[0].kind, "hub");
  assert.equal(child[0].href, PROMTY_DLYA_II_FOTOSESSII_HUB_PATH);
  assert.equal(child.find((item) => item.active)?.href, "/ii-fotosessiya/muzhskie");
});
