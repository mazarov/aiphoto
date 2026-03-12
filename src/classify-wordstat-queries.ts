import * as fs from "fs";
import * as path from "path";

// Cyrillic word-boundary helpers (JS \b doesn't work with Cyrillic)
const C = `а-яёА-ЯЁ`;
const NB = `(?<![${C}])`;  // not preceded by Cyrillic
const NA = `(?![${C}])`;   // not followed by Cyrillic

function cyr(pattern: string): RegExp {
  return new RegExp(pattern, "i");
}

const AUDIENCE: [string, RegExp, string][] = [
  ["devushka", /девуш|женщин|женск/i, "/promty-dlya-foto-devushki/"],
  ["muzhchina", cyr(`мужчин|мужск|${NB}парень`), "/promty-dlya-foto-muzhchiny/"],
  ["para", cyr(`${NB}пар${NA}|парн(?:ый|ое|ых)|парных|парное|вдвоем|двоих|совместн|для двоих`), "/promty-dlya-foto-par/"],
  ["semya", /семь|семейн/i, "/promty-dlya-semejnogo-foto/"],
  ["detskie", /детск|ребен|ребёнк|для детей/i, "/promty-dlya-detskih-foto/"],
  ["s_mamoy", /с мамой|мамы|мама|матер/i, "/promty-dlya-foto-s-mamoy/"],
  ["s_papoy", /с папой|папа|отца|отец|с отцом/i, "/promty-dlya-foto-s-papoy/"],
  ["s_parnem", /с парнем/i, "/promty-dlya-foto-s-parnem/"],
  ["s_muzhem", cyr(`с мужем|${NB}муж${NA}`), "/promty-dlya-foto-s-muzhem/"],
  ["s_podrugoy", /с подруг/i, "/promty-dlya-foto-s-podrugoy/"],
  ["s_drugom", cyr(`с другом|друзь|${NB}друг${NA}`), "/promty-dlya-foto-s-drugom/"],
  ["s_synom", /с сыном|сына/i, "/promty-dlya-foto-s-synom/"],
  ["s_dochkoy", /с дочк|с дочер|дочери|дочь/i, "/promty-dlya-foto-s-dochkoy/"],
  ["s_sestroy", /с сестр|сестер/i, "/promty-dlya-foto-s-sestroy/"],
  ["s_bratom", cyr(`с братом|${NB}брат${NA}`), "/promty-dlya-foto-s-bratom/"],
  ["s_babushkoy", /бабушк|бабуш|с бабушк|внук/i, "/promty-dlya-foto-s-babushkoy/"],
  ["malchik", /мальчик/i, "/promty-dlya-foto-malchika/"],
  ["devochka", /девочк/i, "/promty-dlya-foto-devochki/"],
  ["podrostok", /подросток|подростк/i, "/promty-dlya-foto-podrostka/"],
  ["malysh", /малыш|младен|новорожд/i, "/promty-dlya-foto-malysha/"],
  ["pokoleniy", /поколен/i, "/promty-dlya-foto-pokoleniy/"],
  ["vlyublennykh", /влюблен|влюблён/i, "/promty-dlya-foto-vlyublennykh/"],
  ["s_pitomcem", /с питомц|с животн|питомц/i, "/promty-dlya-foto-s-pitomcem/"],
];

const STYLE: [string, RegExp, string][] = [
  ["cherno_beloe", cyr(`черно[-\\s]?бел|чёрно[-\\s]?бел|ч\\/б|${NB}чб${NA}|монохром`), "/stil/cherno-beloe/"],
  ["realistichnoe", /реалист/i, "/stil/realistichnoe/"],
  ["portret", /портрет/i, "/stil/portret/"],
  ["3d", /3[дd]|3d/i, "/stil/3d/"],
  ["gta", cyr(`${NB}гта${NA}|\\bgta\\b`), "/stil/gta/"],
  ["studiynoe", /студийн|в студии/i, "/stil/studiynoe/"],
  ["love_is", /love\s*is|лав\s*ис|лов\s*ис|лов\s*из|лав\s*из|любовь\s*это/i, "/stil/love-is/"],
  ["delovoe", /делов|бизнес|офисн|корпоратив/i, "/stil/delovoe/"],
  ["multyashnoe", /мульт(?:яш|ик|фильм)/i, "/stil/multyashnoe/"],
  ["kollazh", /коллаж/i, "/stil/kollazh/"],
  ["otkrytka", /открытк/i, "/stil/otkrytka/"],
  ["sovetskoe", /совет|ссср/i, "/stil/sovetskoe/"],
  ["retro", /ретро|винтаж|90[-\s]?[хx]|старом стил/i, "/stil/retro/"],
  ["anime", /аниме/i, "/stil/anime/"],
  ["polaroid", /полароид|polaroid/i, "/stil/polaroid/"],
  ["disney", /дисней|disney/i, "/stil/disney/"],
  ["selfi", /селфи|selfie/i, "/stil/selfi/"],
  ["piksar", /пиксар|pixar/i, "/stil/piksar/"],
];

const OCCASION: [string, RegExp, string][] = [
  ["den_rozhdeniya", cyr(`день\\s*рожден|на\\s*др${NA}|юбилей|30\\s*лет|70\\s*лет`), "/sobytiya/den-rozhdeniya/"],
  ["23_fevralya", /23\s*феврал|день\s*защитн|защитника\s*отечества/i, "/sobytiya/23-fevralya/"],
  ["14_fevralya", /14\s*феврал|валентин|день\s*влюбл/i, "/sobytiya/14-fevralya/"],
  ["maslenica", /маслениц/i, "/sobytiya/maslenica/"],
  ["8_marta", /8\s*март/i, "/sobytiya/8-marta/"],
  ["svadba", /свадьб|свадеб/i, "/sobytiya/svadba/"],
  ["novyy_god", /новый\s*год|новогод|рождеств/i, "/sobytiya/novyj-god/"],
];

const OBJECT: [string, RegExp, string][] = [
  ["v_forme", cyr(`в\\s*форм|военн|солдат|${NB}сво${NA}|офицер|генерал`), "/v-forme/"],
  ["s_mashinoy", /с\s*машин|авто|тачк|автомобил|за\s*рулем|бмв|геликом/i, "/s-mashinoy/"],
  ["s_cvetami", cyr(`с\\s*цвет|букет|тюльпан|${NB}роз${NA}|пион|мимоз`), "/s-cvetami/"],
  ["so_znamenitostyu", /со?\s*знаменит|с\s*кумир|со?\s*звезд|с\s*актер|с\s*путин|эпштейн|с\s*месси|с\s*чебурашк|с\s*роналду|михаилом\s*кругом|макгрегор|с\s*михаилом|жириновск|известн/i, "/so-znamenitostyu/"],
  ["v_profil", /в\s*профиль|боком/i, "/v-profil/"],
  ["s_kotom", /с\s*кот|кош|с\s*кошк/i, "/s-kotom/"],
  ["v_kostyume", /в\s*костюм|в\s*пиджак|в\s*деловом\s*костюме/i, "/v-kostyume/"],
  ["na_chernom_fone", /на\s*черн\w*\s*фон|черный\s*фон/i, "/na-chernom-fone/"],
  ["s_tortom", /с\s*торт|торта/i, "/s-tortom/"],
  ["zima", /зимн|снег|заснеж|горнолыж|сноуборд|лыж/i, "/zimnie/"],
  ["v_zerkale", /в\s*зеркал/i, "/v-zerkale/"],
  ["vesna", /весенн|весна/i, "/vesennie/"],
  ["s_sobakoy", cyr(`с\\s*собак|${NB}пёс${NA}|${NB}пес${NA}|доберман`), "/s-sobakoj/"],
  ["s_putinym", /путин/i, "/s-putinym/"],
  ["v_lesu", /в\s*лес/i, "/v-lesu/"],
  ["s_koronoy", /с\s*корон/i, "/s-koronoj/"],
  ["na_more", /на\s*мор|пляж|мальдив|на\s*байкал/i, "/na-more/"],
  ["v_polnyy_rost", /в\s*полный\s*рост/i, "/v-polnyj-rost/"],
  ["v_gorah", /в\s*гор/i, "/v-gorah/"],
  ["na_ulice", /на\s*улиц/i, "/na-ulice/"],
];

const DOC_TASK: [string, RegExp, string][] = [
  ["na_pasport", /на\s*паспорт/i, "/foto-na-pasport/"],
  ["na_dokumenty", /на\s*документ|удостоверен|на\s*пропуск/i, "/foto-na-dokumenty/"],
  ["na_avatarku", cyr(`на\\s*аватарк|на\\s*аву${NA}|аватар`), "/foto-na-avatarku/"],
  ["na_rezume", /на\s*резюме|для\s*резюме/i, "/foto-na-rezume/"],
  ["na_zagranpasport", /на\s*загранпаспорт|загран/i, "/foto-na-zagranpasport/"],
];

const STATIC_HUBS: [RegExp, string, string][] = [
  // intent_action hubs only (tool_tag and intent_modifier removed)
  [/оживлен|оживи|оживл|анимир|анимац|живых?\s*фото|живое\s*фото/i, "intent_action=ozhivlenie", "/promty-dlya-ozhivleniya-foto/"],
  [/реставр|восстанов|старых?\s*фото|старого?\s*фото|старое\s*фото|колоризац/i, "intent_action=restavratsiya", "/promty-dlya-restavracii-foto/"],
  [/замен\w*\s*лиц|заменить\s*лиц|заменить\s*человек|замена\s*лиц|добавить\s*человек|убрать\s*человек|удалить\s*человек/i, "intent_action=zamena_lica", "/promty-dlya-zameny-lica/"],
  [/замен\w*\s*фон|заменить\s*фон|поменять\s*фон|изменени\w*\s*фон|фон\s*для\s*фото|фон\s*на\s*фото/i, "intent_action=zamena_fona", "/promty-dlya-zameny-fona/"],
  [/видео/i, "intent_action=video", "/promty-dlya-video-iz-foto/"],
  [/фотосесс/i, "intent_action=fotosessiya", "/promty-dlya-fotosessii/"],
  [/улучш|апскейл|повыш\w*\s*качеств/i, "intent_action=uluchshenie", "/promty-dlya-uluchsheniya-foto/"],
  [/обработ|редактир|редактор|ретуш|коррекц|редакц|обработк|переделк|преобразов|стилиз|фильтр|эффект|отредактир|изменить|изменяющ|изменяем|изменяет|изменённ|изменени/i, "intent_action=obrabotka", "/promty-dlya-obrabotki-foto/"],
  [/коллаж|объедин|соедин/i, "intent_action=kollazh", "/promty-dlya-kollazha/"],
  [/создан|сделать|создать|сгенерир|генерац|генерир|генератор/i, "intent_action=sozdanie", "/promty-dlya-sozdaniya-foto/"],
];

function parseWordstatFile(filePath: string): { query: string; volume: number }[] {
  const raw = fs.readFileSync(filePath, "utf-8").trim();
  const parts = raw.split(";");
  const results: { query: string; volume: number }[] = [];

  let i = 0;
  while (i < parts.length - 1) {
    const rawCandidate = parts[i];
    const volStr = parts[i + 1]?.replace(/[\r\n]/g, "").trim();
    const vol = parseInt(volStr, 10);

    if (!isNaN(vol) && vol > 0) {
      let q = rawCandidate.replace(/[\r\n]/g, " ").trim();
      if (/^Запросы со словами$/i.test(q) || /^Число запросов$/i.test(q)) {
        i += 2;
        continue;
      }
      // Header + first query concatenated via \r: split on "все устройства"
      if (/Топ частотных запросов/i.test(q)) {
        const m = q.match(/все устройства\s*(.+)$/i);
        q = m ? m[1].trim() : "";
      }
      if (q && q.length > 2) {
        results.push({ query: q, volume: vol });
      }
      i += 2;
    } else {
      i += 1;
    }
  }
  return results;
}

function classifyQuery(q: string): {
  contentDims: { dim: string; value: string; url: string }[];
  staticHub: { dim: string; url: string } | null;
} {
  const contentDims: { dim: string; value: string; url: string }[] = [];
  let staticHub: { dim: string; url: string } | null = null;

  for (const [val, rx, url] of AUDIENCE) {
    if (rx.test(q)) { contentDims.push({ dim: "audience_tag", value: val, url }); break; }
  }
  for (const [val, rx, url] of STYLE) {
    if (rx.test(q)) { contentDims.push({ dim: "style_tag", value: val, url }); break; }
  }
  for (const [val, rx, url] of OCCASION) {
    if (rx.test(q)) { contentDims.push({ dim: "occasion_tag", value: val, url }); break; }
  }
  for (const [val, rx, url] of OBJECT) {
    if (rx.test(q)) { contentDims.push({ dim: "object_tag", value: val, url }); break; }
  }
  for (const [val, rx, url] of DOC_TASK) {
    if (rx.test(q)) { contentDims.push({ dim: "doc_task_tag", value: val, url }); break; }
  }

  if (contentDims.length === 0) {
    for (const [rx, dim, url] of STATIC_HUBS) {
      if (rx.test(q)) { staticHub = { dim, url }; break; }
    }
  }

  if (contentDims.length === 0 && !staticHub) {
    staticHub = { dim: "homepage", url: "/" };
  }

  return { contentDims, staticHub };
}

function buildLandingUrl(dims: { dim: string; value: string; url: string }[]): string {
  if (dims.length === 0) return "/";
  if (dims.length === 1) return dims[0].url;

  const priority = ["audience_tag", "occasion_tag", "doc_task_tag", "style_tag", "object_tag"];
  dims.sort((a, b) => priority.indexOf(a.dim) - priority.indexOf(b.dim));

  const primary = dims[0].url;
  const secondSlug = dims[1].url.replace(/^\//, "").replace(/\/$/, "").split("/").pop()!;
  return primary.replace(/\/$/, "") + "/" + secondSlug + "/";
}

function main() {
  const wordstatDir = path.resolve(__dirname, "../docs/wordstat");
  const files = fs.readdirSync(wordstatDir).filter((f) => f.endsWith(".csv"));

  const allQueries: { query: string; volume: number; source: string }[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const parsed = parseWordstatFile(path.join(wordstatDir, file));
    for (const p of parsed) {
      const key = p.query.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allQueries.push({ ...p, source: file });
      }
    }
  }

  allQueries.sort((a, b) => b.volume - a.volume);

  const rows: string[] = [];
  rows.push(
    [
      "query",
      "volume",
      "landing_url",
      "page_type",
      "matched_dimensions",
      "matched_values",
      "source_file",
    ].join("\t")
  );

  const stats = {
    total: allQueries.length,
    programmatic_L1: 0,
    programmatic_L2: 0,
    programmatic_L3: 0,
    static_hub: 0,
    homepage: 0,
    unclassified: 0,
  };

  for (const { query, volume, source } of allQueries) {
    const { contentDims, staticHub } = classifyQuery(query);

    let landingUrl: string;
    let pageType: string;
    let matchedDimensions: string;
    let matchedValues: string;

    if (contentDims.length > 0) {
      landingUrl = buildLandingUrl(contentDims);
      pageType =
        contentDims.length === 1
          ? "programmatic_L1"
          : contentDims.length === 2
          ? "programmatic_L2"
          : "programmatic_L3";
      matchedDimensions = contentDims.map((d) => d.dim).join("+");
      matchedValues = contentDims.map((d) => d.value).join("+");
    } else if (staticHub) {
      landingUrl = staticHub.url;
      pageType = staticHub.url === "/" ? "homepage" : "static_hub";
      matchedDimensions = staticHub.dim;
      matchedValues = staticHub.dim;
    } else {
      landingUrl = "/";
      pageType = "unclassified";
      matchedDimensions = "—";
      matchedValues = "—";
    }

    if (pageType === "programmatic_L1") stats.programmatic_L1++;
    else if (pageType === "programmatic_L2") stats.programmatic_L2++;
    else if (pageType === "programmatic_L3") stats.programmatic_L3++;
    else if (pageType === "static_hub") stats.static_hub++;
    else if (pageType === "homepage") stats.homepage++;
    else stats.unclassified++;

    rows.push(
      [query, volume, landingUrl, pageType, matchedDimensions, matchedValues, source].join("\t")
    );
  }

  const outPath = path.resolve(__dirname, "../docs/11-03-seo-url-query-mapping.csv");
  fs.writeFileSync(outPath, rows.join("\n"), "utf-8");

  console.log("=== Classification Stats ===");
  console.log(`Total unique queries: ${stats.total}`);
  console.log(`Programmatic L1: ${stats.programmatic_L1}`);
  console.log(`Programmatic L2: ${stats.programmatic_L2}`);
  console.log(`Programmatic L3: ${stats.programmatic_L3}`);
  console.log(`Static hub: ${stats.static_hub}`);
  console.log(`Homepage: ${stats.homepage}`);
  console.log(`Unclassified: ${stats.unclassified}`);
  console.log(`\nWritten to: ${outPath}`);
}

main();
