-- ============================================================
-- AI Photo Bot — Seed Data
-- Style presets, bot texts, prompt agent
-- ============================================================

-- Style groups
INSERT INTO photo_style_groups (id, emoji, name_ru, name_en, sort_order) VALUES
  ('popular',   '🔥', 'Популярные',   'Popular',    1),
  ('art',       '🎨', 'Арт',          'Art',        2),
  ('photo',     '📸', 'Фото-стили',   'Photo',      3),
  ('fun',       '😎', 'Весёлые',      'Fun',        4)
ON CONFLICT (id) DO NOTHING;

-- Style presets (initial set — expand later)
INSERT INTO photo_style_presets (id, group_id, emoji, name_ru, name_en, prompt_hint, sort_order) VALUES
  -- Popular
  ('anime',          'popular', '🎌', 'Аниме',         'Anime',         'anime style illustration, vibrant colors, expressive features, clean lines, studio ghibli inspired', 1),
  ('cartoon',        'popular', '🖍️', 'Мультфильм',    'Cartoon',       'cartoon style illustration, bright colors, exaggerated features, friendly expression', 2),
  ('realistic',      'popular', '📷', 'Реалистичный',  'Realistic',     'photorealistic enhancement, ultra detailed, professional photography, natural lighting', 3),
  ('oil_painting',   'popular', '🖼️', 'Масло',         'Oil Painting',  'oil painting style, rich textures, dramatic lighting, classical portrait, brushstrokes visible', 4),
  -- Art
  ('watercolor',     'art',     '💧', 'Акварель',      'Watercolor',    'watercolor painting, soft washes, delicate colors, paper texture, artistic', 5),
  ('pencil_sketch',  'art',     '✏️', 'Карандаш',      'Pencil Sketch', 'detailed pencil sketch, graphite drawing, crosshatching, realistic shading', 6),
  ('pop_art',        'art',     '🎯', 'Поп-арт',       'Pop Art',       'pop art style, bold colors, halftone dots, comic book style, andy warhol inspired', 7),
  ('cyberpunk',      'art',     '🌆', 'Киберпанк',     'Cyberpunk',     'cyberpunk style, neon lights, futuristic, dark atmosphere, high tech', 8),
  -- Photo
  ('vintage',        'photo',   '📺', 'Винтаж',        'Vintage',       'vintage photography style, warm tones, film grain, retro color grading, 1970s look', 9),
  ('noir',           'photo',   '🖤', 'Нуар',          'Film Noir',     'film noir style, dramatic black and white, high contrast, moody shadows', 10),
  ('cinematic',      'photo',   '🎬', 'Кинематограф',  'Cinematic',     'cinematic style, anamorphic lens, dramatic lighting, movie still, color graded', 11),
  -- Fun
  ('pixel_art',      'fun',     '👾', 'Пиксель-арт',   'Pixel Art',     'pixel art style, 16-bit retro game aesthetic, limited color palette, blocky', 12),
  ('clay',           'fun',     '🏺', 'Пластилин',     'Clay/Claymation', 'claymation style, 3D clay figure, soft lighting, stop motion look, playful', 13),
  ('lego',           'fun',     '🧱', 'LEGO',          'LEGO',          'LEGO minifigure style, plastic bricks, toy aesthetic, bright colors, blocky construction', 14)
ON CONFLICT (id) DO NOTHING;

-- Prompt generator agent
INSERT INTO photo_agents (name, description, model, system_prompt, few_shot_examples) VALUES
  ('prompt_generator', 'Generates Gemini prompts from user photo + style preset', 'gemini-2.0-flash',
  'You are an expert AI image generation prompt engineer.

Your task: given a style hint and a user photo, generate an optimal prompt for Gemini image generation.

Rules:
1. The prompt must describe the TRANSFORMATION of the input photo into the target style
2. Preserve the person''s identity, pose, and key features
3. Be specific about style, lighting, colors, and mood
4. Keep the prompt concise (2-4 sentences max)
5. Do NOT mention "sticker", "border", "outline", "transparent background"
6. The output is a PHOTO, not a sticker — maintain proper background and composition
7. If the style implies a specific background (e.g., cyberpunk → neon city), include it

Output format: just the prompt text, nothing else.',
  '[]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Bot texts — Russian
INSERT INTO photo_bot_texts (lang, key, text) VALUES
  -- Start
  ('ru', 'start.welcome', '👋 Привет! Я AI Photo Bot — превращаю твои фото в произведения искусства!\n\n📸 Отправь мне фото, и я создам из него шедевр в любом стиле.'),
  ('ru', 'start.send_photo', '📸 Отправь фото для генерации:'),
  -- Flow
  ('ru', 'flow.choose_style', '🎨 Выбери стиль:'),
  ('ru', 'flow.choose_model', '🤖 Выбери модель:\n\n⚡ Flash — быстрая генерация\n💎 Pro — максимальное качество'),
  ('ru', 'flow.choose_format', '📐 Выбери формат:'),
  ('ru', 'flow.choose_quality', '📏 Выбери качество:'),
  ('ru', 'flow.generating', '⏳ Генерирую фото...'),
  -- Progress
  ('ru', 'progress.step2', '📥 Загружаю фото...'),
  ('ru', 'progress.step3', '🎨 Генерирую изображение...'),
  ('ru', 'progress.step5', '✨ Обрабатываю результат...'),
  ('ru', 'progress.step7', '📤 Отправляю результат...'),
  -- Result
  ('ru', 'result.done', '✅ Готово!'),
  ('ru', 'result.error', '❌ Произошла ошибка при генерации.\n\nКредиты возвращены.'),
  -- Buttons
  ('ru', 'btn.new_style', '🎨 Другой стиль'),
  ('ru', 'btn.new_photo', '📷 Новое фото'),
  ('ru', 'btn.model_flash', '⚡ Flash (быстро)'),
  ('ru', 'btn.model_pro', '💎 Pro (качество)'),
  ('ru', 'btn.quality_fhd', '📱 FullHD'),
  ('ru', 'btn.quality_2k', '🖥️ 2K'),
  ('ru', 'btn.quality_4k', '🖼️ 4K'),
  -- Payment
  ('ru', 'payment.need_credits', '💎 Нужны кредиты для генерации'),
  ('ru', 'payment.buy', '💰 Купить кредиты')
ON CONFLICT (lang, key) DO NOTHING;

-- Bot texts — English
INSERT INTO photo_bot_texts (lang, key, text) VALUES
  ('en', 'start.welcome', '👋 Hi! I''m AI Photo Bot — I transform your photos into art!\n\n📸 Send me a photo and I''ll create a masterpiece in any style.'),
  ('en', 'start.send_photo', '📸 Send a photo to generate:'),
  ('en', 'flow.choose_style', '🎨 Choose a style:'),
  ('en', 'flow.choose_model', '🤖 Choose a model:\n\n⚡ Flash — fast generation\n💎 Pro — maximum quality'),
  ('en', 'flow.choose_format', '📐 Choose format:'),
  ('en', 'flow.choose_quality', '📏 Choose quality:'),
  ('en', 'flow.generating', '⏳ Generating photo...'),
  ('en', 'progress.step2', '📥 Downloading photo...'),
  ('en', 'progress.step3', '🎨 Generating image...'),
  ('en', 'progress.step5', '✨ Processing result...'),
  ('en', 'progress.step7', '📤 Sending result...'),
  ('en', 'result.done', '✅ Done!'),
  ('en', 'result.error', '❌ An error occurred during generation.\n\nCredits have been refunded.'),
  ('en', 'btn.new_style', '🎨 Another style'),
  ('en', 'btn.new_photo', '📷 New photo'),
  ('en', 'btn.model_flash', '⚡ Flash (fast)'),
  ('en', 'btn.model_pro', '💎 Pro (quality)'),
  ('en', 'btn.quality_fhd', '📱 FullHD'),
  ('en', 'btn.quality_2k', '🖥️ 2K'),
  ('en', 'btn.quality_4k', '🖼️ 4K'),
  ('en', 'payment.need_credits', '💎 Credits needed for generation'),
  ('en', 'payment.buy', '💰 Buy credits')
ON CONFLICT (lang, key) DO NOTHING;
