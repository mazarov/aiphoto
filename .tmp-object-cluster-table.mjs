import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)));

const trafficBatches = [
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/foto-na-avatarku"},"metrics":{"ym:s:visits":310}},{"dimensions":{"ym:s:startURLPath":"/mototsikl"},"metrics":{"ym:s:visits":95}},{"dimensions":{"ym:s:startURLPath":"/na-krovati"},"metrics":{"ym:s:visits":56}},{"dimensions":{"ym:s:startURLPath":"/leto"},"metrics":{"ym:s:visits":44}},{"dimensions":{"ym:s:startURLPath":"/dozhd"},"metrics":{"ym:s:visits":40}},{"dimensions":{"ym:s:startURLPath":"/na-chernom-fone"},"metrics":{"ym:s:visits":27}},{"dimensions":{"ym:s:startURLPath":"/kuhnya"},"metrics":{"ym:s:visits":16}},{"dimensions":{"ym:s:startURLPath":"/iphone"},"metrics":{"ym:s:visits":15}},{"dimensions":{"ym:s:startURLPath":"/na-krasnom-fone"},"metrics":{"ym:s:visits":14}},{"dimensions":{"ym:s:startURLPath":"/na-belom-fone"},"metrics":{"ym:s:visits":13}},{"dimensions":{"ym:s:startURLPath":"/na-balkone"},"metrics":{"ym:s:visits":6}},{"dimensions":{"ym:s:startURLPath":"/na-kryshe"},"metrics":{"ym:s:visits":1}}]},
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/osen"},"metrics":{"ym:s:visits":1912}},{"dimensions":{"ym:s:startURLPath":"/na-more"},"metrics":{"ym:s:visits":270}},{"dimensions":{"ym:s:startURLPath":"/na-yahte"},"metrics":{"ym:s:visits":34}},{"dimensions":{"ym:s:startURLPath":"/pod-vodoy"},"metrics":{"ym:s:visits":27}},{"dimensions":{"ym:s:startURLPath":"/s-bokalom"},"metrics":{"ym:s:visits":22}},{"dimensions":{"ym:s:startURLPath":"/na-ulice"},"metrics":{"ym:s:visits":16}},{"dimensions":{"ym:s:startURLPath":"/na-lestnice"},"metrics":{"ym:s:visits":10}},{"dimensions":{"ym:s:startURLPath":"/na-okne"},"metrics":{"ym:s:visits":9}},{"dimensions":{"ym:s:startURLPath":"/noch"},"metrics":{"ym:s:visits":8}},{"dimensions":{"ym:s:startURLPath":"/na-stole"},"metrics":{"ym:s:visits":5}},{"dimensions":{"ym:s:startURLPath":"/na-naberezhnoj"},"metrics":{"ym:s:visits":1}}]},
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/s-cvetami"},"metrics":{"ym:s:visits":64}},{"dimensions":{"ym:s:startURLPath":"/s-kotom"},"metrics":{"ym:s:visits":38}},{"dimensions":{"ym:s:startURLPath":"/s-girlyandami"},"metrics":{"ym:s:visits":35}},{"dimensions":{"ym:s:startURLPath":"/s-kofe"},"metrics":{"ym:s:visits":27}},{"dimensions":{"ym:s:startURLPath":"/s-knigoy"},"metrics":{"ym:s:visits":11}},{"dimensions":{"ym:s:startURLPath":"/s-gitaroy"},"metrics":{"ym:s:visits":8}},{"dimensions":{"ym:s:startURLPath":"/s-koronoy"},"metrics":{"ym:s:visits":8}},{"dimensions":{"ym:s:startURLPath":"/s-cheburashkoy"},"metrics":{"ym:s:visits":3}},{"dimensions":{"ym:s:startURLPath":"/s-konfetami"},"metrics":{"ym:s:visits":3}},{"dimensions":{"ym:s:startURLPath":"/s-igrushkoy"},"metrics":{"ym:s:visits":2}}]},
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/s-mashinoy"},"metrics":{"ym:s:visits":774}},{"dimensions":{"ym:s:startURLPath":"/s-loshadyu"},"metrics":{"ym:s:visits":92}},{"dimensions":{"ym:s:startURLPath":"/s-pitomcem"},"metrics":{"ym:s:visits":53}},{"dimensions":{"ym:s:startURLPath":"/s-medvedem"},"metrics":{"ym:s:visits":41}},{"dimensions":{"ym:s:startURLPath":"/s-ochkami"},"metrics":{"ym:s:visits":26}},{"dimensions":{"ym:s:startURLPath":"/s-pionami"},"metrics":{"ym:s:visits":8}},{"dimensions":{"ym:s:startURLPath":"/s-maskoy"},"metrics":{"ym:s:visits":7}},{"dimensions":{"ym:s:startURLPath":"/s-lentami"},"metrics":{"ym:s:visits":2}},{"dimensions":{"ym:s:startURLPath":"/s-mandarinami"},"metrics":{"ym:s:visits":2}},{"dimensions":{"ym:s:startURLPath":"/s-naushnikami"},"metrics":{"ym:s:visits":1}}]},
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/s-shampanskim"},"metrics":{"ym:s:visits":175}},{"dimensions":{"ym:s:startURLPath":"/s-tortom"},"metrics":{"ym:s:visits":95}},{"dimensions":{"ym:s:startURLPath":"/s-sobakoj"},"metrics":{"ym:s:visits":25}},{"dimensions":{"ym:s:startURLPath":"/s-tykvoy"},"metrics":{"ym:s:visits":10}},{"dimensions":{"ym:s:startURLPath":"/s-serdechkami"},"metrics":{"ym:s:visits":6}},{"dimensions":{"ym:s:startURLPath":"/s-sharami"},"metrics":{"ym:s:visits":6}},{"dimensions":{"ym:s:startURLPath":"/s-shokoladkoy"},"metrics":{"ym:s:visits":1}},{"dimensions":{"ym:s:startURLPath":"/s-shuboj"},"metrics":{"ym:s:visits":1}}]},
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/v-forme"},"metrics":{"ym:s:visits":828}},{"dimensions":{"ym:s:startURLPath":"/v-gorah"},"metrics":{"ym:s:visits":76}},{"dimensions":{"ym:s:startURLPath":"/so-svechami"},"metrics":{"ym:s:visits":39}},{"dimensions":{"ym:s:startURLPath":"/v-basseyne"},"metrics":{"ym:s:visits":34}},{"dimensions":{"ym:s:startURLPath":"/so-znamenitostyu"},"metrics":{"ym:s:visits":10}},{"dimensions":{"ym:s:startURLPath":"/v-gorode"},"metrics":{"ym:s:visits":6}},{"dimensions":{"ym:s:startURLPath":"/s-zontom"},"metrics":{"ym:s:visits":5}},{"dimensions":{"ym:s:startURLPath":"/v-interere"},"metrics":{"ym:s:visits":4}},{"dimensions":{"ym:s:startURLPath":"/tuman"},"metrics":{"ym:s:visits":1}}]},
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/v-mashine"},"metrics":{"ym:s:visits":224}},{"dimensions":{"ym:s:startURLPath":"/v-lesu"},"metrics":{"ym:s:visits":81}},{"dimensions":{"ym:s:startURLPath":"/v-kostyume"},"metrics":{"ym:s:visits":74}},{"dimensions":{"ym:s:startURLPath":"/v-platye"},"metrics":{"ym:s:visits":26}},{"dimensions":{"ym:s:startURLPath":"/v-pole"},"metrics":{"ym:s:visits":23}},{"dimensions":{"ym:s:startURLPath":"/v-lifte"},"metrics":{"ym:s:visits":22}},{"dimensions":{"ym:s:startURLPath":"/v-parke"},"metrics":{"ym:s:visits":14}},{"dimensions":{"ym:s:startURLPath":"/v-profil"},"metrics":{"ym:s:visits":13}},{"dimensions":{"ym:s:startURLPath":"/v-pustyne"},"metrics":{"ym:s:visits":12}},{"dimensions":{"ym:s:startURLPath":"/v-restorane"},"metrics":{"ym:s:visits":11}},{"dimensions":{"ym:s:startURLPath":"/v-polnyy-rost"},"metrics":{"ym:s:visits":6}},{"dimensions":{"ym:s:startURLPath":"/v-metroe"},"metrics":{"ym:s:visits":3}}]},
  {"rows":[{"dimensions":{"ym:s:startURLPath":"/v-zerkale"},"metrics":{"ym:s:visits":169}},{"dimensions":{"ym:s:startURLPath":"/v-sportale"},"metrics":{"ym:s:visits":155}},{"dimensions":{"ym:s:startURLPath":"/v-vannoy"},"metrics":{"ym:s:visits":35}},{"dimensions":{"ym:s:startURLPath":"/zakat"},"metrics":{"ym:s:visits":26}},{"dimensions":{"ym:s:startURLPath":"/velosiped"},"metrics":{"ym:s:visits":15}},{"dimensions":{"ym:s:startURLPath":"/zima"},"metrics":{"ym:s:visits":9}},{"dimensions":{"ym:s:startURLPath":"/v-sadu"},"metrics":{"ym:s:visits":3}},{"dimensions":{"ym:s:startURLPath":"/v-studii"},"metrics":{"ym:s:visits":3}},{"dimensions":{"ym:s:startURLPath":"/v-spalne"},"metrics":{"ym:s:visits":2}},{"dimensions":{"ym:s:startURLPath":"/zolotoy-chas"},"metrics":{"ym:s:visits":2}},{"dimensions":{"ym:s:startURLPath":"/vintazhnyy-avtomobil"},"metrics":{"ym:s:visits":1}}]},
];

const traffic = new Map();
for (const batch of trafficBatches) {
  for (const row of batch.rows) {
    traffic.set(row.dimensions["ym:s:startURLPath"], row.metrics["ym:s:visits"]);
  }
}

const paymentData = JSON.parse(readFileSync(join(root, ".tmp-object-cluster-traffic.json"), "utf8"));
const payMap = new Map(paymentData.payments.byLandingPath.map((p) => [p.path, p.payments]));

const out = execSync(
  `npx tsx -e "import { TAG_REGISTRY } from './src/lib/tag-registry.ts'; import { getSeoForRoute } from './src/lib/seo-templates.ts'; const tags = TAG_REGISTRY.filter(t => t.dimension === 'object_tag'); console.log(JSON.stringify(tags));"`,
  { cwd: join(root, "landing"), encoding: "utf8" },
);
const tags = JSON.parse(out.trim());

const rows = tags.map((tag) => {
  const route = {
    tags: [tag],
    level: 1,
    rpcParams: {
      audience_tag: null,
      style_tag: null,
      occasion_tag: null,
      object_tag: tag.slug,
      doc_task_tag: null,
    },
    canonicalPath: tag.urlPath,
    parentPath: null,
    primaryTag: tag,
  };
  const seo = getSeoForRoute(route);
  return {
    url: "https://promptshot.ru" + tag.urlPath,
    h1: seo.h1,
    visits: traffic.get(tag.urlPath) || 0,
    payments: payMap.get(tag.urlPath) || 0,
  };
});

// getSeoForRoute can't run in exec like that - the script above won't work for h1
// Use tsx script inline instead
