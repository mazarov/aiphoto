import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase";
import { getSupabaseUserForApiRoute } from "@/lib/supabase-route-auth";
import { TAG_REGISTRY, type Dimension } from "@/lib/tag-registry";

const ALLOWED_ACCENTS = ["scene", "lighting", "mood", "composition"] as const;
type PromptAccent = (typeof ALLOWED_ACCENTS)[number];
const VIBE_PUBLISH_DATASET_SLUG = "steal_this_vibe_extension";
const VIBE_PUBLISH_CHANNEL = "Steal This Vibe Extension";
const SEO_DIMS: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

type StyleJson = Record<string, unknown>;

function flattenStyleText(value: unknown, depth = 0): string[] {
  if (depth > 4 || value == null) return [];
  if (typeof value === "string") return [value.trim()];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => flattenStyleText(item, depth + 1));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      flattenStyleText(item, depth + 1),
    );
  }
  return [];
}

function inferSeoTagsFromStyle(style: StyleJson | null): Record<Dimension, string[]> {
  const empty: Record<Dimension, string[]> = {
    audience_tag: [],
    style_tag: [],
    occasion_tag: [],
    object_tag: [],
    doc_task_tag: [],
  };
  if (!style) return empty;

  const styleText = flattenStyleText(style)
    .map((part) => part.toLowerCase())
    .filter(Boolean)
    .join(" ; ");

  if (!styleText) return empty;

  const matchedByDim: Record<Dimension, Set<string>> = {
    audience_tag: new Set<string>(),
    style_tag: new Set<string>(),
    occasion_tag: new Set<string>(),
    object_tag: new Set<string>(),
    doc_task_tag: new Set<string>(),
  };

  for (const entry of TAG_REGISTRY) {
    if (entry.patterns.some((pattern) => pattern.test(styleText))) {
      matchedByDim[entry.dimension].add(entry.slug);
    }
  }

  const result: Record<Dimension, string[]> = {
    audience_tag: [],
    style_tag: [],
    occasion_tag: [],
    object_tag: [],
    doc_task_tag: [],
  };
  for (const dim of SEO_DIMS) {
    result[dim] = Array.from(matchedByDim[dim]).slice(0, 6);
  }
  return result;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mergeSeoTags(
  existingRaw: unknown,
  autoRaw: Record<Dimension, string[]>,
): Record<string, unknown> {
  const existing = toRecord(existingRaw);
  const merged: Record<string, unknown> = { ...existing };

  for (const dim of SEO_DIMS) {
    const existingArr = Array.isArray(existing[dim])
      ? (existing[dim] as unknown[])
          .map((v) => String(v || "").trim())
          .filter(Boolean)
      : [];
    const autoArr = autoRaw[dim] || [];
    const uniq = Array.from(new Set([...existingArr, ...autoArr]));
    if (uniq.length) merged[dim] = uniq.slice(0, 8);
  }

  return merged;
}

function toErrorMeta(err: unknown) {
  if (!(err instanceof Error)) return { message: String(err) };
  const withCause = err as Error & { cause?: { code?: string; errno?: number } };
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    causeCode: withCause.cause?.code,
    causeErrno: withCause.cause?.errno,
  };
}

function toCardUrl(slug: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://promptshot.ru";
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/p/${slug}`;
}

function buildCardTitle(prompt: string, accent: PromptAccent): string {
  const normalized = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Steal This Vibe";
  const short = normalized.length > 90 ? `${normalized.slice(0, 87).trim()}...` : normalized;
  const accentLabel =
    accent === "scene"
      ? "Сцена"
      : accent === "lighting"
        ? "Свет"
        : accent === "mood"
          ? "Атмосфера"
          : "Композиция";
  return `Steal This Vibe: ${accentLabel} — ${short}`;
}

function makeSourceMessageId(): number {
  const base = Date.now() * 1000;
  const suffix = Math.floor(Math.random() * 1000);
  return base + suffix;
}

async function resolveOrCreateDataset(supabase: ReturnType<typeof createSupabaseServer>) {
  const { data: existing } = await supabase
    .from("import_datasets")
    .select("id")
    .eq("dataset_slug", VIBE_PUBLISH_DATASET_SLUG)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error: createDatasetError } = await supabase
    .from("import_datasets")
    .insert({
      dataset_slug: VIBE_PUBLISH_DATASET_SLUG,
      channel_title: VIBE_PUBLISH_CHANNEL,
      source_type: "extension_vibe",
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (createDatasetError || !created?.id) {
    throw new Error(`dataset_create_failed:${createDatasetError?.message || "unknown"}`);
  }
  return created.id as string;
}

async function createSyntheticSourceGroup(
  supabase: ReturnType<typeof createSupabaseServer>,
  datasetId: string,
  prompt: string,
  generationId: string,
  vibeId: string | null,
) {
  const now = new Date().toISOString();
  const { data: runRow, error: runError } = await supabase
    .from("import_runs")
    .insert({
      dataset_id: datasetId,
      mode: "incremental",
      status: "success",
      finished_at: now,
      html_files_total: 1,
      groups_total: 1,
      groups_parsed: 1,
    })
    .select("id")
    .single();
  if (runError || !runRow?.id) {
    throw new Error(`run_create_failed:${runError?.message || "unknown"}`);
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const sourceMessageId = makeSourceMessageId();
    const { data: groupRow, error: groupError } = await supabase
      .from("source_message_groups")
      .insert({
        dataset_id: datasetId,
        run_id: runRow.id,
        source_group_key: `stv:${generationId}:${sourceMessageId}`,
        source_message_id: sourceMessageId,
        source_message_ids: [sourceMessageId],
        source_published_at: now,
        raw_text_plain: prompt,
        raw_payload: {
          source: "steal_this_vibe_extension",
          generationId,
          vibeId,
        },
      })
      .select("id,source_message_id")
      .single();

    if (!groupError && groupRow?.id) {
      return {
        sourceGroupId: groupRow.id as string,
        sourceMessageId: Number(groupRow.source_message_id || sourceMessageId),
      };
    }
  }
  throw new Error("source_group_create_failed:conflict");
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseUserForApiRoute(req);
    if (authError || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      vibeId?: string | null;
      generationId?: string;
      prompt?: string;
      accent?: string;
    };

    const generationId = String(body.generationId || "").trim();
    const prompt = String(body.prompt || "").trim();
    const accent = String(body.accent || "").trim() as PromptAccent;
    const vibeId = body.vibeId ? String(body.vibeId).trim() : null;

    if (!generationId || !prompt || prompt.length < 8 || !ALLOWED_ACCENTS.includes(accent)) {
      return NextResponse.json(
        { error: "validation_error", message: "Некорректные параметры сохранения" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseServer();

    const { data: generation, error: generationError } = await supabase
      .from("landing_generations")
      .select("id,user_id,status,card_id,vibe_id,result_storage_bucket,result_storage_path")
      .eq("id", generationId)
      .single();

    if (generationError || !generation || generation.user_id !== user.id) {
      return NextResponse.json(
        { error: "not_found", message: "Генерация не найдена" },
        { status: 404 },
      );
    }

    if (generation.status !== "completed") {
      return NextResponse.json(
        { error: "validation_error", message: "Можно сохранить только завершенную генерацию" },
        { status: 400 },
      );
    }

    let resolvedVibeId: string | null = generation.vibe_id || null;
    if (vibeId) {
      const { data: vibeRow, error: vibeError } = await supabase
        .from("vibes")
        .select("id,user_id")
        .eq("id", vibeId)
        .single();

      if (vibeError || !vibeRow || vibeRow.user_id !== user.id) {
        return NextResponse.json(
          { error: "validation_error", message: "Недопустимый vibeId" },
          { status: 400 },
        );
      }
      resolvedVibeId = vibeRow.id;

      if (generation.vibe_id !== resolvedVibeId) {
        await supabase
          .from("landing_generations")
          .update({ vibe_id: resolvedVibeId, updated_at: new Date().toISOString() })
          .eq("id", generation.id);
      }
    }

    let styleForAutoTags: StyleJson | null = null;
    if (resolvedVibeId) {
      const { data: vibeStyleRow } = await supabase
        .from("vibes")
        .select("style")
        .eq("id", resolvedVibeId)
        .maybeSingle();
      styleForAutoTags = toRecord(vibeStyleRow?.style) as StyleJson;
    }
    const inferredSeoTags = inferSeoTagsFromStyle(styleForAutoTags);
    const autoTagCount = Object.values(inferredSeoTags).reduce((acc, arr) => acc + arr.length, 0);

    const savePayload = {
      user_id: user.id,
      vibe_id: resolvedVibeId,
      generation_id: generation.id,
      prompt_text: prompt,
      accent,
      card_id: generation.card_id || null,
      auto_seo_tags: inferredSeoTags,
    };

    const { data: saveRow, error: saveError } = await supabase
      .from("landing_vibe_saves")
      .upsert(savePayload, { onConflict: "generation_id" })
      .select("id,card_id")
      .single();

    if (saveError || !saveRow) {
      console.error("[vibe.save] upsert failed", {
        userId: user.id,
        generationId: generation.id,
        error: saveError?.message ?? null,
      });
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }

    let cardId: string | null = saveRow.card_id || null;
    let cardUrl: string | null = null;

    if (
      !cardId &&
      generation.result_storage_bucket &&
      generation.result_storage_path
    ) {
      try {
        const datasetId = await resolveOrCreateDataset(supabase);
        const { sourceGroupId, sourceMessageId } = await createSyntheticSourceGroup(
          supabase,
          datasetId,
          prompt,
          generation.id,
          resolvedVibeId,
        );

        const { data: createdCard, error: createCardError } = await supabase
          .from("prompt_cards")
          .insert({
            source_group_id: sourceGroupId,
            title_ru: buildCardTitle(prompt, accent),
            title_en: null,
            hashtags: [],
            tags: [],
            seo_tags: inferredSeoTags,
            source_channel: "steal_this_vibe",
            source_dataset_slug: VIBE_PUBLISH_DATASET_SLUG,
            source_message_id: sourceMessageId,
            source_date: new Date().toISOString(),
            parse_status: "parsed",
            parse_warnings: [],
            is_published: false,
            author_user_id: user.id,
          })
          .select("id,slug")
          .single();

        if (!createCardError && createdCard?.id) {
          cardId = createdCard.id as string;
          if (createdCard.slug) {
            cardUrl = toCardUrl(createdCard.slug as string);
          }

          const { error: mediaInsertError } = await supabase.from("prompt_card_media").insert({
            card_id: cardId,
            media_index: 0,
            media_type: "photo",
            storage_bucket: generation.result_storage_bucket,
            storage_path: generation.result_storage_path,
            original_relative_path: generation.result_storage_path,
            is_primary: true,
          });
          if (mediaInsertError) {
            throw new Error(`card_media_insert_failed:${mediaInsertError.message}`);
          }

          const { error: variantInsertError } = await supabase.from("prompt_variants").insert({
            card_id: cardId,
            variant_index: 0,
            label_raw: accent,
            prompt_text_ru: prompt,
            prompt_text_en: null,
            match_strategy: "stv_extension",
          });
          if (variantInsertError) {
            throw new Error(`card_variant_insert_failed:${variantInsertError.message}`);
          }

          const { error: linkGenerationError } = await supabase
            .from("landing_generations")
            .update({ card_id: cardId, updated_at: new Date().toISOString() })
            .eq("id", generation.id);
          if (linkGenerationError) {
            throw new Error(`generation_link_failed:${linkGenerationError.message}`);
          }

          const { error: linkSaveError } = await supabase
            .from("landing_vibe_saves")
            .update({ card_id: cardId })
            .eq("id", saveRow.id);
          if (linkSaveError) {
            throw new Error(`save_link_failed:${linkSaveError.message}`);
          }
        }
      } catch (publishErr) {
        console.error("[vibe.save] auto publish card failed", {
          generationId: generation.id,
          vibeId: resolvedVibeId,
          error: publishErr instanceof Error ? publishErr.message : String(publishErr),
        });
      }
    }
    if (cardId) {
      const { data: cardRow } = await supabase
        .from("prompt_cards")
        .select("id,slug,seo_tags")
        .eq("id", cardId)
        .maybeSingle();

      if (cardRow) {
        cardId = cardRow.id;
        if (cardRow.slug) {
          cardUrl = toCardUrl(cardRow.slug);
        }

        if (autoTagCount > 0) {
          const mergedSeoTags = mergeSeoTags(cardRow.seo_tags, inferredSeoTags);
          const { error: updateTagsError } = await supabase
            .from("prompt_cards")
            .update({
              seo_tags: mergedSeoTags,
              updated_at: new Date().toISOString(),
            })
            .eq("id", cardRow.id);

          if (updateTagsError) {
            console.error("[vibe.save] prompt_cards seo_tags update failed", {
              cardId: cardRow.id,
              vibeId: resolvedVibeId,
              error: updateTagsError.message,
            });
          }
        }
      }
    }

    return NextResponse.json({
      saveId: saveRow.id,
      generationId: generation.id,
      vibeId: resolvedVibeId,
      cardId,
      cardUrl,
      autoTagCount,
    });
  } catch (err) {
    console.error("[vibe.save] unhandled error", toErrorMeta(err));
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
