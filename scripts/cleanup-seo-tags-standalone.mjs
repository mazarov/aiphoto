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
  "sumka": "s_sumkoy",
};

// Noise slugs to remove entirely
const NOISE = new Set([
  "s_perchatkami", "s_sergami", "s_ozherelyem", "s_shapkoy",
  "s_krossovkami", "s_shlyapoy", "s_korzetom", "s_varjezhkami",
  "s_brasletami", "s_brasletom", "s_chokerom", "s_kolgotkami",
  "s_bryukami", "v_bryukakh", "v_palto", "v_kurtke", "v_pizhame",
  "v_pidzhake", "s_beretom", "s_koltami", "s_koltsom",
  "s_zolotymi_ukrasheniyami", "s_manikyurem", "s_aksessuarami",
  "s_ukrasheniyami", "krossovki", "s_divanom", "s_oknom",
  "s_stakanom", "s_korzinoj", "s_platye", "s_sumkoy",
  "sohranit_lico", "s_chasami",
]);

// Tags that ended up in wrong dimension
const WRONG_DIM_REMOVE = {
  "style_tag": ["noch", "v_polnyy_rost", "v_interere", "na_ulice"],
  "occasion_tag": ["zima", "otkrytka"],
  "audience_tag": ["s_sobakoy", "s_pitomcem"],
};

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

  const cards = await sbSelect("select=id,seo_tags,seo_readiness_score&seo_readiness_score=gt.0&limit=5000");
  console.log(`📋 ${cards.length} cards to check\n`);

  let changed = 0, aliasFixed = 0, noiseRemoved = 0, wrongDimFixed = 0;

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
        // Wrong dimension removal
        if (WRONG_DIM_REMOVE[dim]?.includes(slug)) {
          wrongDimFixed++;
          dirty = true;
          continue;
        }

        // Noise removal
        if (NOISE.has(slug)) {
          noiseRemoved++;
          dirty = true;
          continue;
        }

        // Alias replacement
        const canonical = ALIASES[slug];
        if (canonical) {
          aliasFixed++;
          dirty = true;
          if (!cleaned.includes(canonical)) cleaned.push(canonical);
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
  console.log(`   Noise removed: ${noiseRemoved}`);
  console.log(`   Wrong dim fixed: ${wrongDimFixed}`);
  console.log(`   Dry run: ${DRY_RUN}`);
}

main().catch(e => { console.error(e); process.exit(1); });
