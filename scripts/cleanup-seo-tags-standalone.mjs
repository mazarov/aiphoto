#!/usr/bin/env node
/**
 * Cleanup seo_tags in prompt_cards:
 * 1. Replace duplicate slugs with canonical ones
 * 2. Remove noise slugs (clothing, accessories, furniture, etc.)
 * 3. Recalculate seo_readiness_score
 *
 * Usage:
 *   node cleanup-seo-tags-standalone.mjs              # run cleanup
 *   node cleanup-seo-tags-standalone.mjs --dry-run    # preview only
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const DIMENSIONS = ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"];

// Duplicate slug → canonical slug (same dimension)
const ALIASES = {
  "glanec": "glyanec",
  "glianec": "glyanec",
  "kolazh": "kollazh",
  "redakcionnoe": "editorial",
  "mužčina": "muzhchina",
  "devuška": "devushka",
  "chernо_beloe": "cherno_beloe",
  "s_iphone": "iphone",
  "s_telefonom": "iphone",
  "smartfon": "iphone",
  "s_mobilnym_telefonom": "iphone",
  "snezhinki": "sneg",
  "snegopad": "sneg",
  "s_snegom": "sneg",
  "loshad": "s_loshadyu",
  "tulipany": "s_tulpanami",
  "svechi": "so_svechami",
  "svecha": "so_svechami",
  "s_svechami": "so_svechami",
  "s_girlyandoy": "s_girlyandami",
  "s_chashkoy": "s_kofe",
  "s_knigami": "s_knigoy",
  "v_lestnitse": "na_lestnice",
  "fotorealistichnoe": "fotorealizm",
  "s_buketom": "s_cvetami",
  "sumka": "s_sumkoy",
};

// Known slugs from tag-registry.ts — only these survive
const KNOWN = new Set([
  "devushka","muzhchina","para","semya","detskie","s_mamoy","s_papoy","s_parnem",
  "s_muzhem","s_podrugoy","s_drugom","s_synom","s_dochkoy","s_sestroy","s_bratom",
  "s_babushkoy","malchik","devochka","podrostok","malysh","pokoleniy","vlyublennykh",
  "s_pitomcem","beremennaya",
  "cherno_beloe","realistichnoe","portret","3d","gta","studiynoe","love_is","delovoe",
  "multyashnoe","kollazh","otkrytka","sovetskoe","retro","anime","polaroid","disney",
  "selfi","piksar","neonovoe","street_style","fashion","glyanec","victorias_secret",
  "barbie","kinematograficheskoe","y2k","lifestyle","vintazhnoe","fotorealizm",
  "minimalizm","vysokaya_moda","editorial","romanticheskiy","bokho_stil","etno_stil",
  "ultrarealistichnoe","giperrealistichnoe","impressionizm","art_deco",
  "produktovaya_fotografiya","fine_art","glam",
  "den_rozhdeniya","8_marta","14_fevralya","23_fevralya","maslenica","novyy_god",
  "svadba","rozhdestvo","halloween",
  "v_forme","s_mashinoy","s_cvetami","so_znamenitostyu","v_profil","s_kotom",
  "v_kostyume","na_chernom_fone","s_tortom","zima","v_zerkale","vesna","s_sobakoy",
  "v_lesu","s_koronoy","na_more","v_polnyy_rost","v_gorah","na_ulice","v_mashine",
  "na_yahte","v_restorane","na_kryshe","v_pustyne","pod_vodoy","v_gorode","s_shuboj",
  "so_svechami","v_platye","s_bokalom","s_kofe","na_avatarku","s_elkoj","s_sharami",
  "na_belom_fone","v_interere","s_podarkami","s_ochkami","noch","s_shuboy",
  "v_basseyne","vintazhnyy_avtomobil","s_medvedem","v_sportale","na_krovati",
  "v_studii","na_naberezhnoj","na_okne","na_balkone","v_metroe","v_lifte","v_parke",
  "osen","leto","v_pole","s_loshadyu",
  "v_spalne","kuhnya","v_sadu","v_vannoy","sneg","dozhd","tuman","zakat",
  "zolotoy_chas","mototsikl","velosiped","s_tulpanami","s_shampanskim","s_zontom",
  "s_knigoy","s_gitaroy","s_tykvoy","s_naushnikami","s_mandarinami","s_girlyandami",
  "iphone","s_samovarom","na_krasnom_fone","na_rozovom_fone","s_maskoy","s_konfetami",
  "s_igrushkoy","na_lestnice","s_zhurnalom","s_pionami","s_valentinkami","s_shokoladkoy",
  "s_otkrytkami","s_serdechkami","s_lentami","na_stole","s_cheburashkoy",
  "na_pasport","na_dokumenty","na_rezume","na_zagranpasport",
]);

const SB_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function sbSelect(query) {
  const url = `${SUPABASE_URL}/rest/v1/prompt_cards?${query}`;
  const res = await fetch(url, { headers: SB_HEADERS });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbUpdate(id, data) {
  const url = `${SUPABASE_URL}/rest/v1/prompt_cards?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: SB_HEADERS,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Supabase update ${res.status}: ${await res.text()}`);
}

function score(tags) {
  let s = 0;
  for (const d of DIMENSIONS) if (tags[d]?.length > 0) s += 20;
  return Math.min(100, s);
}

async function main() {
  console.log(`\n🧹 cleanup-seo-tags [dryRun=${DRY_RUN}]\n`);
  console.log(`   Strategy: whitelist (${KNOWN.size} known) + aliases (${Object.keys(ALIASES).length})\n`);

  const cards = await sbSelect("select=id,seo_tags,seo_readiness_score&seo_readiness_score=gt.0&limit=5000");
  console.log(`📋 ${cards.length} cards to check\n`);

  let changed = 0, aliasFixed = 0, unknownRemoved = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const tags = card.seo_tags;
    if (!tags) continue;

    let dirty = false;
    const newTags = {};

    for (const dim of DIMENSIONS) {
      const arr = tags[dim] || [];
      const cleaned = [];

      for (const slug of arr) {
        // 1. Alias → replace with canonical
        const canonical = ALIASES[slug];
        if (canonical) {
          aliasFixed++;
          dirty = true;
          if (KNOWN.has(canonical) && !cleaned.includes(canonical)) cleaned.push(canonical);
          continue;
        }

        // 2. Whitelist — keep only known tags
        if (!KNOWN.has(slug)) {
          unknownRemoved++;
          dirty = true;
          continue;
        }

        if (!cleaned.includes(slug)) cleaned.push(slug);
      }

      newTags[dim] = cleaned;
    }

    // Preserve labels
    newTags.labels = tags.labels || { ru: [], en: [] };

    if (dirty) {
      const newScore = score(newTags);
      if (!DRY_RUN) {
        await sbUpdate(card.id, { seo_tags: newTags, seo_readiness_score: newScore });
      }
      changed++;
      if (changed <= 5 || changed % 200 === 0) {
        console.log(`  ✅ [${changed}] fixed card ${card.id.slice(0, 8)}...`);
      }
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Cards changed: ${changed}/${cards.length}`);
  console.log(`   Aliases fixed: ${aliasFixed}`);
  console.log(`   Unknown tags removed: ${unknownRemoved}`);
  console.log(`   Dry run: ${DRY_RUN}`);
}

main().catch(e => { console.error(e); process.exit(1); });
