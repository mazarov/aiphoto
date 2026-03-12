-- Таблицы для лендинга промтов (aiphoto)
-- Отдельный Supabase-проект

-- Кластеры (страницы сайта)
CREATE TABLE IF NOT EXISTS prompt_clusters (
  slug            text PRIMARY KEY,
  parent_slug     text REFERENCES prompt_clusters(slug) ON DELETE SET NULL,
  title_ru        text NOT NULL,
  title_en        text,
  meta_description_ru text NOT NULL DEFAULT '',
  meta_description_en text,
  h1_ru           text NOT NULL DEFAULT '',
  h1_en           text,
  seo_text_ru     text NOT NULL DEFAULT '',
  seo_text_en     text,
  sort_order      int NOT NULL DEFAULT 0,
  is_published    bool NOT NULL DEFAULT false
);

-- Карточки промтов
CREATE TABLE IF NOT EXISTS prompt_cards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  title_ru          text NOT NULL,
  title_en          text,
  prompts           jsonb NOT NULL DEFAULT '[]',
  tags              text[] NOT NULL DEFAULT '{}',
  source_channel    text NOT NULL DEFAULT 'lexy',
  source_message_id text NOT NULL UNIQUE,
  source_date       timestamptz NOT NULL,
  sort_order        int NOT NULL DEFAULT 0,
  is_published      bool NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_cards_slug ON prompt_cards(slug);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_source_message_id ON prompt_cards(source_message_id);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_is_published ON prompt_cards(is_published);
CREATE INDEX IF NOT EXISTS idx_prompt_cards_tags ON prompt_cards USING gin(tags);

-- Фото-примеры карточек
CREATE TABLE IF NOT EXISTS prompt_card_images (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id           uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  storage_path      text NOT NULL,
  original_filename text NOT NULL,
  sort_order        int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_prompt_card_images_card_id ON prompt_card_images(card_id);

-- Many-to-many: карточка ↔ страница
CREATE TABLE IF NOT EXISTS prompt_card_pages (
  card_id       uuid NOT NULL REFERENCES prompt_cards(id) ON DELETE CASCADE,
  cluster_slug  text NOT NULL REFERENCES prompt_clusters(slug) ON DELETE CASCADE,
  sort_order    int NOT NULL DEFAULT 0,
  PRIMARY KEY (card_id, cluster_slug)
);

CREATE INDEX IF NOT EXISTS idx_prompt_card_pages_cluster_slug ON prompt_card_pages(cluster_slug);
CREATE INDEX IF NOT EXISTS idx_prompt_card_pages_card_id ON prompt_card_pages(card_id);
