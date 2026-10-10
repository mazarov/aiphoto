export type Dimension =
  | "audience_tag"
  | "style_tag"
  | "occasion_tag"
  | "object_tag"
  | "doc_task_tag";

/**
 * Catalog metadata shared with the client. Regex matchers are NOT here —
 * they live in `tag-patterns.ts` (`import "server-only"`). Adding them back
 * puts the literals into the root-layout chunk.
 */
export type TagEntry = {
  slug: string;
  dimension: Dimension;
  labelRu: string;
  labelEn: string;
  urlPath: string;
};

export const TAG_REGISTRY: TagEntry[] = [
  // ── audience_tag ──
  { slug: "devushka", dimension: "audience_tag", labelRu: "Девушки", labelEn: "Women", urlPath: "/promty-dlya-foto-devushki" },
  { slug: "muzhchina", dimension: "audience_tag", labelRu: "Мужчины", labelEn: "Men", urlPath: "/promty-dlya-foto-muzhchiny" },
  { slug: "para", dimension: "audience_tag", labelRu: "Пары", labelEn: "Couples", urlPath: "/promty-dlya-foto-par" },
  { slug: "semya", dimension: "audience_tag", labelRu: "Семья", labelEn: "Family", urlPath: "/promty-dlya-semejnogo-foto" },
  { slug: "detskie", dimension: "audience_tag", labelRu: "Дети", labelEn: "Kids", urlPath: "/promty-dlya-detskih-foto" },
  { slug: "s_mamoy", dimension: "audience_tag", labelRu: "С мамой", labelEn: "With mother", urlPath: "/promty-dlya-foto-s-mamoy" },
  { slug: "s_papoy", dimension: "audience_tag", labelRu: "С папой", labelEn: "With father", urlPath: "/promty-dlya-foto-s-papoy" },
  { slug: "s_parnem", dimension: "audience_tag", labelRu: "С парнем", labelEn: "With boyfriend", urlPath: "/promty-dlya-foto-s-parnem" },
  { slug: "s_muzhem", dimension: "audience_tag", labelRu: "С мужем", labelEn: "With husband", urlPath: "/promty-dlya-foto-s-muzhem" },
  { slug: "s_podrugoy", dimension: "audience_tag", labelRu: "С подругой", labelEn: "With friend", urlPath: "/promty-dlya-foto-s-podrugoy" },
  { slug: "s_drugom", dimension: "audience_tag", labelRu: "С другом", labelEn: "With friend", urlPath: "/promty-dlya-foto-s-drugom" },
  { slug: "s_synom", dimension: "audience_tag", labelRu: "С сыном", labelEn: "With son", urlPath: "/promty-dlya-foto-s-synom" },
  { slug: "s_dochkoy", dimension: "audience_tag", labelRu: "С дочкой", labelEn: "With daughter", urlPath: "/promty-dlya-foto-s-dochkoy" },
  { slug: "s_sestroy", dimension: "audience_tag", labelRu: "С сестрой", labelEn: "With sister", urlPath: "/promty-dlya-foto-s-sestroy" },
  { slug: "s_bratom", dimension: "audience_tag", labelRu: "С братом", labelEn: "With brother", urlPath: "/promty-dlya-foto-s-bratom" },
  { slug: "s_babushkoy", dimension: "audience_tag", labelRu: "С бабушкой", labelEn: "With grandmother", urlPath: "/promty-dlya-foto-s-babushkoy" },
  { slug: "malchik", dimension: "audience_tag", labelRu: "Мальчик", labelEn: "Boy", urlPath: "/promty-dlya-foto-malchik" },
  { slug: "devochka", dimension: "audience_tag", labelRu: "Девочка", labelEn: "Girl", urlPath: "/promty-dlya-foto-devochka" },
  { slug: "podrostok", dimension: "audience_tag", labelRu: "Подросток", labelEn: "Teenager", urlPath: "/promty-dlya-foto-podrostok" },
  { slug: "malysh", dimension: "audience_tag", labelRu: "Малыш", labelEn: "Baby", urlPath: "/promty-dlya-foto-malysh" },
  { slug: "pokoleniy", dimension: "audience_tag", labelRu: "Поколения", labelEn: "Generations", urlPath: "/promty-dlya-foto-pokoleniy" },
  { slug: "vlyublennykh", dimension: "audience_tag", labelRu: "Влюблённые", labelEn: "Lovers", urlPath: "/promty-dlya-foto-vlyublennykh" },
  { slug: "s_pitomcem", dimension: "audience_tag", labelRu: "С питомцем", labelEn: "With pet", urlPath: "/promty-dlya-foto-s-pitomcem" },
  { slug: "beremennaya", dimension: "audience_tag", labelRu: "Беременная", labelEn: "Pregnant", urlPath: "/promty-dlya-foto-beremennaya" },

  // ── style_tag ──
  { slug: "cherno_beloe", dimension: "style_tag", labelRu: "Чёрно-белое", labelEn: "Black & White", urlPath: "/stil/cherno-beloe" },
  { slug: "realistichnoe", dimension: "style_tag", labelRu: "Реалистичное", labelEn: "Realistic", urlPath: "/stil/realistichnoe" },
  { slug: "portret", dimension: "style_tag", labelRu: "Портрет", labelEn: "Portrait", urlPath: "/stil/portret" },
  { slug: "3d", dimension: "style_tag", labelRu: "3D", labelEn: "3D", urlPath: "/stil/3d" },
  { slug: "gta", dimension: "style_tag", labelRu: "GTA", labelEn: "GTA", urlPath: "/stil/gta" },
  { slug: "studiynoe", dimension: "style_tag", labelRu: "Студийное", labelEn: "Studio", urlPath: "/stil/studiynoe" },
  { slug: "love_is", dimension: "style_tag", labelRu: "Love Is", labelEn: "Love Is", urlPath: "/stil/love-is" },
  { slug: "delovoe", dimension: "style_tag", labelRu: "Деловое", labelEn: "Business", urlPath: "/stil/delovoe" },
  { slug: "multyashnoe", dimension: "style_tag", labelRu: "Мультяшное", labelEn: "Cartoon", urlPath: "/stil/multyashnoe" },
  { slug: "kollazh", dimension: "style_tag", labelRu: "Коллаж", labelEn: "Collage", urlPath: "/stil/kollazh" },
  { slug: "otkrytka", dimension: "style_tag", labelRu: "Открытка", labelEn: "Postcard", urlPath: "/stil/otkrytka" },
  { slug: "sovetskoe", dimension: "style_tag", labelRu: "Советское", labelEn: "Soviet", urlPath: "/stil/sovetskoe" },
  { slug: "retro", dimension: "style_tag", labelRu: "Ретро", labelEn: "Retro", urlPath: "/stil/retro" },
  { slug: "anime", dimension: "style_tag", labelRu: "Аниме", labelEn: "Anime", urlPath: "/stil/anime" },
  { slug: "polaroid", dimension: "style_tag", labelRu: "Полароид", labelEn: "Polaroid", urlPath: "/stil/polaroid" },
  { slug: "disney", dimension: "style_tag", labelRu: "Disney", labelEn: "Disney", urlPath: "/stil/disney" },
  { slug: "selfi", dimension: "style_tag", labelRu: "Селфи", labelEn: "Selfie", urlPath: "/stil/selfi" },
  { slug: "piksar", dimension: "style_tag", labelRu: "Pixar", labelEn: "Pixar", urlPath: "/stil/piksar" },
  { slug: "neonovoe", dimension: "style_tag", labelRu: "Неоновое", labelEn: "Neon", urlPath: "/stil/neonovoe" },
  { slug: "street_style", dimension: "style_tag", labelRu: "Street Style", labelEn: "Street Style", urlPath: "/stil/street-style" },
  { slug: "fashion", dimension: "style_tag", labelRu: "Fashion", labelEn: "Fashion", urlPath: "/stil/fashion" },
  { slug: "glyanec", dimension: "style_tag", labelRu: "Глянец", labelEn: "Glossy", urlPath: "/stil/glyanec" },
  { slug: "victorias_secret", dimension: "style_tag", labelRu: "Victoria's Secret", labelEn: "Victoria's Secret", urlPath: "/stil/victorias-secret" },
  { slug: "barbie", dimension: "style_tag", labelRu: "Barbie", labelEn: "Barbie", urlPath: "/stil/barbie" },

  // ── occasion_tag ──
  { slug: "den_rozhdeniya", dimension: "occasion_tag", labelRu: "День рождения", labelEn: "Birthday", urlPath: "/sobytiya/den-rozhdeniya" },
  { slug: "8_marta", dimension: "occasion_tag", labelRu: "8 марта", labelEn: "March 8", urlPath: "/sobytiya/8-marta" },
  { slug: "1_sentyabrya", dimension: "occasion_tag", labelRu: "1 сентября", labelEn: "September 1", urlPath: "/sobytiya/1-sentyabrya" },
  { slug: "14_fevralya", dimension: "occasion_tag", labelRu: "14 февраля", labelEn: "Valentine's Day", urlPath: "/sobytiya/14-fevralya" },
  { slug: "23_fevralya", dimension: "occasion_tag", labelRu: "23 февраля", labelEn: "Feb 23", urlPath: "/sobytiya/23-fevralya" },
  { slug: "maslenica", dimension: "occasion_tag", labelRu: "Масленица", labelEn: "Maslenitsa", urlPath: "/sobytiya/maslenica" },
  { slug: "novyy_god", dimension: "occasion_tag", labelRu: "Новый год", labelEn: "New Year", urlPath: "/sobytiya/novyj-god" },
  { slug: "svadba", dimension: "occasion_tag", labelRu: "Свадьба", labelEn: "Wedding", urlPath: "/sobytiya/svadba" },
  { slug: "rozhdestvo", dimension: "occasion_tag", labelRu: "Рождество", labelEn: "Christmas", urlPath: "/sobytiya/rozhdestvo" },
  { slug: "den_uchitelya", dimension: "occasion_tag", labelRu: "День учителя", labelEn: "Teacher's Day", urlPath: "/promty-dlya-foto/den-uchitelya" },
  { slug: "den_vospitatelya", dimension: "occasion_tag", labelRu: "День воспитателя", labelEn: "Educator's Day", urlPath: "/promty-dlya-foto/den-vospitatelya" },

  // ── object_tag ──
  { slug: "v_forme", dimension: "object_tag", labelRu: "В форме", labelEn: "In uniform", urlPath: "/v-forme" },
  { slug: "s_mashinoy", dimension: "object_tag", labelRu: "С машиной", labelEn: "With car", urlPath: "/promty-dlya-foto/s-mashinoy" },
  { slug: "s_cvetami", dimension: "object_tag", labelRu: "С цветами", labelEn: "With flowers", urlPath: "/promty-dlya-foto/s-cvetami" },
  { slug: "so_znamenitostyu", dimension: "object_tag", labelRu: "Со знаменитостью", labelEn: "With celebrity", urlPath: "/promty-dlya-foto/so-znamenitostyu" },
  { slug: "v_profil", dimension: "object_tag", labelRu: "В профиль", labelEn: "Profile", urlPath: "/promty-dlya-foto/v-profil" },
  { slug: "s_kotom", dimension: "object_tag", labelRu: "С котом", labelEn: "With cat", urlPath: "/promty-dlya-foto/s-kotom" },
  { slug: "v_kostyume", dimension: "object_tag", labelRu: "В костюме", labelEn: "In suit", urlPath: "/promty-dlya-foto/v-kostyume" },
  { slug: "na_chernom_fone", dimension: "object_tag", labelRu: "На чёрном фоне", labelEn: "On black background", urlPath: "/promty-dlya-foto/na-chernom-fone" },
  { slug: "s_tortom", dimension: "object_tag", labelRu: "С тортом", labelEn: "With cake", urlPath: "/promty-dlya-foto/s-tortom" },
  { slug: "zima", dimension: "object_tag", labelRu: "Зима", labelEn: "Winter", urlPath: "/promty-dlya-foto/zima" },
  { slug: "v_zerkale", dimension: "object_tag", labelRu: "В зеркале", labelEn: "In mirror", urlPath: "/promty-dlya-foto/v-zerkale" },
  { slug: "vesna", dimension: "object_tag", labelRu: "Весна", labelEn: "Spring", urlPath: "/promty-dlya-foto/vesna" },
  { slug: "s_sobakoy", dimension: "object_tag", labelRu: "С собакой", labelEn: "With dog", urlPath: "/promty-dlya-foto/s-sobakoj" },
  { slug: "v_lesu", dimension: "object_tag", labelRu: "В лесу", labelEn: "In forest", urlPath: "/promty-dlya-foto/v-lesu" },
  { slug: "s_koronoy", dimension: "object_tag", labelRu: "С короной", labelEn: "With crown", urlPath: "/promty-dlya-foto/s-koronoy" },
  { slug: "na_more", dimension: "object_tag", labelRu: "На море", labelEn: "At sea", urlPath: "/promty-dlya-foto/na-more" },
  { slug: "v_polnyy_rost", dimension: "object_tag", labelRu: "В полный рост", labelEn: "Full body", urlPath: "/promty-dlya-foto/v-polnyy-rost" },
  { slug: "v_gorah", dimension: "object_tag", labelRu: "В горах", labelEn: "In mountains", urlPath: "/promty-dlya-foto/v-gorah" },
  { slug: "na_ulice", dimension: "object_tag", labelRu: "На улице", labelEn: "Outdoor", urlPath: "/promty-dlya-foto/na-ulice" },
  { slug: "v_mashine", dimension: "object_tag", labelRu: "В машине", labelEn: "In car", urlPath: "/promty-dlya-foto/v-mashine" },
  { slug: "na_yahte", dimension: "object_tag", labelRu: "На яхте", labelEn: "On yacht", urlPath: "/promty-dlya-foto/na-yahte" },
  { slug: "v_restorane", dimension: "object_tag", labelRu: "В ресторане", labelEn: "In restaurant", urlPath: "/promty-dlya-foto/v-restorane" },
  { slug: "na_kryshe", dimension: "object_tag", labelRu: "На крыше", labelEn: "On rooftop", urlPath: "/promty-dlya-foto/na-kryshe" },
  { slug: "v_pustyne", dimension: "object_tag", labelRu: "В пустыне", labelEn: "In desert", urlPath: "/promty-dlya-foto/v-pustyne" },
  { slug: "pod_vodoy", dimension: "object_tag", labelRu: "Под водой", labelEn: "Underwater", urlPath: "/promty-dlya-foto/pod-vodoy" },
  { slug: "v_gorode", dimension: "object_tag", labelRu: "В городе", labelEn: "In city", urlPath: "/promty-dlya-foto/v-gorode" },
  { slug: "s_shuboj", dimension: "object_tag", labelRu: "В шубе", labelEn: "In fur coat", urlPath: "/promty-dlya-foto/s-shuboj" },
  { slug: "so_svechami", dimension: "object_tag", labelRu: "Со свечами", labelEn: "With candles", urlPath: "/promty-dlya-foto/so-svechami" },
  { slug: "v_platye", dimension: "object_tag", labelRu: "В платье", labelEn: "In dress", urlPath: "/promty-dlya-foto/v-platye" },
  { slug: "s_bokalom", dimension: "object_tag", labelRu: "С бокалом", labelEn: "With glass", urlPath: "/promty-dlya-foto/s-bokalom" },
  { slug: "s_kofe", dimension: "object_tag", labelRu: "С кофе", labelEn: "With coffee", urlPath: "/promty-dlya-foto/s-kofe" },

  { slug: "na_avatarku", dimension: "object_tag", labelRu: "На аватарку", labelEn: "For avatar", urlPath: "/promty-dlya-foto/na-avatarku" },

  // ── LLM-discovered tags ──
  { slug: "kinematograficheskoe", dimension: "style_tag", labelRu: "Кинематографическое", labelEn: "Cinematic", urlPath: "/stil/kinematograficheskoe" },
  { slug: "y2k", dimension: "style_tag", labelRu: "Y2K", labelEn: "Y2K", urlPath: "/stil/y2k" },
  { slug: "lifestyle", dimension: "style_tag", labelRu: "Лайфстайл", labelEn: "Lifestyle", urlPath: "/stil/lifestyle" },
  { slug: "vintazhnoe", dimension: "style_tag", labelRu: "Винтажное", labelEn: "Vintage", urlPath: "/stil/vintazhnoe" },
  { slug: "s_elkoj", dimension: "object_tag", labelRu: "С ёлкой", labelEn: "With Christmas tree", urlPath: "/promty-dlya-foto/s-elkoj" },
  { slug: "s_sharami", dimension: "object_tag", labelRu: "С шарами", labelEn: "With balloons", urlPath: "/promty-dlya-foto/s-sharami" },
  { slug: "na_belom_fone", dimension: "object_tag", labelRu: "На белом фоне", labelEn: "On white background", urlPath: "/promty-dlya-foto/na-belom-fone" },
  { slug: "v_interere", dimension: "object_tag", labelRu: "В интерьере", labelEn: "Indoors", urlPath: "/promty-dlya-foto/v-interere" },
  { slug: "s_podarkami", dimension: "object_tag", labelRu: "С подарками", labelEn: "With gifts", urlPath: "/promty-dlya-foto/s-podarkami" },
  { slug: "s_ochkami", dimension: "object_tag", labelRu: "С очками", labelEn: "With glasses", urlPath: "/promty-dlya-foto/s-ochkami" },

  // ── LLM-discovered tags ──
  { slug: "fotorealizm", dimension: "style_tag", labelRu: "Фотореализм", labelEn: "Photorealism", urlPath: "/stil/fotorealizm" },
  { slug: "minimalizm", dimension: "style_tag", labelRu: "Минимализм", labelEn: "Minimalism", urlPath: "/stil/minimalizm" },
  { slug: "vysokaya_moda", dimension: "style_tag", labelRu: "Высокая мода", labelEn: "High fashion", urlPath: "/stil/vysokaya-moda" },
  { slug: "s_pitomcem", dimension: "object_tag", labelRu: "s_pitomcem", labelEn: "s_pitomcem", urlPath: "/promty-dlya-foto/s-pitomcem" },

  // ── LLM-discovered tags ──
  { slug: "editorial", dimension: "style_tag", labelRu: "Эдиториал", labelEn: "Editorial", urlPath: "/stil/editorial" },
  { slug: "noch", dimension: "object_tag", labelRu: "Ночь", labelEn: "Night", urlPath: "/promty-dlya-foto/noch" },

  // ── LLM-discovered tags (batch 2026-03-13) ──
  { slug: "osen", dimension: "object_tag", labelRu: "Осень", labelEn: "Autumn", urlPath: "/osen" },
  { slug: "leto", dimension: "object_tag", labelRu: "Лето", labelEn: "Summer", urlPath: "/promty-dlya-foto/leto" },
  { slug: "v_pole", dimension: "object_tag", labelRu: "В поле", labelEn: "In a field", urlPath: "/promty-dlya-foto/v-pole" },
  { slug: "s_loshadyu", dimension: "object_tag", labelRu: "С лошадью", labelEn: "With horse", urlPath: "/promty-dlya-foto/s-loshadyu" },
  { slug: "romanticheskiy", dimension: "style_tag", labelRu: "Романтический", labelEn: "Romantic", urlPath: "/stil/romanticheskiy" },
  { slug: "bokho_stil", dimension: "style_tag", labelRu: "Бохо-стиль", labelEn: "Boho style", urlPath: "/stil/bokho-stil" },
  { slug: "etno_stil", dimension: "style_tag", labelRu: "Этно-стиль", labelEn: "Ethno style", urlPath: "/stil/etno-stil" },

  // ── LLM-discovered tags (batch 2026-03-14, PixelNanoBot) ──
  { slug: "ultrarealistichnoe", dimension: "style_tag", labelRu: "Ультрареалистичное", labelEn: "Ultra-realistic", urlPath: "/stil/ultrarealistichnoe" },
  { slug: "s_shuboy", dimension: "object_tag", labelRu: "С шубой", labelEn: "With fur coat", urlPath: "/promty-dlya-foto/s-shuboy" },
  { slug: "v_basseyne", dimension: "object_tag", labelRu: "В бассейне", labelEn: "In pool", urlPath: "/promty-dlya-foto/v-basseyne" },
  { slug: "vintazhnyy_avtomobil", dimension: "object_tag", labelRu: "Винтажный автомобиль", labelEn: "Vintage car", urlPath: "/promty-dlya-foto/vintazhnyy-avtomobil" },
  { slug: "s_medvedem", dimension: "object_tag", labelRu: "С медведем", labelEn: "With bear", urlPath: "/promty-dlya-foto/s-medvedem" },
  { slug: "glam", dimension: "style_tag", labelRu: "Глэм", labelEn: "Glam", urlPath: "/stil/glam" },
  { slug: "v_sportale", dimension: "object_tag", labelRu: "В спортзале", labelEn: "In gym", urlPath: "/promty-dlya-foto/v-sportale" },

  // ── LLM-discovered tags (batch 2026-03-14, GPTFluxBot) ──
  { slug: "na_krovati", dimension: "object_tag", labelRu: "На кровати", labelEn: "On bed", urlPath: "/promty-dlya-foto/na-krovati" },
  { slug: "halloween", dimension: "occasion_tag", labelRu: "Хэллоуин", labelEn: "Halloween", urlPath: "/halloween" },

  // ── doc_task_tag ──
  { slug: "na_pasport", dimension: "doc_task_tag", labelRu: "На паспорт", labelEn: "For passport", urlPath: "/foto-na-pasport" },
  { slug: "na_dokumenty", dimension: "doc_task_tag", labelRu: "На документы", labelEn: "For documents", urlPath: "/foto-na-dokumenty" },
  { slug: "na_rezume", dimension: "doc_task_tag", labelRu: "Для резюме", labelEn: "For resume", urlPath: "/foto-na-rezume" },
  { slug: "na_zagranpasport", dimension: "doc_task_tag", labelRu: "На загранпаспорт", labelEn: "For international passport", urlPath: "/foto-na-zagranpasport" },

  // ── LLM-discovered tags (batch 2026-03-14, ii_photolab) ──
  { slug: "v_studii", dimension: "object_tag", labelRu: "В студии", labelEn: "In studio", urlPath: "/promty-dlya-foto/v-studii" },
  { slug: "produktovaya_fotografiya", dimension: "style_tag", labelRu: "Продуктовая фотография", labelEn: "Product photography", urlPath: "/stil/produktovaya-fotografiya" },
  { slug: "art_deco", dimension: "style_tag", labelRu: "Арт-деко", labelEn: "Art Deco", urlPath: "/stil/art-deco" },
  { slug: "na_naberezhnoj", dimension: "object_tag", labelRu: "На набережной", labelEn: "On embankment", urlPath: "/promty-dlya-foto/na-naberezhnoj" },

  // ── LLM-discovered tags (full recompute 2026-03-14) ──
  { slug: "giperrealistichnoe", dimension: "style_tag", labelRu: "Гиперреалистичное", labelEn: "Hyperrealistic", urlPath: "/stil/giperrealistichnoe" },
  { slug: "na_okne", dimension: "object_tag", labelRu: "У окна", labelEn: "By the window", urlPath: "/promty-dlya-foto/na-okne" },
  { slug: "na_balkone", dimension: "object_tag", labelRu: "На балконе", labelEn: "On balcony", urlPath: "/promty-dlya-foto/na-balkone" },
  { slug: "v_metroe", dimension: "object_tag", labelRu: "В метро", labelEn: "In metro", urlPath: "/promty-dlya-foto/v-metroe" },
  { slug: "v_lifte", dimension: "object_tag", labelRu: "В лифте", labelEn: "In elevator", urlPath: "/promty-dlya-foto/v-lifte" },
  { slug: "v_parke", dimension: "object_tag", labelRu: "В парке", labelEn: "In park", urlPath: "/promty-dlya-foto/v-parke" },
  { slug: "impressionizm", dimension: "style_tag", labelRu: "Импрессионизм", labelEn: "Impressionism", urlPath: "/stil/impressionizm" },

  // ── LLM-discovered tags (full recompute 2026-03-15) ──
  // Locations & interiors
  { slug: "v_spalne", dimension: "object_tag", labelRu: "В спальне", labelEn: "In bedroom", urlPath: "/promty-dlya-foto/v-spalne" },
  { slug: "kuhnya", dimension: "object_tag", labelRu: "На кухне", labelEn: "In kitchen", urlPath: "/promty-dlya-foto/kuhnya" },
  { slug: "v_sadu", dimension: "object_tag", labelRu: "В саду", labelEn: "In garden", urlPath: "/promty-dlya-foto/v-sadu" },
  { slug: "v_vannoy", dimension: "object_tag", labelRu: "В ванной", labelEn: "In bathroom", urlPath: "/promty-dlya-foto/v-vannoy" },
  // Seasons & weather
  { slug: "sneg", dimension: "object_tag", labelRu: "Снег", labelEn: "Snow", urlPath: "/promty-dlya-foto/sneg" },
  { slug: "dozhd", dimension: "object_tag", labelRu: "Дождь", labelEn: "Rain", urlPath: "/promty-dlya-foto/dozhd" },
  { slug: "tuman", dimension: "object_tag", labelRu: "Туман", labelEn: "Fog", urlPath: "/promty-dlya-foto/tuman" },
  { slug: "zakat", dimension: "object_tag", labelRu: "Закат", labelEn: "Sunset", urlPath: "/promty-dlya-foto/zakat" },
  { slug: "zolotoy_chas", dimension: "object_tag", labelRu: "Золотой час", labelEn: "Golden hour", urlPath: "/promty-dlya-foto/zolotoy-chas" },
  // Animals & vehicles
  { slug: "mototsikl", dimension: "object_tag", labelRu: "Мотоцикл", labelEn: "Motorcycle", urlPath: "/promty-dlya-foto/mototsikl" },
  { slug: "velosiped", dimension: "object_tag", labelRu: "Велосипед", labelEn: "Bicycle", urlPath: "/promty-dlya-foto/velosiped" },
  // Flowers (specific)
  { slug: "s_tulpanami", dimension: "object_tag", labelRu: "С тюльпанами", labelEn: "With tulips", urlPath: "/promty-dlya-foto/s-tulpanami" },
  // Drinks
  { slug: "s_shampanskim", dimension: "object_tag", labelRu: "С шампанским", labelEn: "With champagne", urlPath: "/promty-dlya-foto/s-shampanskim" },
  { slug: "s_detskim_foto", dimension: "object_tag", labelRu: "С детским фото", labelEn: "With childhood photo", urlPath: "/promty-dlya-foto/s-detskim-foto" },
  { slug: "so_lvom", dimension: "object_tag", labelRu: "Со львом", labelEn: "With lion", urlPath: "/promty-dlya-foto/so-lvom" },
  // Props
  { slug: "s_zontom", dimension: "object_tag", labelRu: "С зонтом", labelEn: "With umbrella", urlPath: "/promty-dlya-foto/s-zontom" },
  { slug: "s_knigoy", dimension: "object_tag", labelRu: "С книгой", labelEn: "With book", urlPath: "/promty-dlya-foto/s-knigoy" },
  { slug: "s_gitaroy", dimension: "object_tag", labelRu: "С гитарой", labelEn: "With guitar", urlPath: "/promty-dlya-foto/s-gitaroy" },
  { slug: "s_tykvoy", dimension: "object_tag", labelRu: "С тыквой", labelEn: "With pumpkin", urlPath: "/promty-dlya-foto/s-tykvoy" },
  { slug: "s_naushnikami", dimension: "object_tag", labelRu: "С наушниками", labelEn: "With headphones", urlPath: "/promty-dlya-foto/s-naushnikami" },
  { slug: "s_mandarinami", dimension: "object_tag", labelRu: "С мандаринами", labelEn: "With tangerines", urlPath: "/promty-dlya-foto/s-mandarinami" },
  { slug: "s_girlyandami", dimension: "object_tag", labelRu: "С гирляндами", labelEn: "With garlands", urlPath: "/promty-dlya-foto/s-girlyandami" },
  { slug: "iphone", dimension: "object_tag", labelRu: "С iPhone", labelEn: "With iPhone", urlPath: "/promty-dlya-foto/iphone" },
  // Styles
  { slug: "fine_art", dimension: "style_tag", labelRu: "Fine Art", labelEn: "Fine Art", urlPath: "/stil/fine-art" },
  { slug: "s_samovarom", dimension: "object_tag", labelRu: "С самоваром", labelEn: "With samovar", urlPath: "/promty-dlya-foto/s-samovarom" },
  { slug: "na_krasnom_fone", dimension: "object_tag", labelRu: "На красном фоне", labelEn: "On red background", urlPath: "/promty-dlya-foto/na-krasnom-fone" },
  { slug: "na_rozovom_fone", dimension: "object_tag", labelRu: "На розовом фоне", labelEn: "On pink background", urlPath: "/promty-dlya-foto/na-rozovom-fone" },
  { slug: "s_maskoy", dimension: "object_tag", labelRu: "С маской", labelEn: "With mask", urlPath: "/promty-dlya-foto/s-maskoy" },
  { slug: "s_konfetami", dimension: "object_tag", labelRu: "С конфетами", labelEn: "With sweets", urlPath: "/promty-dlya-foto/s-konfetami" },
  { slug: "s_igrushkoy", dimension: "object_tag", labelRu: "С игрушкой", labelEn: "With toy", urlPath: "/promty-dlya-foto/s-igrushkoy" },
  { slug: "na_lestnice", dimension: "object_tag", labelRu: "На лестнице", labelEn: "On staircase", urlPath: "/promty-dlya-foto/na-lestnice" },
  { slug: "s_zhurnalom", dimension: "object_tag", labelRu: "С журналом", labelEn: "With magazine", urlPath: "/promty-dlya-foto/s-zhurnalom" },
  // ── Added from Hvhvgybot dataset (2026-03-15) ──
  { slug: "s_pionami", dimension: "object_tag", labelRu: "С пионами", labelEn: "With peonies", urlPath: "/promty-dlya-foto/s-pionami" },
  { slug: "s_valentinkami", dimension: "object_tag", labelRu: "С валентинками", labelEn: "With valentines", urlPath: "/promty-dlya-foto/s-valentinkami" },
  { slug: "s_shokoladkoy", dimension: "object_tag", labelRu: "С шоколадкой", labelEn: "With chocolate", urlPath: "/promty-dlya-foto/s-shokoladkoy" },
  { slug: "s_otkrytkami", dimension: "object_tag", labelRu: "С открытками", labelEn: "With postcards", urlPath: "/promty-dlya-foto/s-otkrytkami" },
  { slug: "s_serdechkami", dimension: "object_tag", labelRu: "С сердечками", labelEn: "With hearts", urlPath: "/promty-dlya-foto/s-serdechkami" },
  { slug: "s_lentami", dimension: "object_tag", labelRu: "С лентами", labelEn: "With ribbons", urlPath: "/promty-dlya-foto/s-lentami" },
  { slug: "na_stole", dimension: "object_tag", labelRu: "На столе", labelEn: "On table", urlPath: "/promty-dlya-foto/na-stole" },
  { slug: "s_cheburashkoy", dimension: "object_tag", labelRu: "С Чебурашкой", labelEn: "With Cheburashka", urlPath: "/promty-dlya-foto/s-cheburashkoy" },
];

// ── Lookup indexes (built once at import) ──

const byUrlPath = new Map<string, TagEntry>();
const bySlug = new Map<string, TagEntry>();
const byLastSegment = new Map<string, TagEntry[]>();

for (const entry of TAG_REGISTRY) {
  const normalized = entry.urlPath.endsWith("/")
    ? entry.urlPath.slice(0, -1)
    : entry.urlPath;
  byUrlPath.set(normalized, entry);
  bySlug.set(`${entry.dimension}:${entry.slug}`, entry);

  const lastSeg = normalized.split("/").filter(Boolean).pop();
  if (lastSeg) {
    const existing = byLastSegment.get(lastSeg) ?? [];
    existing.push(entry);
    byLastSegment.set(lastSeg, existing);
  }
}

export function findTagByUrlPath(path: string): TagEntry | null {
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  return byUrlPath.get(normalized) ?? null;
}

export function findTagBySlug(dimension: Dimension, slug: string): TagEntry | null {
  return bySlug.get(`${dimension}:${slug}`) ?? null;
}

/**
 * Find a tag by the last URL segment, excluding specified dimensions.
 * Used by route-resolver for L2/L3 slug matching.
 */
export function findTagByLastSegment(
  segment: string,
  excludeDimensions: Dimension[] = [],
): TagEntry | null {
  const candidates = byLastSegment.get(segment);
  if (!candidates) return null;
  return candidates.find((t) => !excludeDimensions.includes(t.dimension)) ?? null;
}

/** Dimension priority for canonical URL ordering and breadcrumbs */
const DIMENSION_PRIORITY: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

export function getFirstTagFromSeoTags(seoTags: Record<string, unknown> | null): TagEntry | null {
  if (!seoTags) return null;
  for (const dim of DIMENSION_PRIORITY) {
    const arr = (seoTags[dim] || []) as string[];
    const slug = arr[0];
    if (slug) {
      const entry = findTagBySlug(dim, slug);
      if (entry) return entry;
    }
  }
  return null;
}

export { DIMENSION_PRIORITY };

export function getTagsByDimension(dimension: Dimension): TagEntry[] {
  return TAG_REGISTRY.filter((e) => e.dimension === dimension);
}

/** Returns sibling tags (same dimension) for internal linking. Excludes current tag. */
export function getSiblingTags(tag: TagEntry, limit = 6): TagEntry[] {
  const same = TAG_REGISTRY.filter((e) => e.dimension === tag.dimension && e.slug !== tag.slug);
  return same.slice(0, limit);
}

/** All urlPaths for sitemap / generateStaticParams */
export function getAllTagPaths(): string[] {
  return TAG_REGISTRY.map((e) => (e.urlPath.startsWith("/") ? e.urlPath.slice(1) : e.urlPath));
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  audience_tag: "Люди и отношения",
  style_tag: "Стили",
  occasion_tag: "События",
  object_tag: "Сцены и объекты",
  doc_task_tag: "Задачи",
};

/** Dimensions used for visible tag chips on card pages (matches current /p/[slug] behavior) */
const SEO_TAG_DIMENSIONS: Dimension[] = [
  "audience_tag",
  "style_tag",
  "occasion_tag",
  "object_tag",
  "doc_task_tag",
];

/**
 * Builds the enriched tag list for UI (chips + links) from raw seo_tags.
 * Used both on server pages and now in the client-side modal for parity.
 */
export function getSeoSlugsWithTags(
  seoTags: Record<string, unknown> | null
): { slug: string; label: string; href: string | null }[] {
  if (!seoTags) return [];
  const result: { slug: string; label: string; href: string | null }[] = [];
  const seenSlugs = new Set<string>();
  for (const dim of SEO_TAG_DIMENSIONS) {
    const arr = (seoTags[dim] || []) as string[];
    for (const rawSlug of arr) {
      const slug = typeof rawSlug === "string" ? rawSlug.trim() : "";
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      const entry = findTagBySlug(dim, slug);
      result.push({
        slug,
        label: entry?.labelRu ?? slug,
        href: entry ? entry.urlPath : null,
      });
    }
  }
  return result;
}
