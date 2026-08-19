import type { FurnitureCategory, FurnitureItem } from "./types";

/**
 * Каталог предметов для плана стенда.
 *
 * Размеры взяты из названий файлов старого приложения: например
 * «311_stol_0,7_h_1,2m» — стол 0,7 x 1,2 м. Где размер в названии не указан,
 * проставлены типовые габариты выставочного оборудования.
 *
 * `catalogId` — идентификатор позиции в каталоге CRM. По нему спецификация
 * связывает предмет на плане со строкой в смете; у позиций без номера он пустой.
 *
 * ВНИМАНИЕ: `priceRub` — временные ориентировочные цены, нужные чтобы увидеть,
 * как считается смета. Настоящие цены лежат в каталоге Битрикс24 и подставятся
 * после подключения к порталу.
 */

export const furnitureCategories: Array<{ id: FurnitureCategory; title: string }> = [
  { id: "seating", title: "Стулья и кресла" },
  { id: "tables", title: "Столы и стойки" },
  { id: "storage", title: "Витрины и стеллажи" },
  { id: "walls", title: "Стены и двери" },
  { id: "lighting", title: "Освещение" },
  { id: "power", title: "Электрика" },
  { id: "equipment", title: "Техника" },
  { id: "other", title: "Прочее" },
];

export const furnitureCatalog: FurnitureItem[] = [
  // Стулья и кресла
  { id: "300", catalogId: "441969", title: "Стул офисный", category: "seating", widthM: 0.5, depthM: 0.5, image: "300_stul_ofisnyy.png" },
  { id: "306", catalogId: "441973", title: "Барный стул", category: "seating", widthM: 0.4, depthM: 0.4, image: "306_barnyy_stul.png" },
  { id: "308", catalogId: "308", title: "Кресло одноместное", category: "seating", widthM: 0.7, depthM: 0.7, image: "308_kreslo_odnomestnoe.png" },
  { id: "stul_solo", catalogId: "", title: "Стул Solo", category: "seating", widthM: 0.5, depthM: 0.5, image: "stul_solo.png" },

  // Столы и стойки
  { id: "310", catalogId: "310", title: "Стол 0,7 x 0,7 м", category: "tables", widthM: 0.7, depthM: 0.7, image: "310_stol_0,7_h_0,7m.png" },
  { id: "311", catalogId: "311", title: "Стол 0,7 x 1,2 м", category: "tables", widthM: 0.7, depthM: 1.2, image: "311_stol_0,7_h_1,2m.png" },
  { id: "313", catalogId: "441977", title: "Стол круглый", category: "tables", widthM: 0.8, depthM: 0.8, image: "313_stol_kruglyy.png", round: true },
  { id: "314", catalogId: "314", title: "Стол круглый барный", category: "tables", widthM: 0.6, depthM: 0.6, image: "314_stol_kruglyy_barnyy.png", round: true },
  { id: "kruglyy_stol_steklyannyy", catalogId: "", title: "Стол круглый стеклянный R=0,8 м", category: "tables", widthM: 0.8, depthM: 0.8, image: "kruglyy_stol_steklyannyy_R=0.8m.png", round: true },
  { id: "318", catalogId: "318", title: "Информационная стойка", category: "tables", widthM: 0.5, depthM: 1, image: "318_informacionnaya_stoyka_0,5_h_1_h_1,1m.png" },
  { id: "barnaya_stoyka", catalogId: "", title: "Барная стойка 0,5 x 1 м", category: "tables", widthM: 0.5, depthM: 1, image: "barnaya_stoyka_0,5_h_1_h_1,1m.png" },
  { id: "barnaya_stoyka_r", catalogId: "441947", title: "Барная стойка закруглённая R=1 м", category: "tables", widthM: 1, depthM: 1, image: "barnaya_stoyka_zakruglennaya_R=1m.png" },

  // Витрины и стеллажи
  { id: "394", catalogId: "394", title: "Витрина 0,5 x 1 x 1 м", category: "storage", widthM: 0.5, depthM: 1, image: "394_vitrina_0,5_h_1_h_1m.png" },
  { id: "396", catalogId: "396", title: "Витрина 0,5 x 1 x 1,8 м", category: "storage", widthM: 0.5, depthM: 1, image: "396_vitrina_0,5_h_1_h_1,8m.png" },
  { id: "398", catalogId: "398", title: "Витрина 0,5 x 1 x 2,5 м", category: "storage", widthM: 0.5, depthM: 1, image: "398_vitrina_0,5_h_1_h_2,5m.png" },
  { id: "398a", catalogId: "398a", title: "Витрина 0,5 x 0,5 x 2,5 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "398a_vitrina_0,5_h_0,5_h_2,5m.png" },
  { id: "320", catalogId: "441951", title: "Архивный шкаф 0,5 x 1 x 0,7 м", category: "storage", widthM: 0.5, depthM: 1, image: "320_arhivnyy_shkaf_0,5_h_1_h_0,7m.png" },
  { id: "321", catalogId: "321", title: "Архивный шкаф 0,5 x 1 x 1,1 м", category: "storage", widthM: 0.5, depthM: 1, image: "321_arhivnyy_shkaf_0,5_h_1_h_1,1m.png" },
  { id: "340", catalogId: "441967", title: "Стеллаж деревянный, 5 полок", category: "storage", widthM: 0.4, depthM: 1, image: "340_stellazh_derevyannyy_5_polok.png" },
  { id: "380", catalogId: "380", title: "Полка настенная 1 x 0,3 м", category: "storage", widthM: 1, depthM: 0.3, image: "380_polka_nastennaya_1h0,3m.png" },
  { id: "380a", catalogId: "380a", title: "Полка настенная наклонная 1 x 0,3 м", category: "storage", widthM: 1, depthM: 0.3, image: "380a_polka_nastennaya_naklonnaya_1h_0,3m.png" },
  { id: "382", catalogId: "382", title: "Подиум 0,5 x 1 x 0,8 м", category: "storage", widthM: 0.5, depthM: 1, image: "382_podium_0,5_h_1_h_0,8m.png" },
  { id: "384", catalogId: "384", title: "Подиум 1 x 1 x 0,8 м", category: "storage", widthM: 1, depthM: 1, image: "384_podium_1_h_1_h_0,8m.png" },
  { id: "325", catalogId: "325", title: "Подставка для буклетов", category: "storage", widthM: 0.3, depthM: 0.3, image: "325_podstavka_dlya_bukletov.png" },

  // Стены и двери
  { id: "wall_1", catalogId: "441925", title: "Элемент стены 1 x 2,5 м", category: "walls", widthM: 1, depthM: 0.1, image: "element_steny_1h2,5m.png" },
  { id: "wall_05", catalogId: "", title: "Элемент стены 0,5 x 2,5 м", category: "walls", widthM: 0.5, depthM: 0.1, image: "element_steny_0,5h2,5m.png" },
  { id: "wall_glass", catalogId: "", title: "Стена со стеклом 1 x 2,5 м", category: "walls", widthM: 1, depthM: 0.1, image: "element_steny_so_steklom_1h2,5m.png" },
  { id: "wall_curtain", catalogId: "", title: "Стена с занавесом 1 x 2,5 м", category: "walls", widthM: 1, depthM: 0.1, image: "element_steny_s_zanavesom_1h2,5m.png" },
  { id: "wall_radius", catalogId: "", title: "Стена радиусная R=1 м", category: "walls", widthM: 1, depthM: 1, image: "element_steny_radiusnyy_R=1m.png" },
  { id: "door_swing", catalogId: "", title: "Дверь распашная", category: "walls", widthM: 1, depthM: 0.2, image: "dverj_raspashnaya.png" },
  { id: "door_slide", catalogId: "441935", title: "Дверь раздвижная", category: "walls", widthM: 1, depthM: 0.2, image: "dverj_razdvizhnaya.png" },

  // Освещение
  { id: "515", catalogId: "442005", title: "Светильник галогеновый", category: "lighting", widthM: 0.2, depthM: 0.2, image: "515_svetiljnik_galogenovyy.png" },
  { id: "516", catalogId: "516", title: "Светильник галогеновый на штанге", category: "lighting", widthM: 0.2, depthM: 0.2, image: "516_svetiljnik_galogenovyy_na_shtange.png" },
  { id: "517", catalogId: "517", title: "Прожектор галогеновый", category: "lighting", widthM: 0.2, depthM: 0.2, image: "517_prozhektor_galogenovyy.png" },
  { id: "521", catalogId: "521", title: "Светильник люминесцентный", category: "lighting", widthM: 1.2, depthM: 0.2, image: "521_svetiljnik_lyuminescentnyy.png" },

  // Электрика
  { id: "rozetka_220", catalogId: "442001", title: "Розетка 1,5 кВт 220 В", category: "power", widthM: 0.2, depthM: 0.2, image: "rozetka_1,5_kvt_220v.png" },
  { id: "rozetka_380", catalogId: "", title: "Розетка 1,5 кВт 380 В", category: "power", widthM: 0.2, depthM: 0.2, image: "rozetka_1,5_kvt_380_v.png" },

  // Техника
  { id: "lcd42", catalogId: "", title: "Экран LCD 42\"", category: "equipment", widthM: 1, depthM: 0.2, image: "LCD42.png" },
  { id: "holodilnik", catalogId: "441993", title: "Холодильник 150 л", category: "equipment", widthM: 0.6, depthM: 0.6, image: "holodiljnik_150l.png" },
  // В старом приложении у кулера не было своей картинки, показывалась заглушка,
  // поэтому в каталог по картинкам он не попал. Обозначение нарисовано заново.
  { id: "kuler", catalogId: "441997", title: "Кулер для воды", category: "equipment", widthM: 0.5, depthM: 0.5, image: "kuler_dlya_vody.svg" },

  // Прочее
  { id: "331", catalogId: "441987", title: "Настенная вешалка", category: "other", widthM: 0.6, depthM: 0.1, image: "331_nastennaya_veshalka.png" },
  { id: "332", catalogId: "332", title: "Напольная вешалка", category: "other", widthM: 0.5, depthM: 0.5, image: "332_napoljnaya_veshalka.png" },
  { id: "377", catalogId: "441991", title: "Корзина для мусора", category: "other", widthM: 0.3, depthM: 0.3, image: "377_korzina_dlya_musora.png" },
  { id: "zerkalo", catalogId: "", title: "Зеркало", category: "other", widthM: 0.6, depthM: 0.1, image: "zerkalo.png" },
];

const catalogById = new Map(furnitureCatalog.map((item) => [item.id, item]));

export function getFurnitureItem(id: string): FurnitureItem | undefined {
  return catalogById.get(id);
}

export function getFurnitureImageUrl(item: FurnitureItem): string {
  return `${import.meta.env.BASE_URL}furniture/${item.image}`;
}

export function getFurnitureByCategory(category: FurnitureCategory): FurnitureItem[] {
  return furnitureCatalog.filter((item) => item.category === category);
}
