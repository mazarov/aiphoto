-- ============================================================
-- RPC: search_cards_filtered — поиск карточек по всей базе
-- с фильтрами: warnings, score, RU prompt, seo_tag
-- ============================================================

CREATE OR REPLACE FUNCTION search_cards_filtered(
  p_has_warnings text DEFAULT 'all',   -- 'all' | 'yes' | 'no'
  p_score_min int DEFAULT 0,
  p_score_max int DEFAULT 100,
  p_has_ru_prompt text DEFAULT 'all',  -- 'all' | 'yes' | 'no'
  p_seo_tag text DEFAULT NULL,
  p_has_before text DEFAULT 'all',     -- 'all' | 'yes' — только карточки с "было"
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  title_ru text,
  title_en text,
  seo_tags jsonb,
  relevance_score int
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.slug,
    c.title_ru,
    c.title_en,
    c.seo_tags,
    COALESCE(c.seo_readiness_score, 0)::int AS relevance_score
  FROM prompt_cards c
  WHERE c.is_published = true
    AND EXISTS (SELECT 1 FROM prompt_card_media m WHERE m.card_id = c.id AND m.media_type = 'photo')
    AND (p_has_warnings = 'all'
         OR (p_has_warnings = 'yes' AND jsonb_array_length(COALESCE(c.parse_warnings, '[]'::jsonb)) > 0)
         OR (p_has_warnings = 'no' AND jsonb_array_length(COALESCE(c.parse_warnings, '[]'::jsonb)) = 0))
    AND COALESCE(c.seo_readiness_score, 0) >= p_score_min
    AND COALESCE(c.seo_readiness_score, 0) <= p_score_max
    AND (p_has_ru_prompt = 'all'
         OR (p_has_ru_prompt = 'yes' AND EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != ''))
         OR (p_has_ru_prompt = 'no' AND NOT EXISTS (SELECT 1 FROM prompt_variants v WHERE v.card_id = c.id AND v.prompt_text_ru IS NOT NULL AND v.prompt_text_ru != '')))
    AND (p_seo_tag IS NULL OR p_seo_tag = ''
         OR (c.seo_tags->'audience_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'style_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'occasion_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'object_tag') @> jsonb_build_array(p_seo_tag)
         OR (c.seo_tags->'doc_task_tag') @> jsonb_build_array(p_seo_tag))
    AND (p_has_before = 'all' OR (p_has_before = 'yes' AND EXISTS (SELECT 1 FROM prompt_card_before_media b WHERE b.card_id = c.id)))
  ORDER BY c.seo_readiness_score DESC NULLS LAST, c.source_date DESC NULLS LAST, c.id ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
