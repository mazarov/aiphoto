/**
 * Discover new tags that LLM suggests beyond TAG_REGISTRY.
 * Uses open-ended classification (no enum constraint) with noise filters.
 *
 * Usage: npx tsx src/discover-new-tags.ts --limit 10
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { config as loadDotenv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TAG_REGISTRY } from "../landing/src/lib/tag-registry";

const DIMS = ["audience_tag", "style_tag", "occasion_tag", "object_tag", "doc_task_tag"] as const;

const KNOWN_SLUGS = new Set(TAG_REGISTRY.map((t) => t.slug));

const SYSTEM_PROMPT = `You are a photo prompt classifier for an SEO-driven photo prompt catalog.

Given a prompt (title + text), assign ALL relevant tags across 5 dimensions.

Return slug arrays (latin snake_case). You may create NEW slugs beyond the known list if the prompt clearly describes a scene/object/style not covered.

DIMENSIONS:
- audience_tag: WHO is in the photo (gender, age, relationships). Examples: devushka, muzhchina, para, semya, s_mamoy, s_dochkoy, rebyonok
- style_tag: VISUAL STYLE or shooting technique. Examples: portret, realistichnoe, cherno_beloe, fashion, retro, kinematograficheskoe, studiynoe
- object_tag: KEY OBJECTS, LOCATIONS, CLOTHING CATEGORY, ACCESSORIES. Examples: zima, v_lesu, s_cvetami, v_platye, na_divane, v_lifte, s_sharami
- occasion_tag: HOLIDAYS or EVENTS. Examples: novyy_god, den_rozhdeniya, svadba, 14_fevralya
- doc_task_tag: PURPOSE of the photo. Examples: na_pasport, na_avatarku, na_rezume

GOOD TAG CRITERIA:
- A user would SEARCH for it in Yandex/Google: "photo prompt in elevator" YES, "photo prompt pink sweater" NO
- Applies to 10+ different prompts, not unique to one photo
- Represents a SCENE, LOCATION, KEY OBJECT, or STYLE — not a color of clothing, not a camera parameter

DO NOT create tags for:
- Specific clothing items or colors (chernyy_top, rozovyy_sviter, dzhinsy, krasnyy_kardigan)
- Camera/technical parameters (8k, raw, canon_85mm, malaya_glubina_rezkosti, bokeh)
- Generation instructions (bez_retushi, bez_sglazhivaniya, sohranit_vneshnost, bez_stilizatsii)
- Appearance details (raspushchennye_volosy, naturalnyy_makiyazh, siyanie_kozhi)
- Textures and micro-details (pory_dereva, volokna_tkani, pushkovye_voloski)
- Lighting/shadow descriptions (myagkiy_svet, kontrastnyy_svet, glubokie_teni)
- Emotional expressions (spokoynaya_ulybka, zagadochnyy_vzglyad)
- Pose descriptions (ruka_nad_golovoy, lezhachaya_poza, vzglyad_v_kameru)

Keep tags at the level of abstraction shown in the examples above. When in doubt, skip the tag.`;

function loadEnvFiles() {
  const cwd = process.cwd();
  for (const p of [".env", ".env.local", "landing/.env.local", "../.env", "../.env.local"]) {
    const full = path.resolve(cwd, p);
    if (existsSync(full)) loadDotenv({ path: full, override: false });
  }
}

async function classify(apiKey: string, title: string | null, text: string) {
  const userText = [title ? `Title: ${title}` : "", `Prompt: ${text}`].filter(Boolean).join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userText }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: Object.fromEntries(
              DIMS.map((d) => [d, { type: "ARRAY", items: { type: "STRING" } }])
            ),
            required: [...DIMS],
          },
          maxOutputTokens: 512,
          temperature: 0.1,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    console.error(`  ERR ${res.status}: ${t.slice(0, 120)}`);
    return null;
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) return null;

  const jsonStr = raw.includes("{") ? raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1) : raw;
  return JSON.parse(jsonStr) as Record<string, string[]>;
}

async function main() {
  loadEnvFiles();

  const limit = parseInt(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "", 10);
  const cardLimit = Number.isFinite(limit) && limit > 0 ? limit : (() => {
    const idx = process.argv.indexOf("--limit");
    return idx >= 0 ? parseInt(process.argv[idx + 1] || "10", 10) : 10;
  })();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const sbUrl = process.env.SUPABASE_SUPABASE_PUBLIC_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const sb = createClient(sbUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  console.log(`\n🔍 Discovering new tags (limit=${cardLimit})\n`);

  const { data: cards } = await sb
    .from("prompt_cards")
    .select("id,title_ru")
    .eq("is_published", true)
    .order("source_date", { ascending: false })
    .limit(cardLimit);

  const ids = (cards || []).map((c: { id: string }) => c.id);
  const { data: variants } = await sb
    .from("prompt_variants")
    .select("card_id,prompt_text_ru")
    .in("card_id", ids)
    .order("variant_index", { ascending: true });

  const prompts = new Map<string, string>();
  for (const v of (variants || []) as { card_id: string; prompt_text_ru: string | null }[]) {
    if (v.prompt_text_ru && !prompts.has(v.card_id)) prompts.set(v.card_id, v.prompt_text_ru);
  }

  const newTags: Record<string, number> = {};
  let processed = 0;

  for (let i = 0; i < (cards || []).length; i++) {
    const card = (cards as { id: string; title_ru: string | null }[])[i];
    const text = prompts.get(card.id);
    if (!text) continue;
    if (i > 0) await new Promise((r) => setTimeout(r, 2000));

    const result = await classify(apiKey, card.title_ru, text);
    if (!result) continue;
    processed++;

    const allNew: string[] = [];
    const existing: string[] = [];
    for (const dim of DIMS) {
      for (const slug of result[dim] || []) {
        if (KNOWN_SLUGS.has(slug)) existing.push(slug);
        else {
          const key = `${dim}:${slug}`;
          allNew.push(key);
          newTags[key] = (newTags[key] || 0) + 1;
        }
      }
    }

    console.log(`📸 ${card.title_ru || "?"}`);
    console.log(`   ✓ Known: ${existing.join(", ")}`);
    if (allNew.length > 0) console.log(`   🆕 NEW:  ${allNew.join(", ")}`);
    else console.log(`   (no new tags)`);
    console.log();
  }

  const sorted = Object.entries(newTags).sort((a, b) => b[1] - a[1]);
  console.log(`\n=== НОВЫЕ ТЕГИ (${sorted.length} unique, ${processed} cards) ===`);
  for (const [tag, cnt] of sorted) {
    console.log(`  ${String(cnt).padStart(3)}x  ${tag}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
