import { takeHeroMarqueeCards } from "./hero-marquee";

export type HeroGapChip = {
  label: string;
  queryKey: "audience" | "style";
  value: string;
};

export type HeroGapDimension = "audience_tag" | "style_tag" | "occasion_tag" | "doc_task_tag";

export type HeroGapHubSpec = {
  slug: string;
  dimension: HeroGapDimension;
  legacyPath: string;
  hubPath: string;
  label: string;
  chips: readonly HeroGapChip[];
};

export const HERO_GAP_HUB_SPECS: readonly HeroGapHubSpec[] = [
  { slug: "na_dokumenty", dimension: "doc_task_tag", legacyPath: "/foto-na-dokumenty", hubPath: "/promty-dlya-foto/foto-na-dokumenty", label: "На документы", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_pasport", dimension: "doc_task_tag", legacyPath: "/foto-na-pasport", hubPath: "/promty-dlya-foto/foto-na-pasport", label: "На паспорт", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_rezume", dimension: "doc_task_tag", legacyPath: "/foto-na-rezume", hubPath: "/promty-dlya-foto/foto-na-rezume", label: "Для резюме", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_zagranpasport", dimension: "doc_task_tag", legacyPath: "/foto-na-zagranpasport", hubPath: "/promty-dlya-foto/foto-na-zagranpasport", label: "На загранпаспорт", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "halloween", dimension: "occasion_tag", legacyPath: "/halloween", hubPath: "/promty-dlya-foto/halloween", label: "Хэллоуин", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "detskie", dimension: "audience_tag", legacyPath: "/promty-dlya-detskih-foto", hubPath: "/promty-dlya-foto/detskih-foto", label: "Дети", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "beremennaya", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-beremennaya", hubPath: "/promty-dlya-foto/beremennaya", label: "Беременная", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "devochka", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-devochka", hubPath: "/promty-dlya-foto/devochka", label: "Девочка", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "malchik", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-malchik", hubPath: "/promty-dlya-foto/malchik", label: "Мальчик", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "podrostok", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-podrostok", hubPath: "/promty-dlya-foto/podrostok", label: "Подросток", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "pokoleniy", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-pokoleniy", hubPath: "/promty-dlya-foto/pokoleniy", label: "Поколения", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_babushkoy", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-babushkoy", hubPath: "/promty-dlya-foto/s-babushkoy", label: "С бабушкой", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_bratom", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-bratom", hubPath: "/promty-dlya-foto/s-bratom", label: "С братом", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_drugom", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-drugom", hubPath: "/promty-dlya-foto/s-drugom", label: "С другом", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_mamoy", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-mamoy", hubPath: "/promty-dlya-foto/s-mamoy", label: "С мамой", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_muzhem", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-muzhem", hubPath: "/promty-dlya-foto/s-muzhem", label: "С мужем", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_papoy", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-papoy", hubPath: "/promty-dlya-foto/s-papoy", label: "С папой", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_podrugoy", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-podrugoy", hubPath: "/promty-dlya-foto/s-podrugoy", label: "С подругой", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_sestroy", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-sestroy", hubPath: "/promty-dlya-foto/s-sestroy", label: "С сестрой", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "s_synom", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-s-synom", hubPath: "/promty-dlya-foto/s-synom", label: "С сыном", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "vlyublennykh", dimension: "audience_tag", legacyPath: "/promty-dlya-foto-vlyublennykh", hubPath: "/promty-dlya-foto/vlyublennykh", label: "Влюблённые", chips: [{ label: "Портрет", queryKey: "style", value: "portret" }, { label: "Реалистичное", queryKey: "style", value: "realistichnoe" }] },
  { slug: "1_sentyabrya", dimension: "occasion_tag", legacyPath: "/sobytiya/1-sentyabrya", hubPath: "/promty-dlya-foto/1-sentyabrya", label: "1 сентября", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "14_fevralya", dimension: "occasion_tag", legacyPath: "/sobytiya/14-fevralya", hubPath: "/promty-dlya-foto/14-fevralya", label: "14 февраля", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "23_fevralya", dimension: "occasion_tag", legacyPath: "/sobytiya/23-fevralya", hubPath: "/promty-dlya-foto/23-fevralya", label: "23 февраля", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "8_marta", dimension: "occasion_tag", legacyPath: "/sobytiya/8-marta", hubPath: "/promty-dlya-foto/8-marta", label: "8 марта", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "maslenica", dimension: "occasion_tag", legacyPath: "/sobytiya/maslenica", hubPath: "/promty-dlya-foto/maslenica", label: "Масленица", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "novyy_god", dimension: "occasion_tag", legacyPath: "/sobytiya/novyj-god", hubPath: "/promty-dlya-foto/novyj-god", label: "Новый год", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "rozhdestvo", dimension: "occasion_tag", legacyPath: "/sobytiya/rozhdestvo", hubPath: "/promty-dlya-foto/rozhdestvo", label: "Рождество", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "svadba", dimension: "occasion_tag", legacyPath: "/sobytiya/svadba", hubPath: "/promty-dlya-foto/svadba", label: "Свадьба", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "3d", dimension: "style_tag", legacyPath: "/stil/3d", hubPath: "/promty-dlya-foto/3d", label: "3D", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "anime", dimension: "style_tag", legacyPath: "/stil/anime", hubPath: "/promty-dlya-foto/anime", label: "Аниме", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "art_deco", dimension: "style_tag", legacyPath: "/stil/art-deco", hubPath: "/promty-dlya-foto/art-deco", label: "Арт-деко", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "barbie", dimension: "style_tag", legacyPath: "/stil/barbie", hubPath: "/promty-dlya-foto/barbie", label: "Barbie", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "bokho_stil", dimension: "style_tag", legacyPath: "/stil/bokho-stil", hubPath: "/promty-dlya-foto/bokho-stil", label: "Бохо-стиль", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "cherno_beloe", dimension: "style_tag", legacyPath: "/stil/cherno-beloe", hubPath: "/promty-dlya-foto/cherno-beloe", label: "Чёрно-белое", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "delovoe", dimension: "style_tag", legacyPath: "/stil/delovoe", hubPath: "/promty-dlya-foto/delovoe", label: "Деловое", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "disney", dimension: "style_tag", legacyPath: "/stil/disney", hubPath: "/promty-dlya-foto/disney", label: "Disney", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "editorial", dimension: "style_tag", legacyPath: "/stil/editorial", hubPath: "/promty-dlya-foto/editorial", label: "Эдиториал", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "etno_stil", dimension: "style_tag", legacyPath: "/stil/etno-stil", hubPath: "/promty-dlya-foto/etno-stil", label: "Этно-стиль", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "fashion", dimension: "style_tag", legacyPath: "/stil/fashion", hubPath: "/promty-dlya-foto/fashion", label: "Fashion", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "fine_art", dimension: "style_tag", legacyPath: "/stil/fine-art", hubPath: "/promty-dlya-foto/fine-art", label: "Fine Art", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "fotorealizm", dimension: "style_tag", legacyPath: "/stil/fotorealizm", hubPath: "/promty-dlya-foto/fotorealizm", label: "Фотореализм", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "giperrealistichnoe", dimension: "style_tag", legacyPath: "/stil/giperrealistichnoe", hubPath: "/promty-dlya-foto/giperrealistichnoe", label: "Гиперреалистичное", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "glam", dimension: "style_tag", legacyPath: "/stil/glam", hubPath: "/promty-dlya-foto/glam", label: "Глэм", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "glyanec", dimension: "style_tag", legacyPath: "/stil/glyanec", hubPath: "/promty-dlya-foto/glyanec", label: "Глянец", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "gta", dimension: "style_tag", legacyPath: "/stil/gta", hubPath: "/promty-dlya-foto/gta", label: "GTA", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "impressionizm", dimension: "style_tag", legacyPath: "/stil/impressionizm", hubPath: "/promty-dlya-foto/impressionizm", label: "Импрессионизм", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "kinematograficheskoe", dimension: "style_tag", legacyPath: "/stil/kinematograficheskoe", hubPath: "/promty-dlya-foto/kinematograficheskoe", label: "Кинематографическое", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "kollazh", dimension: "style_tag", legacyPath: "/stil/kollazh", hubPath: "/promty-dlya-foto/kollazh", label: "Коллаж", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "lifestyle", dimension: "style_tag", legacyPath: "/stil/lifestyle", hubPath: "/promty-dlya-foto/lifestyle", label: "Лайфстайл", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "love_is", dimension: "style_tag", legacyPath: "/stil/love-is", hubPath: "/promty-dlya-foto/love-is", label: "Love Is", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "minimalizm", dimension: "style_tag", legacyPath: "/stil/minimalizm", hubPath: "/promty-dlya-foto/minimalizm", label: "Минимализм", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "multyashnoe", dimension: "style_tag", legacyPath: "/stil/multyashnoe", hubPath: "/promty-dlya-foto/multyashnoe", label: "Мультяшное", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "neonovoe", dimension: "style_tag", legacyPath: "/stil/neonovoe", hubPath: "/promty-dlya-foto/neonovoe", label: "Неоновое", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "otkrytka", dimension: "style_tag", legacyPath: "/stil/otkrytka", hubPath: "/promty-dlya-foto/otkrytka", label: "Открытка", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "piksar", dimension: "style_tag", legacyPath: "/stil/piksar", hubPath: "/promty-dlya-foto/piksar", label: "Pixar", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "polaroid", dimension: "style_tag", legacyPath: "/stil/polaroid", hubPath: "/promty-dlya-foto/polaroid", label: "Полароид", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "portret", dimension: "style_tag", legacyPath: "/stil/portret", hubPath: "/promty-dlya-foto/portret", label: "Портрет", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "produktovaya_fotografiya", dimension: "style_tag", legacyPath: "/stil/produktovaya-fotografiya", hubPath: "/promty-dlya-foto/produktovaya-fotografiya", label: "Продуктовая фотография", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "realistichnoe", dimension: "style_tag", legacyPath: "/stil/realistichnoe", hubPath: "/promty-dlya-foto/realistichnoe", label: "Реалистичное", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "retro", dimension: "style_tag", legacyPath: "/stil/retro", hubPath: "/promty-dlya-foto/retro", label: "Ретро", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "romanticheskiy", dimension: "style_tag", legacyPath: "/stil/romanticheskiy", hubPath: "/promty-dlya-foto/romanticheskiy", label: "Романтический", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "selfi", dimension: "style_tag", legacyPath: "/stil/selfi", hubPath: "/promty-dlya-foto/selfi", label: "Селфи", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "sovetskoe", dimension: "style_tag", legacyPath: "/stil/sovetskoe", hubPath: "/promty-dlya-foto/sovetskoe", label: "Советское", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "street_style", dimension: "style_tag", legacyPath: "/stil/street-style", hubPath: "/promty-dlya-foto/street-style", label: "Street Style", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "studiynoe", dimension: "style_tag", legacyPath: "/stil/studiynoe", hubPath: "/promty-dlya-foto/studiynoe", label: "Студийное", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "ultrarealistichnoe", dimension: "style_tag", legacyPath: "/stil/ultrarealistichnoe", hubPath: "/promty-dlya-foto/ultrarealistichnoe", label: "Ультрареалистичное", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "victorias_secret", dimension: "style_tag", legacyPath: "/stil/victorias-secret", hubPath: "/promty-dlya-foto/victorias-secret", label: "Victoria's Secret", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "vintazhnoe", dimension: "style_tag", legacyPath: "/stil/vintazhnoe", hubPath: "/promty-dlya-foto/vintazhnoe", label: "Винтажное", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "vysokaya_moda", dimension: "style_tag", legacyPath: "/stil/vysokaya-moda", hubPath: "/promty-dlya-foto/vysokaya-moda", label: "Высокая мода", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
  { slug: "y2k", dimension: "style_tag", legacyPath: "/stil/y2k", hubPath: "/promty-dlya-foto/y2k", label: "Y2K", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }] },
];

export const HERO_GAP_ONLY_REDIRECTS: readonly { legacyPath: string; hubPath: string }[] = [
  { legacyPath: "/promty-dlya-foto-s-pitomcem", hubPath: "/promty-dlya-foto/s-pitomcem" },
];

const SPEC_BY_HUB = new Map(HERO_GAP_HUB_SPECS.map((spec) => [spec.hubPath, spec]));
const SPEC_BY_LEGACY = new Map(HERO_GAP_HUB_SPECS.map((spec) => [spec.legacyPath, spec]));

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function heroGapHubSpec(pathname: string): HeroGapHubSpec | null {
  return SPEC_BY_HUB.get(stripTrailingSlash(pathname)) ?? null;
}

/** L1 href for a tag that moved. Combo bases keep the legacy urlPath. */
export function heroGapCanonicalPath(pathname: string): string {
  const normalized = stripTrailingSlash(pathname);
  return SPEC_BY_LEGACY.get(normalized)?.hubPath ?? normalized;
}

export function heroGapHeroFetchParams(slug: string, dimension: HeroGapDimension) {
  return (_routeParams: {
    audience_tag: string | null;
    style_tag: string | null;
    occasion_tag: string | null;
    object_tag: string | null;
    doc_task_tag: string | null;
  }) => ({
    audience_tag: dimension === "audience_tag" ? slug : null,
    style_tag: dimension === "style_tag" ? slug : null,
    occasion_tag: dimension === "occasion_tag" ? slug : null,
    object_tag: null,
    doc_task_tag: dimension === "doc_task_tag" ? slug : null,
    limit: 16,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  });
}

export function toHeroGapHeroCarouselCards<T extends { photoUrl: string | null }>(cards: readonly T[]): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function heroGapFilterNav(spec: HeroGapHubSpec, state: Partial<Record<string, string | null | undefined>> = {}) {
  const active = spec.chips.some((chip) => state[chip.queryKey] === chip.value);
  return [
    { label: "Все", href: spec.hubPath, active: !active },
    ...spec.chips.map((chip) => ({
      label: chip.label,
      href: `${spec.hubPath}?${chip.queryKey}=${encodeURIComponent(chip.value)}`,
      active: state[chip.queryKey] === chip.value,
    })),
  ];
}

export function isHeroGapClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  if (HERO_GAP_ONLY_REDIRECTS.some((item) => normalized === item.legacyPath)) return true;
  return HERO_GAP_HUB_SPECS.some(
    (spec) => normalized === spec.hubPath || normalized === spec.legacyPath,
  );
}

/** Exact old L1 only. Combo URLs such as /stil/otkrytka/novyj-god stay. */
export function heroGapChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  const only = HERO_GAP_ONLY_REDIRECTS.find((item) => item.legacyPath === normalized);
  if (only) return only.hubPath;
  const spec = SPEC_BY_LEGACY.get(normalized);
  if (!spec || normalized === spec.hubPath) return null;
  return spec.hubPath;
}
