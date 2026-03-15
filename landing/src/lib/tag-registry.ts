export type Dimension =
  | "audience_tag"
  | "style_tag"
  | "occasion_tag"
  | "object_tag"
  | "doc_task_tag";

export type TagEntry = {
  slug: string;
  dimension: Dimension;
  labelRu: string;
  labelEn: string;
  urlPath: string;
  /** Regex patterns for extracting this tag from prompt text (used by fill-seo-tags) */
  patterns: RegExp[];
};

export const TAG_REGISTRY: TagEntry[] = [
  // ── audience_tag ──
  { slug: "devushka", dimension: "audience_tag", labelRu: "Девушки", labelEn: "Women", urlPath: "/promty-dlya-foto-devushki", patterns: [/девушк|женщин|женск|леди|дам[аыу](?![а-яё])|модель\s+в\s+платье|в\s+юбке|макияж.*портрет|портрет.*макияж/i] },
  { slug: "muzhchina", dimension: "audience_tag", labelRu: "Мужчины", labelEn: "Men", urlPath: "/promty-dlya-foto-muzhchiny", patterns: [/мужчин|мужск|парень|молодой\s+человек|мужик/i] },
  { slug: "para", dimension: "audience_tag", labelRu: "Пары", labelEn: "Couples", urlPath: "/promty-dlya-foto-par", patterns: [/пар[аыу](?![а-яё])|парн|вдвоем/i] },
  { slug: "semya", dimension: "audience_tag", labelRu: "Семья", labelEn: "Family", urlPath: "/promty-dlya-semejnogo-foto", patterns: [/семейн(?!ого\s+(альбом|архив))|семья/i] },
  { slug: "detskie", dimension: "audience_tag", labelRu: "Дети", labelEn: "Kids", urlPath: "/promty-dlya-detskih-foto", patterns: [/детск|ребен/i] },
  { slug: "s_mamoy", dimension: "audience_tag", labelRu: "С мамой", labelEn: "With mother", urlPath: "/promty-dlya-foto-s-mamoy", patterns: [/с мамой|мам[аыуе](?![а-яё])|мамочк|мамул|мать(?![а-яё])|матери(?![а-яё])|матерью/i] },
  { slug: "s_papoy", dimension: "audience_tag", labelRu: "С папой", labelEn: "With father", urlPath: "/promty-dlya-foto-s-papoy", patterns: [/с папой|пап[аыуе](?![а-яё])|папочк|отец|отц[ауе]/i] },
  { slug: "s_parnem", dimension: "audience_tag", labelRu: "С парнем", labelEn: "With boyfriend", urlPath: "/promty-dlya-foto-s-parnem", patterns: [/с парнем|парн[яюеи]|бойфренд/i] },
  { slug: "s_muzhem", dimension: "audience_tag", labelRu: "С мужем", labelEn: "With husband", urlPath: "/promty-dlya-foto-s-muzhem", patterns: [/с мужем|муж[аеу](?![чс])|супруг/i] },
  { slug: "s_podrugoy", dimension: "audience_tag", labelRu: "С подругой", labelEn: "With friend", urlPath: "/promty-dlya-foto-s-podrugoy", patterns: [/с подругой|подруг[аиу]|подружк/i] },
  { slug: "s_drugom", dimension: "audience_tag", labelRu: "С другом", labelEn: "With friend", urlPath: "/promty-dlya-foto-s-drugom", patterns: [/с другом|друг[аеу](?![а-яё])|дружк/i] },
  { slug: "s_synom", dimension: "audience_tag", labelRu: "С сыном", labelEn: "With son", urlPath: "/promty-dlya-foto-s-synom", patterns: [/с сыном|сын[оу](?![а-яё])|сыноч|сынишк/i] },
  { slug: "s_dochkoy", dimension: "audience_tag", labelRu: "С дочкой", labelEn: "With daughter", urlPath: "/promty-dlya-foto-s-dochkoy", patterns: [/с дочкой|с дочерью|дочк[аиу]|дочь|дочер/i] },
  { slug: "s_sestroy", dimension: "audience_tag", labelRu: "С сестрой", labelEn: "With sister", urlPath: "/promty-dlya-foto-s-sestroy", patterns: [/с сестрой|сестр[аыуе]|сестрёнк|сестренк/i] },
  { slug: "s_bratom", dimension: "audience_tag", labelRu: "С братом", labelEn: "With brother", urlPath: "/promty-dlya-foto-s-bratom", patterns: [/с братом|брат[аеу](?![а-яё])|братик|братишк/i] },
  { slug: "s_babushkoy", dimension: "audience_tag", labelRu: "С бабушкой", labelEn: "With grandmother", urlPath: "/promty-dlya-foto-s-babushkoy", patterns: [/с бабушкой|бабушк[аиу]|бабул/i] },
  { slug: "malchik", dimension: "audience_tag", labelRu: "Мальчик", labelEn: "Boy", urlPath: "/promty-dlya-foto-malchik", patterns: [/мальчик/i] },
  { slug: "devochka", dimension: "audience_tag", labelRu: "Девочка", labelEn: "Girl", urlPath: "/promty-dlya-foto-devochka", patterns: [/девочка/i] },
  { slug: "podrostok", dimension: "audience_tag", labelRu: "Подросток", labelEn: "Teenager", urlPath: "/promty-dlya-foto-podrostok", patterns: [/подросток/i] },
  { slug: "malysh", dimension: "audience_tag", labelRu: "Малыш", labelEn: "Baby", urlPath: "/promty-dlya-foto-malysh", patterns: [/малыш|младенец/i] },
  { slug: "pokoleniy", dimension: "audience_tag", labelRu: "Поколения", labelEn: "Generations", urlPath: "/promty-dlya-foto-pokoleniy", patterns: [/поколений|поколения/i] },
  { slug: "vlyublennykh", dimension: "audience_tag", labelRu: "Влюблённые", labelEn: "Lovers", urlPath: "/promty-dlya-foto-vlyublennykh", patterns: [/влюблён|влюблен/i] },
  { slug: "s_pitomcem", dimension: "audience_tag", labelRu: "С питомцем", labelEn: "With pet", urlPath: "/promty-dlya-foto-s-pitomcem", patterns: [/с питомц|с животн/i] },
  { slug: "beremennaya", dimension: "audience_tag", labelRu: "Беременная", labelEn: "Pregnant", urlPath: "/promty-dlya-foto-beremennaya", patterns: [/беременн/i] },

  // ── style_tag ──
  { slug: "cherno_beloe", dimension: "style_tag", labelRu: "Чёрно-белое", labelEn: "Black & White", urlPath: "/stil/cherno-beloe", patterns: [/черно-бел|чёрно-бел|монохром/i] },
  { slug: "realistichnoe", dimension: "style_tag", labelRu: "Реалистичное", labelEn: "Realistic", urlPath: "/stil/realistichnoe", patterns: [/реалист|фотореализ|гиперреалист/i] },
  { slug: "portret", dimension: "style_tag", labelRu: "Портрет", labelEn: "Portrait", urlPath: "/stil/portret", patterns: [/портрет/i] },
  { slug: "3d", dimension: "style_tag", labelRu: "3D", labelEn: "3D", urlPath: "/stil/3d", patterns: [/3д|3d/i] },
  { slug: "gta", dimension: "style_tag", labelRu: "GTA", labelEn: "GTA", urlPath: "/stil/gta", patterns: [/гта|gta/i] },
  { slug: "studiynoe", dimension: "style_tag", labelRu: "Студийное", labelEn: "Studio", urlPath: "/stil/studiynoe", patterns: [/студийн|студи[яюей](?![а-яё])|studio/i] },
  { slug: "love_is", dimension: "style_tag", labelRu: "Love Is", labelEn: "Love Is", urlPath: "/stil/love-is", patterns: [/love is|лав ис/i] },
  { slug: "delovoe", dimension: "style_tag", labelRu: "Деловое", labelEn: "Business", urlPath: "/stil/delovoe", patterns: [/делов|бизнес/i] },
  { slug: "multyashnoe", dimension: "style_tag", labelRu: "Мультяшное", labelEn: "Cartoon", urlPath: "/stil/multyashnoe", patterns: [/мультяш|мультик/i] },
  { slug: "kollazh", dimension: "style_tag", labelRu: "Коллаж", labelEn: "Collage", urlPath: "/stil/kollazh", patterns: [/коллаж/i] },
  { slug: "otkrytka", dimension: "style_tag", labelRu: "Открытка", labelEn: "Postcard", urlPath: "/stil/otkrytka", patterns: [/открытк/i] },
  { slug: "sovetskoe", dimension: "style_tag", labelRu: "Советское", labelEn: "Soviet", urlPath: "/stil/sovetskoe", patterns: [/совет/i] },
  { slug: "retro", dimension: "style_tag", labelRu: "Ретро", labelEn: "Retro", urlPath: "/stil/retro", patterns: [/ретро/i] },
  { slug: "anime", dimension: "style_tag", labelRu: "Аниме", labelEn: "Anime", urlPath: "/stil/anime", patterns: [/аниме/i] },
  { slug: "polaroid", dimension: "style_tag", labelRu: "Полароид", labelEn: "Polaroid", urlPath: "/stil/polaroid", patterns: [/полароид|polaroid/i] },
  { slug: "disney", dimension: "style_tag", labelRu: "Disney", labelEn: "Disney", urlPath: "/stil/disney", patterns: [/дисней|disney/i] },
  { slug: "selfi", dimension: "style_tag", labelRu: "Селфи", labelEn: "Selfie", urlPath: "/stil/selfi", patterns: [/селфи|selfie|зеркальн\w+\s+фот/i] },
  { slug: "piksar", dimension: "style_tag", labelRu: "Pixar", labelEn: "Pixar", urlPath: "/stil/piksar", patterns: [/пиксар|pixar/i] },
  { slug: "neonovoe", dimension: "style_tag", labelRu: "Неоновое", labelEn: "Neon", urlPath: "/stil/neonovoe", patterns: [/неоновый\s+стиль|неоновое\s+фото|неоновая\s+(подсветка|съёмка|фотосессия)|в\s+неоновом\s+стиле|под\s+неоновыми\s+огнями|неон(?![а-яё])|neon\b/i] },
  { slug: "street_style", dimension: "style_tag", labelRu: "Street Style", labelEn: "Street Style", urlPath: "/stil/street-style", patterns: [/street.?style|стрит.?стайл/i] },
  { slug: "fashion", dimension: "style_tag", labelRu: "Fashion", labelEn: "Fashion", urlPath: "/stil/fashion", patterns: [/fashion|фэшн|фешн/i] },
  { slug: "glyanec", dimension: "style_tag", labelRu: "Глянец", labelEn: "Glossy", urlPath: "/stil/glyanec", patterns: [/глянц|журнал(?![а-яё])/i] },
  { slug: "victorias_secret", dimension: "style_tag", labelRu: "Victoria's Secret", labelEn: "Victoria's Secret", urlPath: "/stil/victorias-secret", patterns: [/victoria.?s secret|виктория.?сикрет/i] },
  { slug: "barbie", dimension: "style_tag", labelRu: "Barbie", labelEn: "Barbie", urlPath: "/stil/barbie", patterns: [/barbie|барби/i] },

  // ── occasion_tag ──
  { slug: "den_rozhdeniya", dimension: "occasion_tag", labelRu: "День рождения", labelEn: "Birthday", urlPath: "/sobytiya/den-rozhdeniya", patterns: [/день рождения|на др(?![а-яё])/i] },
  { slug: "8_marta", dimension: "occasion_tag", labelRu: "8 марта", labelEn: "March 8", urlPath: "/sobytiya/8-marta", patterns: [/8 марта/i] },
  { slug: "14_fevralya", dimension: "occasion_tag", labelRu: "14 февраля", labelEn: "Valentine's Day", urlPath: "/sobytiya/14-fevralya", patterns: [/14 февраля|день влюбленных|валентин/i] },
  { slug: "23_fevralya", dimension: "occasion_tag", labelRu: "23 февраля", labelEn: "Feb 23", urlPath: "/sobytiya/23-fevralya", patterns: [/23 февраля/i] },
  { slug: "maslenica", dimension: "occasion_tag", labelRu: "Масленица", labelEn: "Maslenitsa", urlPath: "/sobytiya/maslenica", patterns: [/маслениц/i] },
  { slug: "novyy_god", dimension: "occasion_tag", labelRu: "Новый год", labelEn: "New Year", urlPath: "/sobytiya/novyj-god", patterns: [/новый год|новогодн/i] },
  { slug: "svadba", dimension: "occasion_tag", labelRu: "Свадьба", labelEn: "Wedding", urlPath: "/sobytiya/svadba", patterns: [/свадьб/i] },
  { slug: "rozhdestvo", dimension: "occasion_tag", labelRu: "Рождество", labelEn: "Christmas", urlPath: "/sobytiya/rozhdestvo", patterns: [/рождеств|christmas/i] },

  // ── object_tag ──
  { slug: "v_forme", dimension: "object_tag", labelRu: "В форме", labelEn: "In uniform", urlPath: "/v-forme", patterns: [/в форм|военн|солдат/i] },
  { slug: "s_mashinoy", dimension: "object_tag", labelRu: "С машиной", labelEn: "With car", urlPath: "/s-mashinoy", patterns: [/с машин|авто|тачк/i] },
  { slug: "s_cvetami", dimension: "object_tag", labelRu: "С цветами", labelEn: "With flowers", urlPath: "/s-cvetami", patterns: [/с цвет|букет|тюльпан|роз[аыуой]|розов|розам|пион|мимоз|ромашк|лепестк|сирен|цветоч|цвет[оа]к|лаванд|орхиде|гортенз/i] },
  { slug: "so_znamenitostyu", dimension: "object_tag", labelRu: "Со знаменитостью", labelEn: "With celebrity", urlPath: "/so-znamenitostyu", patterns: [/со знаменит|с кумир|со звезд/i] },
  { slug: "v_profil", dimension: "object_tag", labelRu: "В профиль", labelEn: "Profile", urlPath: "/v-profil", patterns: [/в профиль|боком/i] },
  { slug: "s_kotom", dimension: "object_tag", labelRu: "С котом", labelEn: "With cat", urlPath: "/s-kotom", patterns: [/с кот|котёнк|котенк|кошк|кошеч/i] },
  { slug: "v_kostyume", dimension: "object_tag", labelRu: "В костюме", labelEn: "In suit", urlPath: "/v-kostyume", patterns: [/в костюм|в пиджак/i] },
  { slug: "na_chernom_fone", dimension: "object_tag", labelRu: "На чёрном фоне", labelEn: "On black background", urlPath: "/na-chernom-fone", patterns: [/на\s+чёрн\w*\s+фон|на\s+черн\w*\s+фон|тёмн\w+\s+фон|чёрный\s+фон|черный\s+фон/i] },
  { slug: "s_tortom", dimension: "object_tag", labelRu: "С тортом", labelEn: "With cake", urlPath: "/s-tortom", patterns: [/с торт/i] },
  { slug: "zima", dimension: "object_tag", labelRu: "Зима", labelEn: "Winter", urlPath: "/zima", patterns: [/зимн|снег|заснеж|мороз|метел|иней|сугроб|холодн\w+\s+(свет|воздух|утр|вечер)/i] },
  { slug: "v_zerkale", dimension: "object_tag", labelRu: "В зеркале", labelEn: "In mirror", urlPath: "/v-zerkale", patterns: [/в зеркал/i] },
  { slug: "vesna", dimension: "object_tag", labelRu: "Весна", labelEn: "Spring", urlPath: "/vesna", patterns: [/весенн|весна|в\s+цвету|цветущ/i] },
  { slug: "s_sobakoy", dimension: "object_tag", labelRu: "С собакой", labelEn: "With dog", urlPath: "/s-sobakoj", patterns: [/с собак|пёс|пес(?![а-яё])/i] },
  { slug: "v_lesu", dimension: "object_tag", labelRu: "В лесу", labelEn: "In forest", urlPath: "/v-lesu", patterns: [/в лес|лесн|деревь|ёлк|елок|берёз|хвойн|сосн/i] },
  { slug: "s_koronoy", dimension: "object_tag", labelRu: "С короной", labelEn: "With crown", urlPath: "/s-koronoy", patterns: [/с корон/i] },
  { slug: "na_more", dimension: "object_tag", labelRu: "На море", labelEn: "At sea", urlPath: "/na-more", patterns: [/на мор|пляж|океан|побереж|прибой|набережн|у\s+моря/i] },
  { slug: "v_polnyy_rost", dimension: "object_tag", labelRu: "В полный рост", labelEn: "Full body", urlPath: "/v-polnyy-rost", patterns: [/в полный рост|во\s+весь\s+рост|в\s+рост(?![а-яё])/i] },
  { slug: "v_gorah", dimension: "object_tag", labelRu: "В горах", labelEn: "In mountains", urlPath: "/v-gorah", patterns: [/в\s+гор(?!од)|горн\w+\s+(пейзаж|вершин|хребет|склон)/i] },
  { slug: "na_ulice", dimension: "object_tag", labelRu: "На улице", labelEn: "Outdoor", urlPath: "/na-ulice", patterns: [/на улиц|уличн|переулк/i] },
  { slug: "v_mashine", dimension: "object_tag", labelRu: "В машине", labelEn: "In car", urlPath: "/v-mashine", patterns: [/в машин|за рулём|за рулем|в салоне авто/i] },
  { slug: "na_yahte", dimension: "object_tag", labelRu: "На яхте", labelEn: "On yacht", urlPath: "/na-yahte", patterns: [/на яхте|яхт[аыуе](?![а-яё])/i] },
  { slug: "v_restorane", dimension: "object_tag", labelRu: "В ресторане", labelEn: "In restaurant", urlPath: "/v-restorane", patterns: [/в ресторан|в кафе|бистро/i] },
  { slug: "na_kryshe", dimension: "object_tag", labelRu: "На крыше", labelEn: "On rooftop", urlPath: "/na-kryshe", patterns: [/на крыш/i] },
  { slug: "v_pustyne", dimension: "object_tag", labelRu: "В пустыне", labelEn: "In desert", urlPath: "/v-pustyne", patterns: [/в пустын|барханы|барханов/i] },
  { slug: "pod_vodoy", dimension: "object_tag", labelRu: "Под водой", labelEn: "Underwater", urlPath: "/pod-vodoy", patterns: [/под водой|подводн/i] },
  { slug: "v_gorode", dimension: "object_tag", labelRu: "В городе", labelEn: "In city", urlPath: "/v-gorode", patterns: [/небоскрёб|небоскреб|мегапол|городск|на\s+фоне\s+город|ночн\w+\s+город/i] },
  { slug: "s_shuboj", dimension: "object_tag", labelRu: "В шубе", labelEn: "In fur coat", urlPath: "/s-shuboj", patterns: [/в шубе|шуба|шубой|меховой|меховая|меховую/i] },
  { slug: "so_svechami", dimension: "object_tag", labelRu: "Со свечами", labelEn: "With candles", urlPath: "/so-svechami", patterns: [/со свеч|при свечах|свечой|свечей|свечи|свечам|свечу|свеча/i] },
  { slug: "v_platye", dimension: "object_tag", labelRu: "В платье", labelEn: "In dress", urlPath: "/v-platye", patterns: [/в платье|платья|платьем/i] },
  { slug: "s_bokalom", dimension: "object_tag", labelRu: "С бокалом", labelEn: "With glass", urlPath: "/s-bokalom", patterns: [/бокал|шампанск/i] },
  { slug: "s_kofe", dimension: "object_tag", labelRu: "С кофе", labelEn: "With coffee", urlPath: "/s-kofe", patterns: [/кофе|чашечк/i] },

  { slug: "na_avatarku", dimension: "object_tag", labelRu: "На аватарку", labelEn: "For avatar", urlPath: "/foto-na-avatarku", patterns: [/на аватарк|на аву|аватар/i] },

  // ── LLM-discovered tags ──
  { slug: "kinematograficheskoe", dimension: "style_tag", labelRu: "Кинематографическое", labelEn: "Cinematic", urlPath: "/stil/kinematograficheskoe", patterns: [/кинематограф/i] },
  { slug: "y2k", dimension: "style_tag", labelRu: "Y2K", labelEn: "Y2K", urlPath: "/stil/y2k", patterns: [/y2k/i] },
  { slug: "lifestyle", dimension: "style_tag", labelRu: "Лайфстайл", labelEn: "Lifestyle", urlPath: "/stil/lifestyle", patterns: [/лайфстайл|lifestyle/i] },
  { slug: "vintazhnoe", dimension: "style_tag", labelRu: "Винтажное", labelEn: "Vintage", urlPath: "/stil/vintazhnoe", patterns: [/винтаж|vintage/i] },
  { slug: "s_elkoj", dimension: "object_tag", labelRu: "С ёлкой", labelEn: "With Christmas tree", urlPath: "/s-elkoj", patterns: [/с ёлк|с елк|ёлочк|елочк/i] },
  { slug: "s_sharami", dimension: "object_tag", labelRu: "С шарами", labelEn: "With balloons", urlPath: "/s-sharami", patterns: [/с шар|воздушн\w+\s+шар|шарик/i] },
  { slug: "na_belom_fone", dimension: "object_tag", labelRu: "На белом фоне", labelEn: "On white background", urlPath: "/na-belom-fone", patterns: [/на\s+бел\w*\s+фон|белый\s+фон/i] },
  { slug: "v_interere", dimension: "object_tag", labelRu: "В интерьере", labelEn: "Indoors", urlPath: "/v-interere", patterns: [/в интерьер|интерьерн/i] },
  { slug: "s_podarkami", dimension: "object_tag", labelRu: "С подарками", labelEn: "With gifts", urlPath: "/s-podarkami", patterns: [/с подарк|подарочн/i] },
  { slug: "s_ochkami", dimension: "object_tag", labelRu: "С очками", labelEn: "With glasses", urlPath: "/s-ochkami", patterns: [/с очками|в очках|очки/i] },

  // ── LLM-discovered tags ──
  { slug: "fotorealizm", dimension: "style_tag", labelRu: "Фотореализм", labelEn: "Photorealism", urlPath: "/stil/fotorealizm", patterns: [] },
  { slug: "minimalizm", dimension: "style_tag", labelRu: "Минимализм", labelEn: "Minimalism", urlPath: "/stil/minimalizm", patterns: [] },
  { slug: "vysokaya_moda", dimension: "style_tag", labelRu: "Высокая мода", labelEn: "High fashion", urlPath: "/stil/vysokaya-moda", patterns: [] },
  { slug: "s_pitomcem", dimension: "object_tag", labelRu: "s_pitomcem", labelEn: "s_pitomcem", urlPath: "/s-pitomcem", patterns: [] },

  // ── LLM-discovered tags ──
  { slug: "editorial", dimension: "style_tag", labelRu: "Эдиториал", labelEn: "Editorial", urlPath: "/stil/editorial", patterns: [] },
  { slug: "noch", dimension: "object_tag", labelRu: "Ночь", labelEn: "Night", urlPath: "/noch", patterns: [] },

  // ── LLM-discovered tags (batch 2026-03-13) ──
  { slug: "osen", dimension: "object_tag", labelRu: "Осень", labelEn: "Autumn", urlPath: "/osen", patterns: [/осенн|осень|листопад|жёлтые\s+лист|желтые\s+лист/i] },
  { slug: "leto", dimension: "object_tag", labelRu: "Лето", labelEn: "Summer", urlPath: "/leto", patterns: [/летн|лето(?![а-яё])/i] },
  { slug: "v_pole", dimension: "object_tag", labelRu: "В поле", labelEn: "In a field", urlPath: "/v-pole", patterns: [/в\s+пол[ею]|полевы|среди\s+колос/i] },
  { slug: "s_loshadyu", dimension: "object_tag", labelRu: "С лошадью", labelEn: "With horse", urlPath: "/s-loshadyu", patterns: [/с лошадью|лошад|конь|коня|конём/i] },
  { slug: "romanticheskiy", dimension: "style_tag", labelRu: "Романтический", labelEn: "Romantic", urlPath: "/stil/romanticheskiy", patterns: [/романтич/i] },
  { slug: "bokho_stil", dimension: "style_tag", labelRu: "Бохо-стиль", labelEn: "Boho style", urlPath: "/stil/bokho-stil", patterns: [/бохо|boho/i] },
  { slug: "etno_stil", dimension: "style_tag", labelRu: "Этно-стиль", labelEn: "Ethno style", urlPath: "/stil/etno-stil", patterns: [/этно|ethno/i] },

  // ── LLM-discovered tags (batch 2026-03-14, PixelNanoBot) ──
  { slug: "ultrarealistichnoe", dimension: "style_tag", labelRu: "Ультрареалистичное", labelEn: "Ultra-realistic", urlPath: "/stil/ultrarealistichnoe", patterns: [/ultra.?realist|ультрареалист/i] },
  { slug: "s_shuboy", dimension: "object_tag", labelRu: "С шубой", labelEn: "With fur coat", urlPath: "/s-shuboy", patterns: [/в\s+шуб|с\s+шуб|шуба|шубк/i] },
  { slug: "v_basseyne", dimension: "object_tag", labelRu: "В бассейне", labelEn: "In pool", urlPath: "/v-basseyne", patterns: [/в\s+бассейн|бассейн/i] },
  { slug: "vintazhnyy_avtomobil", dimension: "object_tag", labelRu: "Винтажный автомобиль", labelEn: "Vintage car", urlPath: "/vintazhnyy-avtomobil", patterns: [/винтажн\S*\s+авто|ретро.?авто|старинн\S*\s+авто|vintage\s+car/i] },
  { slug: "s_medvedem", dimension: "object_tag", labelRu: "С медведем", labelEn: "With bear", urlPath: "/s-medvedem", patterns: [/с\s+медвед|медведь|медведем/i] },
  { slug: "glam", dimension: "style_tag", labelRu: "Глэм", labelEn: "Glam", urlPath: "/stil/glam", patterns: [/глэм|глам|glam/i] },
  { slug: "v_sportale", dimension: "object_tag", labelRu: "В спортзале", labelEn: "In gym", urlPath: "/v-sportale", patterns: [/в\s+спортзал|в\s+тренажёрн|в\s+тренажерн|спортзал|gym/i] },

  // ── LLM-discovered tags (batch 2026-03-14, GPTFluxBot) ──
  { slug: "na_krovati", dimension: "object_tag", labelRu: "На кровати", labelEn: "On bed", urlPath: "/na-krovati", patterns: [/на\s+кроват|в\s+кроват|в\s+постел|на\s+постел/i] },
  { slug: "halloween", dimension: "occasion_tag", labelRu: "Хэллоуин", labelEn: "Halloween", urlPath: "/halloween", patterns: [/хэллоуин|хеллоуин|halloween|hellouin/i] },

  // ── doc_task_tag ──
  { slug: "na_pasport", dimension: "doc_task_tag", labelRu: "На паспорт", labelEn: "For passport", urlPath: "/foto-na-pasport", patterns: [/на паспорт|паспортн/i] },
  { slug: "na_dokumenty", dimension: "doc_task_tag", labelRu: "На документы", labelEn: "For documents", urlPath: "/foto-na-dokumenty", patterns: [/на документ/i] },
  { slug: "na_rezume", dimension: "doc_task_tag", labelRu: "Для резюме", labelEn: "For resume", urlPath: "/foto-na-rezume", patterns: [/для резюме|на резюме|резюме/i] },
  { slug: "na_zagranpasport", dimension: "doc_task_tag", labelRu: "На загранпаспорт", labelEn: "For international passport", urlPath: "/foto-na-zagranpasport", patterns: [/загранпаспорт|загран/i] },

  // ── LLM-discovered tags (batch 2026-03-14, ii_photolab) ──
  { slug: "v_studii", dimension: "object_tag", labelRu: "В студии", labelEn: "In studio", urlPath: "/v-studii", patterns: [/в\s+студи|студийн/i] },
  { slug: "produktovaya_fotografiya", dimension: "style_tag", labelRu: "Продуктовая фотография", labelEn: "Product photography", urlPath: "/stil/produktovaya-fotografiya", patterns: [/продуктов\S*\s+фото|product\s+photo/i] },
  { slug: "art_deco", dimension: "style_tag", labelRu: "Арт-деко", labelEn: "Art Deco", urlPath: "/stil/art-deco", patterns: [/арт.?деко|art.?deco/i] },
  { slug: "na_naberezhnoj", dimension: "object_tag", labelRu: "На набережной", labelEn: "On embankment", urlPath: "/na-naberezhnoj", patterns: [/на\s+набережн|набережн/i] },

  // ── LLM-discovered tags (full recompute 2026-03-14) ──
  { slug: "giperrealistichnoe", dimension: "style_tag", labelRu: "Гиперреалистичное", labelEn: "Hyperrealistic", urlPath: "/stil/giperrealistichnoe", patterns: [/гиперреалист|hyperrealist/i] },
  { slug: "na_okne", dimension: "object_tag", labelRu: "У окна", labelEn: "By the window", urlPath: "/na-okne", patterns: [/у\s+окн|на\s+окн|возле\s+окн|у\s+подоконник/i] },
  { slug: "na_balkone", dimension: "object_tag", labelRu: "На балконе", labelEn: "On balcony", urlPath: "/na-balkone", patterns: [/на\s+балкон|балкон/i] },
  { slug: "v_metroe", dimension: "object_tag", labelRu: "В метро", labelEn: "In metro", urlPath: "/v-metroe", patterns: [/в\s+метро|метро/i] },
  { slug: "v_lifte", dimension: "object_tag", labelRu: "В лифте", labelEn: "In elevator", urlPath: "/v-lifte", patterns: [/в\s+лифт|лифт/i] },
  { slug: "v_parke", dimension: "object_tag", labelRu: "В парке", labelEn: "In park", urlPath: "/v-parke", patterns: [/в\s+парк|парков/i] },
  { slug: "impressionizm", dimension: "style_tag", labelRu: "Импрессионизм", labelEn: "Impressionism", urlPath: "/stil/impressionizm", patterns: [/импрессионизм|impressionism/i] },

  // ── LLM-discovered tags (full recompute 2026-03-15) ──
  // Locations & interiors
  { slug: "v_spalne", dimension: "object_tag", labelRu: "В спальне", labelEn: "In bedroom", urlPath: "/v-spalne", patterns: [/в\s+спальн|спальня/i] },
  { slug: "kuhnya", dimension: "object_tag", labelRu: "На кухне", labelEn: "In kitchen", urlPath: "/kuhnya", patterns: [/на\s+кухн|кухня|кухонн/i] },
  { slug: "v_sadu", dimension: "object_tag", labelRu: "В саду", labelEn: "In garden", urlPath: "/v-sadu", patterns: [/в\s+саду|садов|в\s+сад(?![а-яё])/i] },
  { slug: "v_vannoy", dimension: "object_tag", labelRu: "В ванной", labelEn: "In bathroom", urlPath: "/v-vannoy", patterns: [/в\s+ванн|ванная|ванной/i] },
  // Seasons & weather
  { slug: "sneg", dimension: "object_tag", labelRu: "Снег", labelEn: "Snow", urlPath: "/sneg", patterns: [/снег|снежн|снежинк|снегопад/i] },
  { slug: "dozhd", dimension: "object_tag", labelRu: "Дождь", labelEn: "Rain", urlPath: "/dozhd", patterns: [/дожд|ливен|ливн/i] },
  { slug: "tuman", dimension: "object_tag", labelRu: "Туман", labelEn: "Fog", urlPath: "/tuman", patterns: [/туман|fog/i] },
  { slug: "zakat", dimension: "object_tag", labelRu: "Закат", labelEn: "Sunset", urlPath: "/zakat", patterns: [/закат|sunset|рассвет/i] },
  { slug: "zolotoy_chas", dimension: "object_tag", labelRu: "Золотой час", labelEn: "Golden hour", urlPath: "/zolotoy-chas", patterns: [/золот\S*\s+час|golden\s+hour/i] },
  // Animals & vehicles
  { slug: "mototsikl", dimension: "object_tag", labelRu: "Мотоцикл", labelEn: "Motorcycle", urlPath: "/mototsikl", patterns: [/мотоцикл|байк(?![а-яё])|motorcycle/i] },
  { slug: "velosiped", dimension: "object_tag", labelRu: "Велосипед", labelEn: "Bicycle", urlPath: "/velosiped", patterns: [/велосипед|bicycle/i] },
  // Flowers (specific)
  { slug: "s_tulpanami", dimension: "object_tag", labelRu: "С тюльпанами", labelEn: "With tulips", urlPath: "/s-tulpanami", patterns: [/тюльпан/i] },
  // Drinks
  { slug: "s_shampanskim", dimension: "object_tag", labelRu: "С шампанским", labelEn: "With champagne", urlPath: "/s-shampanskim", patterns: [/шампанск/i] },
  // Props
  { slug: "s_zontom", dimension: "object_tag", labelRu: "С зонтом", labelEn: "With umbrella", urlPath: "/s-zontom", patterns: [/с\s+зонт|зонтик|зонтом|umbrella/i] },
  { slug: "s_knigoy", dimension: "object_tag", labelRu: "С книгой", labelEn: "With book", urlPath: "/s-knigoy", patterns: [/с\s+книг|книга|книжк/i] },
  { slug: "s_gitaroy", dimension: "object_tag", labelRu: "С гитарой", labelEn: "With guitar", urlPath: "/s-gitaroy", patterns: [/гитар|guitar/i] },
  { slug: "s_tykvoy", dimension: "object_tag", labelRu: "С тыквой", labelEn: "With pumpkin", urlPath: "/s-tykvoy", patterns: [/тыкв|pumpkin/i] },
  { slug: "s_naushnikami", dimension: "object_tag", labelRu: "С наушниками", labelEn: "With headphones", urlPath: "/s-naushnikami", patterns: [/наушник|headphone/i] },
  { slug: "s_mandarinami", dimension: "object_tag", labelRu: "С мандаринами", labelEn: "With tangerines", urlPath: "/s-mandarinami", patterns: [/мандарин/i] },
  { slug: "s_girlyandami", dimension: "object_tag", labelRu: "С гирляндами", labelEn: "With garlands", urlPath: "/s-girlyandami", patterns: [/гирлянд/i] },
  { slug: "iphone", dimension: "object_tag", labelRu: "С iPhone", labelEn: "With iPhone", urlPath: "/iphone", patterns: [/iphone|айфон/i] },
  // Styles
  { slug: "fine_art", dimension: "style_tag", labelRu: "Fine Art", labelEn: "Fine Art", urlPath: "/stil/fine-art", patterns: [/fine\s*art|файн\s*арт/i] },
  { slug: "s_samovarom", dimension: "object_tag", labelRu: "С самоваром", labelEn: "With samovar", urlPath: "/s-samovarom", patterns: [/самовар/i] },
  { slug: "na_krasnom_fone", dimension: "object_tag", labelRu: "На красном фоне", labelEn: "On red background", urlPath: "/na-krasnom-fone", patterns: [/на\s+красн\w*\s+фон|красный\s+фон/i] },
  { slug: "na_rozovom_fone", dimension: "object_tag", labelRu: "На розовом фоне", labelEn: "On pink background", urlPath: "/na-rozovom-fone", patterns: [/на\s+розов\w*\s+фон|розовый\s+фон/i] },
  { slug: "s_maskoy", dimension: "object_tag", labelRu: "С маской", labelEn: "With mask", urlPath: "/s-maskoy", patterns: [/с\s+маск|маска|маске|маской/i] },
  { slug: "s_konfetami", dimension: "object_tag", labelRu: "С конфетами", labelEn: "With sweets", urlPath: "/s-konfetami", patterns: [/конфет|сладост/i] },
  { slug: "s_igrushkoy", dimension: "object_tag", labelRu: "С игрушкой", labelEn: "With toy", urlPath: "/s-igrushkoy", patterns: [/с\s+игрушк|игрушечн|плюшев/i] },
  { slug: "na_lestnice", dimension: "object_tag", labelRu: "На лестнице", labelEn: "On staircase", urlPath: "/na-lestnice", patterns: [/на\s+лестниц|лестница|ступен/i] },
  { slug: "s_zhurnalom", dimension: "object_tag", labelRu: "С журналом", labelEn: "With magazine", urlPath: "/s-zhurnalom", patterns: [/с\s+журнал|журнал(?!ьн)/i] },
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
