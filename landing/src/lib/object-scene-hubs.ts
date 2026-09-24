import { takeHeroMarqueeCards } from "./hero-marquee";

export type ObjectSceneChip = {
  label: string;
  queryKey: "audience" | "style";
  value: string;
};

export type ObjectSceneHubSpec = {
  slug: string;
  legacyPath: string;
  hubPath: string;
  label: string;
  frame: string;
  chips: readonly ObjectSceneChip[];
};

export const OBJECT_SCENE_HUB_SPECS: readonly ObjectSceneHubSpec[] = [
  { slug: "v_gorah", legacyPath: "/v-gorah", hubPath: "/promty-dlya-foto/v-gorah", label: "В горах", frame: "в горах", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_kostyume", legacyPath: "/v-kostyume", hubPath: "/promty-dlya-foto/v-kostyume", label: "В костюме", frame: "в костюме", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_cvetami", legacyPath: "/s-cvetami", hubPath: "/promty-dlya-foto/s-cvetami", label: "С цветами", frame: "с цветами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_krovati", legacyPath: "/na-krovati", hubPath: "/promty-dlya-foto/na-krovati", label: "На кровати", frame: "на кровати", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_pitomcem", legacyPath: "/s-pitomcem", hubPath: "/promty-dlya-foto/s-pitomcem", label: "s_pitomcem", frame: "с питомцем", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "leto", legacyPath: "/leto", hubPath: "/promty-dlya-foto/leto", label: "Лето", frame: "фото: Лето", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_medvedem", legacyPath: "/s-medvedem", hubPath: "/promty-dlya-foto/s-medvedem", label: "С медведем", frame: "с медведем", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "dozhd", legacyPath: "/dozhd", hubPath: "/promty-dlya-foto/dozhd", label: "Дождь", frame: "фото: Дождь", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "so_svechami", legacyPath: "/so-svechami", hubPath: "/promty-dlya-foto/so-svechami", label: "Со свечами", frame: "со свечами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_kotom", legacyPath: "/s-kotom", hubPath: "/promty-dlya-foto/s-kotom", label: "С котом", frame: "с котом", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_girlyandami", legacyPath: "/s-girlyandami", hubPath: "/promty-dlya-foto/s-girlyandami", label: "С гирляндами", frame: "с гирляндами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_vannoy", legacyPath: "/v-vannoy", hubPath: "/promty-dlya-foto/v-vannoy", label: "В ванной", frame: "в ванной", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_yahte", legacyPath: "/na-yahte", hubPath: "/promty-dlya-foto/na-yahte", label: "На яхте", frame: "на яхте", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_basseyne", legacyPath: "/v-basseyne", hubPath: "/promty-dlya-foto/v-basseyne", label: "В бассейне", frame: "в бассейне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_chernom_fone", legacyPath: "/na-chernom-fone", hubPath: "/promty-dlya-foto/na-chernom-fone", label: "На чёрном фоне", frame: "на чёрном фоне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "pod_vodoy", legacyPath: "/pod-vodoy", hubPath: "/promty-dlya-foto/pod-vodoy", label: "Под водой", frame: "под водой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_kofe", legacyPath: "/s-kofe", hubPath: "/promty-dlya-foto/s-kofe", label: "С кофе", frame: "с кофе", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_ochkami", legacyPath: "/s-ochkami", hubPath: "/promty-dlya-foto/s-ochkami", label: "С очками", frame: "с очками", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_platye", legacyPath: "/v-platye", hubPath: "/promty-dlya-foto/v-platye", label: "В платье", frame: "в платье", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "zakat", legacyPath: "/zakat", hubPath: "/promty-dlya-foto/zakat", label: "Закат", frame: "фото: Закат", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_sobakoy", legacyPath: "/s-sobakoj", hubPath: "/promty-dlya-foto/s-sobakoj", label: "С собакой", frame: "с собакой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_pole", legacyPath: "/v-pole", hubPath: "/promty-dlya-foto/v-pole", label: "В поле", frame: "в поле", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_bokalom", legacyPath: "/s-bokalom", hubPath: "/promty-dlya-foto/s-bokalom", label: "С бокалом", frame: "с бокалом", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_lifte", legacyPath: "/v-lifte", hubPath: "/promty-dlya-foto/v-lifte", label: "В лифте", frame: "в лифте", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "kuhnya", legacyPath: "/kuhnya", hubPath: "/promty-dlya-foto/kuhnya", label: "На кухне", frame: "на кухне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_ulice", legacyPath: "/na-ulice", hubPath: "/promty-dlya-foto/na-ulice", label: "На улице", frame: "на улице", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "iphone", legacyPath: "/iphone", hubPath: "/promty-dlya-foto/iphone", label: "С iPhone", frame: "с iphone", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "velosiped", legacyPath: "/velosiped", hubPath: "/promty-dlya-foto/velosiped", label: "Велосипед", frame: "фото: Велосипед", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_krasnom_fone", legacyPath: "/na-krasnom-fone", hubPath: "/promty-dlya-foto/na-krasnom-fone", label: "На красном фоне", frame: "на красном фоне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_parke", legacyPath: "/v-parke", hubPath: "/promty-dlya-foto/v-parke", label: "В парке", frame: "в парке", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_belom_fone", legacyPath: "/na-belom-fone", hubPath: "/promty-dlya-foto/na-belom-fone", label: "На белом фоне", frame: "на белом фоне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_profil", legacyPath: "/v-profil", hubPath: "/promty-dlya-foto/v-profil", label: "В профиль", frame: "в профиль", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_pustyne", legacyPath: "/v-pustyne", hubPath: "/promty-dlya-foto/v-pustyne", label: "В пустыне", frame: "в пустыне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_knigoy", legacyPath: "/s-knigoy", hubPath: "/promty-dlya-foto/s-knigoy", label: "С книгой", frame: "с книгой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_restorane", legacyPath: "/v-restorane", hubPath: "/promty-dlya-foto/v-restorane", label: "В ресторане", frame: "в ресторане", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_lestnice", legacyPath: "/na-lestnice", hubPath: "/promty-dlya-foto/na-lestnice", label: "На лестнице", frame: "на лестнице", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_tykvoy", legacyPath: "/s-tykvoy", hubPath: "/promty-dlya-foto/s-tykvoy", label: "С тыквой", frame: "с тыквой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "so_znamenitostyu", legacyPath: "/so-znamenitostyu", hubPath: "/promty-dlya-foto/so-znamenitostyu", label: "Со знаменитостью", frame: "со знаменитостью", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_okne", legacyPath: "/na-okne", hubPath: "/promty-dlya-foto/na-okne", label: "У окна", frame: "у окна", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "zima", legacyPath: "/zima", hubPath: "/promty-dlya-foto/zima", label: "Зима", frame: "зимнего фото", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "noch", legacyPath: "/noch", hubPath: "/promty-dlya-foto/noch", label: "Ночь", frame: "фото: Ночь", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_gitaroy", legacyPath: "/s-gitaroy", hubPath: "/promty-dlya-foto/s-gitaroy", label: "С гитарой", frame: "с гитарой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_koronoy", legacyPath: "/s-koronoy", hubPath: "/promty-dlya-foto/s-koronoy", label: "С короной", frame: "с короной", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_pionami", legacyPath: "/s-pionami", hubPath: "/promty-dlya-foto/s-pionami", label: "С пионами", frame: "с пионами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_maskoy", legacyPath: "/s-maskoy", hubPath: "/promty-dlya-foto/s-maskoy", label: "С маской", frame: "с маской", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_balkone", legacyPath: "/na-balkone", hubPath: "/promty-dlya-foto/na-balkone", label: "На балконе", frame: "на балконе", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_serdechkami", legacyPath: "/s-serdechkami", hubPath: "/promty-dlya-foto/s-serdechkami", label: "С сердечками", frame: "с сердечками", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_sharami", legacyPath: "/s-sharami", hubPath: "/promty-dlya-foto/s-sharami", label: "С шарами", frame: "с шарами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_gorode", legacyPath: "/v-gorode", hubPath: "/promty-dlya-foto/v-gorode", label: "В городе", frame: "в городе", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_polnyy_rost", legacyPath: "/v-polnyy-rost", hubPath: "/promty-dlya-foto/v-polnyy-rost", label: "В полный рост", frame: "в полный рост", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_stole", legacyPath: "/na-stole", hubPath: "/promty-dlya-foto/na-stole", label: "На столе", frame: "на столе", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_zontom", legacyPath: "/s-zontom", hubPath: "/promty-dlya-foto/s-zontom", label: "С зонтом", frame: "с зонтом", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_interere", legacyPath: "/v-interere", hubPath: "/promty-dlya-foto/v-interere", label: "В интерьере", frame: "в интерьере", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_cheburashkoy", legacyPath: "/s-cheburashkoy", hubPath: "/promty-dlya-foto/s-cheburashkoy", label: "С Чебурашкой", frame: "с чебурашкой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_konfetami", legacyPath: "/s-konfetami", hubPath: "/promty-dlya-foto/s-konfetami", label: "С конфетами", frame: "с конфетами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_metroe", legacyPath: "/v-metroe", hubPath: "/promty-dlya-foto/v-metroe", label: "В метро", frame: "в метро", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_sadu", legacyPath: "/v-sadu", hubPath: "/promty-dlya-foto/v-sadu", label: "В саду", frame: "в саду", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_studii", legacyPath: "/v-studii", hubPath: "/promty-dlya-foto/v-studii", label: "В студии", frame: "в студии", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_igrushkoy", legacyPath: "/s-igrushkoy", hubPath: "/promty-dlya-foto/s-igrushkoy", label: "С игрушкой", frame: "с игрушкой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_lentami", legacyPath: "/s-lentami", hubPath: "/promty-dlya-foto/s-lentami", label: "С лентами", frame: "с лентами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_mandarinami", legacyPath: "/s-mandarinami", hubPath: "/promty-dlya-foto/s-mandarinami", label: "С мандаринами", frame: "с мандаринами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "v_spalne", legacyPath: "/v-spalne", hubPath: "/promty-dlya-foto/v-spalne", label: "В спальне", frame: "в спальне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "zolotoy_chas", legacyPath: "/zolotoy-chas", hubPath: "/promty-dlya-foto/zolotoy-chas", label: "Золотой час", frame: "фото: Золотой час", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Пара", queryKey: "audience", value: "para" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_kryshe", legacyPath: "/na-kryshe", hubPath: "/promty-dlya-foto/na-kryshe", label: "На крыше", frame: "на крыше", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_naberezhnoj", legacyPath: "/na-naberezhnoj", hubPath: "/promty-dlya-foto/na-naberezhnoj", label: "На набережной", frame: "на набережной", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_naushnikami", legacyPath: "/s-naushnikami", hubPath: "/promty-dlya-foto/s-naushnikami", label: "С наушниками", frame: "с наушниками", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_shokoladkoy", legacyPath: "/s-shokoladkoy", hubPath: "/promty-dlya-foto/s-shokoladkoy", label: "С шоколадкой", frame: "с шоколадкой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_shuboj", legacyPath: "/s-shuboj", hubPath: "/promty-dlya-foto/s-shuboj", label: "В шубе", frame: "в шубе", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "tuman", legacyPath: "/tuman", hubPath: "/promty-dlya-foto/tuman", label: "Туман", frame: "фото: Туман", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "vintazhnyy_avtomobil", legacyPath: "/vintazhnyy-avtomobil", hubPath: "/promty-dlya-foto/vintazhnyy-avtomobil", label: "Винтажный автомобиль", frame: "фото: Винтажный автомобиль", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "na_rozovom_fone", legacyPath: "/na-rozovom-fone", hubPath: "/promty-dlya-foto/na-rozovom-fone", label: "На розовом фоне", frame: "на розовом фоне", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_detskim_foto", legacyPath: "/s-detskim-foto", hubPath: "/promty-dlya-foto/s-detskim-foto", label: "С детским фото", frame: "с детским фото", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_elkoj", legacyPath: "/s-elkoj", hubPath: "/promty-dlya-foto/s-elkoj", label: "С ёлкой", frame: "с ёлкой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_otkrytkami", legacyPath: "/s-otkrytkami", hubPath: "/promty-dlya-foto/s-otkrytkami", label: "С открытками", frame: "с открытками", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_podarkami", legacyPath: "/s-podarkami", hubPath: "/promty-dlya-foto/s-podarkami", label: "С подарками", frame: "с подарками", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_samovarom", legacyPath: "/s-samovarom", hubPath: "/promty-dlya-foto/s-samovarom", label: "С самоваром", frame: "с самоваром", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_shuboy", legacyPath: "/s-shuboy", hubPath: "/promty-dlya-foto/s-shuboy", label: "С шубой", frame: "с шубой", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_tulpanami", legacyPath: "/s-tulpanami", hubPath: "/promty-dlya-foto/s-tulpanami", label: "С тюльпанами", frame: "с тюльпанами", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_valentinkami", legacyPath: "/s-valentinkami", hubPath: "/promty-dlya-foto/s-valentinkami", label: "С валентинками", frame: "с валентинками", chips: [{ label: "Мужчина", queryKey: "audience", value: "muzhchina" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "s_zhurnalom", legacyPath: "/s-zhurnalom", hubPath: "/promty-dlya-foto/s-zhurnalom", label: "С журналом", frame: "с журналом", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "sneg", legacyPath: "/sneg", hubPath: "/promty-dlya-foto/sneg", label: "Снег", frame: "фото: Снег", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "so_lvom", legacyPath: "/so-lvom", hubPath: "/promty-dlya-foto/so-lvom", label: "Со львом", frame: "со львом", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
  { slug: "vesna", legacyPath: "/vesna", hubPath: "/promty-dlya-foto/vesna", label: "Весна", frame: "весеннего фото", chips: [{ label: "Девушка", queryKey: "audience", value: "devushka" }, { label: "Портрет", queryKey: "style", value: "portret" }] },
];

const SPEC_BY_HUB = new Map(OBJECT_SCENE_HUB_SPECS.map((spec) => [spec.hubPath, spec]));
const SPEC_BY_LEGACY = new Map(OBJECT_SCENE_HUB_SPECS.map((spec) => [spec.legacyPath, spec]));

function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function objectSceneHubSpec(pathname: string): ObjectSceneHubSpec | null {
  return SPEC_BY_HUB.get(stripTrailingSlash(pathname)) ?? null;
}

export function objectSceneHeroFetchParams(slug: string) {
  return (_routeParams: {
    audience_tag: string | null;
    style_tag: string | null;
    occasion_tag: string | null;
    object_tag: string | null;
    doc_task_tag: string | null;
  }) => ({
    audience_tag: null,
    style_tag: null,
    occasion_tag: null,
    object_tag: slug,
    doc_task_tag: null,
    limit: 16,
    offset: 0,
    min_cards: 1,
    sort: "new" as const,
  });
}

export function toObjectSceneHeroCarouselCards<T extends { photoUrl: string | null }>(cards: readonly T[]): T[] {
  return takeHeroMarqueeCards(cards.filter((card) => card.photoUrl));
}

export function objectSceneFilterNav(spec: ObjectSceneHubSpec, state: Partial<Record<string, string | null | undefined>> = {}) {
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

export function isObjectSceneClusterPath(pathname: string): boolean {
  const normalized = stripTrailingSlash(pathname);
  return OBJECT_SCENE_HUB_SPECS.some((spec) =>
    normalized === spec.hubPath ||
    normalized.startsWith(`${spec.hubPath}/`) ||
    normalized === spec.legacyPath ||
    normalized.startsWith(`${spec.legacyPath}/`),
  );
}

/** Legacy object URL and any child slice 301 to the hub. The hub itself stays. */
export function objectSceneChildRedirectPath(pathname: string): string | null {
  const normalized = stripTrailingSlash(pathname);
  const spec = SPEC_BY_LEGACY.get(normalized) ?? OBJECT_SCENE_HUB_SPECS.find((item) =>
    normalized.startsWith(`${item.legacyPath}/`) || normalized.startsWith(`${item.hubPath}/`),
  );
  if (!spec || normalized === spec.hubPath) return null;
  if (
    normalized === spec.legacyPath ||
    normalized.startsWith(`${spec.legacyPath}/`) ||
    normalized.startsWith(`${spec.hubPath}/`)
  ) {
    return spec.hubPath;
  }
  return null;
}

