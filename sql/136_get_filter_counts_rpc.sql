-- ============================================================
-- RPC: get_filter_counts — счётчики тегов для текущей выборки
-- Используется в FilterPanel: показывать только применимые теги с кол-вом карточек
-- ============================================================

CREATE OR REPLACE FUNCTION get_filter_counts(
  p_audience_tag text DEFAULT NULL,
  p_style_tag text DEFAULT NULL,
  p_occasion_tag text DEFAULT NULL,
  p_object_tag text DEFAULT NULL,
  p_doc_task_tag text DEFAULT NULL,
  p_site_lang text DEFAULT 'ru'
)
RETURNS TABLE (
  dimension text,
  slug text,
  cards_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT c.id
    FROM prompt_cards c
    WHERE c.is_published = true
      AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
      AND (
        (p_site_lang = 'ru' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''))
        OR
        (p_site_lang = 'en' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_en IS NOT NULL AND v.prompt_text_en != ''))
      )
      AND (p_audience_tag IS NULL OR (c.seo_tags->'audience_tag') @> jsonb_build_array(p_audience_tag))
      AND (p_style_tag IS NULL OR (c.seo_tags->'style_tag') @> jsonb_build_array(p_style_tag))
      AND (p_occasion_tag IS NULL OR (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_occasion_tag))
      AND (p_object_tag IS NULL OR (c.seo_tags->'object_tag') @> jsonb_build_array(p_object_tag))
      AND (p_doc_task_tag IS NULL OR (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_doc_task_tag))
  ),
  exploded AS (
    SELECT b.id, 'audience_tag' AS dim, t.value AS tag_val
    FROM base b
    JOIN prompt_cards c ON c.id = b.id
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'audience_tag', '[]'::jsonb)) t
    UNION ALL
    SELECT b.id, 'style_tag', t.value
    FROM base b
    JOIN prompt_cards c ON c.id = b.id
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'style_tag', '[]'::jsonb)) t
    UNION ALL
    SELECT b.id, 'occasion_tag', t.value
    FROM base b
    JOIN prompt_cards c ON c.id = b.id
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'occasion_tag', '[]'::jsonb)) t
    UNION ALL
    SELECT b.id, 'object_tag', t.value
    FROM base b
    JOIN prompt_cards c ON c.id = b.id
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'object_tag', '[]'::jsonb)) t
    UNION ALL
    SELECT b.id, 'doc_task_tag', t.value
    FROM base b
    JOIN prompt_cards c ON c.id = b.id
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.seo_tags->'doc_task_tag', '[]'::jsonb)) t
  )
  SELECT dim AS dimension, tag_val AS slug, COUNT(DISTINCT id)::bigint AS cards_count
  FROM exploded
  WHERE tag_val IS NOT NULL AND tag_val != ''
  GROUP BY dim, tag_val
  ORDER BY dim, cards_count DESC;
$$;
