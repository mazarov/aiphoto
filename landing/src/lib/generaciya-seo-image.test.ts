import assert from "node:assert/strict";
import test from "node:test";
import { rankGeneraciyaFirstScreen } from "./generaciya-first-screen-rank";
import {
  buildGeneraciyaPhotoshootAlts,
  generaciyaLiveTileAlt,
  generaciyaPromptLinkLabel,
  resolveGeneraciyaFrameAlt,
} from "./generaciya-seo-alt";
import { attachGeneraciyaSeoFrames } from "./generaciya-seo-examples";
import {
  generaciyaKartinkaPerTag,
  generaciyaPopularPageParams,
  generaciyaScenarioFetchParams,
  interleaveGeneraciyaColumns,
} from "./generaciya-seo-fetch";
import {
  GENERACIYA_SEO_IMAGE_FLAGS_OFF,
  generaciyaSeoImageCacheToken,
  parseGeneraciyaSeoImageFlags,
} from "./generaciya-seo-image-flags";
import {
  buildGeneraciyaSeoImgAttrs,
  buildGeneraciyaSeoRenderPath,
  classifyGeneraciyaImageBot,
  generaciyaBotImageLog,
  generaciyaSeoRefererPath,
  parseGeneraciyaSeoImagePathname,
  parseGeneraciyaSeoImageRequest,
} from "./generaciya-seo-image-url";
import { isGeneraciyaSeoImagePath } from "./generaciya-foto-routes";

const PAGE_H1 = "Сделать фото по описанию";
const PAGE_H2 = "ИИ фото по описанию: примеры и готовые промты";
const HEADINGS = [PAGE_H1, PAGE_H2];

const STORED_ALT =
  "Женский портрет у окна в мягком дневном свете, льняное платье и спокойный взгляд";

type RankCard = {
  id: string;
  sourceGroupKey: string | null;
  cardSplitTotal: number;
  mediaPath: string | null;
  width: number | null;
  height: number | null;
  style?: string;
};

function card(partial: Partial<RankCard> & Pick<RankCard, "id">): RankCard {
  return {
    sourceGroupKey: `${partial.id}::group`,
    cardSplitTotal: 1,
    mediaPath: `${partial.id}.jpg`,
    width: 900,
    height: 1200,
    ...partial,
  };
}

test("SEO img attrs: 1080 src, 512 srcset, no second Next encode when single-pass is on", () => {
  const both = buildGeneraciyaSeoImgAttrs({
    mode: "both",
    bucket: "prompt-images",
    path: "cards/portrait.jpg",
    previewUrl: "https://cdn.example/render/portrait.jpg?width=512&quality=58",
    alt: STORED_ALT,
  });
  assert.ok(both);
  assert.match(both.src, /^\/img\/seo\/w1080\/prompt-images\/cards\/portrait\.jpg$/);
  assert.match(both.srcSet || "", /\/img\/seo\/w512\/prompt-images\/cards\/portrait\.jpg 512w/);
  assert.equal(both.srcSet?.includes("/_next/image"), false);
  assert.equal(both.decoding, "async");
  assert.equal(both.alt.includes(PAGE_H1), false);

  const single = buildGeneraciyaSeoImgAttrs({
    mode: "single512",
    bucket: "prompt-images",
    path: "cards/portrait.jpg",
    previewUrl: "https://cdn.example/render/portrait.jpg",
    alt: "кадр",
  });
  assert.ok(single);
  assert.match(single.src, /\/img\/seo\/w512\//);
  assert.equal(single.srcSet, undefined);
  assert.equal(JSON.stringify(single).includes("/_next/image"), false);

  const srcOnly = buildGeneraciyaSeoImgAttrs({
    mode: "src1080",
    bucket: "prompt-images",
    path: "cards/portrait.jpg",
    previewUrl: "https://cdn.example/render/portrait.jpg?width=512",
    alt: "кадр",
  });
  assert.match(srcOnly?.srcSet || "", /\/_next\/image\?/);
  assert.match(srcOnly?.src || "", /\/img\/seo\/w1080\//);
});

test("SEO image route ignores arbitrary width and rejects traversal", () => {
  const parsed = parseGeneraciyaSeoImageRequest("w1080", "prompt-images", [
    "cards",
    "portrait.jpg",
  ]);
  assert.equal(parsed?.width, 1080);
  assert.equal(parsed?.quality, 78);
  assert.equal(
    parseGeneraciyaSeoImageRequest("w4000", "prompt-images", ["a.jpg"]),
    null,
  );
  assert.equal(
    parseGeneraciyaSeoImageRequest("w1080", "prompt-images", ["..", "a.jpg"]),
    null,
  );
  const render = buildGeneraciyaSeoRenderPath(
    "prompt-images",
    "cards/portrait.jpg",
    "w512",
  );
  assert.equal(
    render,
    "/storage/v1/render/image/public/prompt-images/cards/portrait.jpg?width=512&quality=75",
  );
  assert.equal(render?.includes("object/public"), false);

  const fromPath = parseGeneraciyaSeoImagePathname(
    "/img/seo/w1080/prompt-images/cards/portrait.jpg?width=4000&quality=10",
  );
  assert.equal(fromPath?.width, 1080);
  assert.equal(fromPath?.quality, 78);
  assert.equal(fromPath?.objectPath, "cards/portrait.jpg");
  assert.equal(
    parseGeneraciyaSeoImagePathname("/img/seo/w1080/prompt-images/../secret.jpg"),
    null,
  );
  const colon = parseGeneraciyaSeoImagePathname(
    "/img/seo/w512/prompt-images/telegram/Lexy_ChatExport_03-14%3A06-07_2026/1965/0/0.jpg",
  );
  assert.equal(
    colon?.objectPath,
    "telegram/Lexy_ChatExport_03-14:06-07_2026/1965/0/0.jpg",
  );
  const colonRender = buildGeneraciyaSeoRenderPath(
    "prompt-images",
    colon?.objectPath || "",
    "w512",
  );
  assert.match(colonRender || "", /Lexy_ChatExport_03-14%3A06-07_2026/);
  assert.equal(colonRender?.includes("%253A"), false);
});

test("frame alt describes the picture and skips the page H1", () => {
  assert.equal(
    resolveGeneraciyaFrameAlt({
      stored: `${PAGE_H1}. ${STORED_ALT}`,
      title: `Промт для фото: ${PAGE_H1} на закате`,
      headings: HEADINGS,
    }).includes(PAGE_H1),
    false,
  );
  assert.equal(
    resolveGeneraciyaFrameAlt({
      stored: STORED_ALT,
      title: PAGE_H1,
      headings: HEADINGS,
    }),
    STORED_ALT,
  );
  assert.equal(
    resolveGeneraciyaFrameAlt({
      stored: "слишком короткий alt",
      title: "Промт для фото: Портрет у окна",
      headings: HEADINGS,
    }),
    "Портрет у окна",
  );
  assert.equal(generaciyaPromptLinkLabel("Промт для фото: Портрет у окна"), "Открыть промт «Портрет у окна»");
  assert.equal(
    generaciyaLiveTileAlt({
      decorative: true,
      frameAlts: [STORED_ALT],
      fallback: PAGE_H1,
    }),
    "",
  );
});

test("photoshoot frames share one alt until each frame has its own description", () => {
  const one = buildGeneraciyaPhotoshootAlts(
    [{ stored: STORED_ALT }, { stored: null }, { stored: null }, { stored: null }],
    "Портрет у окна",
    HEADINGS,
  );
  assert.equal(one[0].includes(PAGE_H1), false);
  assert.deepEqual(one.slice(1), ["", "", ""]);

  const distinct = ["а", "б", "в", "г"].map(
    (mark) => `${STORED_ALT} ${mark} кадр фотосессии`,
  );
  const four = buildGeneraciyaPhotoshootAlts(
    distinct.map((stored) => ({ stored })),
    "Портрет у окна",
    HEADINGS,
  );
  assert.equal(new Set(four).size, 4);
  assert.equal(four.some((alt) => alt === ""), false);
});

test("first screen keeps at least 14 unique media paths and drops split siblings", () => {
  const pool: RankCard[] = [];
  for (let index = 0; index < 20; index += 1) {
    pool.push(card({ id: `card-${index}`, mediaPath: `media/${index}.jpg` }));
  }
  pool.push(
    card({
      id: "sibling",
      sourceGroupKey: pool[0].sourceGroupKey,
      cardSplitTotal: 4,
      mediaPath: "media/sibling.jpg",
    }),
  );
  pool[3] = card({
    id: "dup-path",
    mediaPath: pool[1].mediaPath,
  });
  const ranked = rankGeneraciyaFirstScreen(pool, (item) => item);
  const paths = ranked.map((item) => item.mediaPath);
  assert.equal(ranked.length, 16);
  assert.ok(new Set(paths).size >= 14);
  assert.equal(ranked.some((item) => item.id === "sibling"), false);
  assert.equal(ranked.some((item) => item.id === "dup-path"), false);
  assert.equal(ranked[0]?.id, "card-0");
});

test("short pool is filled from rejected cards without repeating a path", () => {
  const valid = Array.from({ length: 8 }, (_, index) =>
    card({ id: `ok-${index}`, mediaPath: `ok/${index}.jpg` }),
  );
  const sibling = card({
    id: "sibling",
    sourceGroupKey: valid[0].sourceGroupKey,
    cardSplitTotal: 2,
    mediaPath: "ok/sibling.jpg",
    width: null,
    height: null,
  });
  const ranked = rankGeneraciyaFirstScreen([...valid, sibling], (item) => item);
  assert.ok(ranked.length >= 9);
  assert.equal(ranked.some((item) => item.id === "sibling"), true);
  assert.equal(new Set(ranked.map((item) => item.mediaPath)).size, ranked.length);
});

test("kartinka mix does not collapse to one style tag", () => {
  const tags = ["anime", "3d", "piksar", "multyashnoe", "disney", "kollazh"];
  assert.equal(generaciyaKartinkaPerTag(true), 8);
  const columns = tags.map((tag) =>
    [0, 1, 2].map((index) =>
      card({
        id: `${tag}-${index}`,
        style: tag,
        sourceGroupKey: `${tag}::${index}`,
        mediaPath: `${tag}/${index}.jpg`,
      }),
    ),
  );
  const mixed = interleaveGeneraciyaColumns(columns, 3);
  const ranked = rankGeneraciyaFirstScreen(mixed, (item) => item);
  assert.equal(new Set(ranked.slice(0, 6).map((item) => item.style)).size, 6);
});

test("scenario fetch stays inside its own tag", () => {
  const ranked = generaciyaScenarioFetchParams(
    { dimension: "object_tag", tagValue: "s_mashinoy" },
    true,
  );
  assert.equal(ranked.object_tag, "s_mashinoy");
  assert.equal(ranked.audience_tag, null);
  assert.equal(ranked.style_tag, null);
  assert.equal(ranked.occasion_tag, null);
  assert.equal(ranked.doc_task_tag, null);
  assert.equal(ranked.limit, 64);
  assert.equal(ranked.sort, "popular");

  const plain = generaciyaScenarioFetchParams(
    { dimension: "audience_tag", tagValue: "para" },
    false,
  );
  assert.equal(plain.audience_tag, "para");
  assert.equal(plain.limit, 24);

  const popular = generaciyaPopularPageParams({
    dimension: "audience_tag",
    tagValue: "para",
  });
  assert.equal(popular.sort, "popular");
  assert.equal(popular.limit, 24);
  assert.equal(popular.offset, 0);
  assert.equal(popular.audience_tag, "para");
  const hub = generaciyaPopularPageParams(null);
  assert.equal(hub.sort, "popular");
  assert.equal(hub.audience_tag, null);
  assert.equal(hub.style_tag, null);
  assert.equal(plain.sort, "new");
});

test("flags default off and the cache token changes with the rank layer", () => {
  assert.deepEqual(
    parseGeneraciyaSeoImageFlags([{ key: "generaciya_seo_src_1080_enabled", value: "" }]),
    GENERACIYA_SEO_IMAGE_FLAGS_OFF,
  );
  const on = parseGeneraciyaSeoImageFlags([
    { key: "generaciya_seo_first_screen_rank_enabled", value: "true" },
  ]);
  assert.equal(on.firstScreenRank, true);
  assert.notEqual(
    generaciyaSeoImageCacheToken(on),
    generaciyaSeoImageCacheToken(GENERACIYA_SEO_IMAGE_FLAGS_OFF),
  );
});

test("bot log keeps the referer inside the gate and omits the storage path", () => {
  assert.equal(classifyGeneraciyaImageBot("Mozilla Googlebot/2.1"), "googlebot");
  assert.equal(classifyGeneraciyaImageBot("Mozilla YandexBot/3.0"), "yandex");
  assert.equal(classifyGeneraciyaImageBot("Mozilla Chrome"), null);
  assert.equal(
    generaciyaSeoRefererPath(
      "https://promptshot.ru/generaciya/po-foto/pary?utm=1",
      isGeneraciyaSeoImagePath,
    ),
    "/generaciya/po-foto/pary",
  );
  assert.equal(
    generaciyaSeoRefererPath(
      "https://promptshot.ru/p/portret",
      isGeneraciyaSeoImagePath,
    ),
    null,
  );
  const line = generaciyaBotImageLog({
    bot: "yandex",
    outcome: "rewrite",
    variant: "w1080",
    width: 1080,
    quality: 78,
    refererPath: "/generaciya/foto-po-opisaniyu",
  });
  assert.equal(JSON.stringify(line).includes("portrait.jpg"), false);
  assert.equal("cookie" in line, false);
  assert.equal(line.referer_path, "/generaciya/foto-po-opisaniyu");
});

test("frames attach only when a layer is on, and only to the first screen", () => {
  const full = [
    {
      id: "a",
      title_ru: "Портрет у окна",
      title_en: null,
      photoUrls: ["https://cdn.example/a.jpg"],
      photoMeta: [
        {
          url: "https://cdn.example/a.jpg?width=512",
          bucket: "prompt-images",
          path: "a.jpg",
          width: 800,
          height: 1000,
          seoAltRu: STORED_ALT,
        },
      ],
      sourceGroupKey: "a",
      cardSplitTotal: 1,
    },
  ];
  const examples = [{ id: "a", title: "Портрет у окна", isPhotoshoot: false }];
  const off = attachGeneraciyaSeoFrames(
    full,
    examples,
    GENERACIYA_SEO_IMAGE_FLAGS_OFF,
    HEADINGS,
  );
  assert.equal(off[0]?.seoFrame, undefined);

  const on = attachGeneraciyaSeoFrames(
    full,
    examples,
    {
      ...GENERACIYA_SEO_IMAGE_FLAGS_OFF,
      src1080: true,
      singlePass: true,
      descriptiveAlt: true,
    },
    HEADINGS,
  );
  assert.equal(on[0]?.seoFrame?.mode, "both");
  assert.equal(on[0]?.seoFrame?.alts?.[0], STORED_ALT);
  assert.equal(on[0]?.seoFrame?.alts?.[0]?.includes(PAGE_H1), false);
  assert.match(on[0]?.seoFrame?.linkLabel || "", /^Открыть промт «/);
});
