import type { FurnitureItem } from "./types";

/**
 * Каталог оборудования по действующему прайсу выставки.
 *
 * Артикулы взяты из формы заказа оборудования и мебели: именно ими оперируют
 * монтажники и смета, поэтому в спецификацию попадают они, а не внутренние
 * номера старого приложения.
 *
 * Файл собран генератором из описания позиций: обозначения и данные каталога
 * рисуются из одного источника, иначе они разъезжаются.
 *
 * Габариты взяты из названий позиций прайса. Там, где размер в названии
 * не указан, поставлен типовой — такие позиции стоит сверить с подрядчиком.
 */
export const priceCatalog2026: FurnitureItem[] = [
  { id: "stena-05", catalogId: "101", title: "Элемент стены 0,5 м", category: "walls", widthM: 0.5, depthM: 0.1, image: "stena-05.svg", source: "price2026" },
  { id: "stena-10", catalogId: "103", title: "Элемент стены 1 м", category: "walls", widthM: 1, depthM: 0.1, image: "stena-10.svg", source: "price2026" },
  { id: "stena-zanaveska", catalogId: "111", title: "Элемент стены с занавеской", category: "walls", widthM: 1, depthM: 0.1, image: "stena-zanaveska.svg", source: "price2026" },
  { id: "dver-razdvizhnaya", catalogId: "109", title: "Дверь раздвижная", category: "walls", widthM: 1, depthM: 0.2, image: "dver-razdvizhnaya.svg", source: "price2026" },
  { id: "dver-raspashnaya", catalogId: "110", title: "Дверь распашная", category: "walls", widthM: 1, depthM: 0.2, image: "dver-raspashnaya.svg", source: "price2026" },
  { id: "polka-1x03", catalogId: "115", title: "Полка ЛДСП 1 x 0,3 м", category: "storage", widthM: 1, depthM: 0.3, image: "polka-1x03.svg", source: "price2026" },
  { id: "polka-1x05", catalogId: "", title: "Полка ЛДСП 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "polka-1x05.svg", source: "price2026" },
  { id: "polka-naklonnaya", catalogId: "", title: "Полка ЛДСП наклонная 1 x 0,3 м", category: "storage", widthM: 1, depthM: 0.3, image: "polka-naklonnaya.svg", source: "price2026" },
  { id: "polka-steklyannaya", catalogId: "", title: "Полка стеклянная 0,97 x 0,47 м", category: "storage", widthM: 0.97, depthM: 0.47, image: "polka-steklyannaya.svg", source: "price2026" },
  { id: "stoyka-r05", catalogId: "202a", title: "Стойка информационная R-0,5 м", category: "tables", widthM: 1, depthM: 0.5, image: "stoyka-r05.svg", source: "price2026" },
  { id: "stoyka-r10", catalogId: "202", title: "Стойка информационная R-1 м", category: "tables", widthM: 1, depthM: 1, image: "stoyka-r10.svg", source: "price2026" },
  { id: "stoyka-1x05", catalogId: "203", title: "Стойка информационная 1 x 0,5 м", category: "tables", widthM: 1, depthM: 0.5, image: "stoyka-1x05.svg", source: "price2026" },
  { id: "stoyka-uzkaya-polka", catalogId: "211", title: "Стойка с узкой верхней полкой 1 x 0,5 м", category: "tables", widthM: 1, depthM: 0.5, image: "stoyka-uzkaya-polka.svg", source: "price2026" },
  { id: "stellazh-plastmassovyy", catalogId: "", title: "Стеллаж пластмассовый, 5 полок", category: "storage", widthM: 1, depthM: 0.4, image: "stellazh-plastmassovyy.svg", source: "price2026" },
  { id: "vitrina-nizkaya-05x05", catalogId: "214", title: "Витрина низкая 0,5 x 0,5 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "vitrina-nizkaya-05x05.svg", source: "price2026" },
  { id: "vitrina-nizkaya-1x05", catalogId: "215", title: "Витрина низкая 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "vitrina-nizkaya-1x05.svg", source: "price2026" },
  { id: "vitrina-radiusnaya-r05-h1", catalogId: "", title: "Витрина радиусная R-0,5 м, h=1 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "vitrina-radiusnaya-r05-h1.svg", source: "price2026" },
  { id: "vitrina-radiusnaya-r10-h1", catalogId: "", title: "Витрина радиусная R-1 м, h=1 м", category: "storage", widthM: 1, depthM: 1, image: "vitrina-radiusnaya-r10-h1.svg", source: "price2026" },
  { id: "vitrina-vysokaya-05x05", catalogId: "", title: "Витрина высокая 0,5 x 0,5 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "vitrina-vysokaya-05x05.svg", source: "price2026" },
  { id: "vitrina-vysokaya-1x05", catalogId: "217", title: "Витрина высокая 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "vitrina-vysokaya-1x05.svg", source: "price2026" },
  { id: "vitrina-radiusnaya-r05-h25", catalogId: "219", title: "Витрина радиусная R-0,5 м, h=2,5 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "vitrina-radiusnaya-r05-h25.svg", source: "price2026" },
  { id: "vitrina-radiusnaya-r10-h25", catalogId: "218", title: "Витрина радиусная R-1 м, h=2,5 м", category: "storage", widthM: 1, depthM: 1, image: "vitrina-radiusnaya-r10-h25.svg", source: "price2026" },
  { id: "shkaf-arhivnyy", catalogId: "220", title: "Шкаф архивный 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "shkaf-arhivnyy.svg", source: "price2026" },
  { id: "stul-polumyagkiy", catalogId: "624", title: "Стул полумягкий", category: "seating", widthM: 0.5, depthM: 0.5, image: "stul-polumyagkiy.svg", source: "price2026" },
  { id: "stul-barnyy-z", catalogId: "629", title: "Стул барный Z, чёрный", category: "seating", widthM: 0.4, depthM: 0.4, image: "stul-barnyy-z.svg", source: "price2026" },
  { id: "stul-barnyy-latina", catalogId: "629a", title: "Стул барный Latina, белый", category: "seating", widthM: 0.4, depthM: 0.4, image: "stul-barnyy-latina.svg", source: "price2026" },
  { id: "stul-barnyy-myagkiy", catalogId: "", title: "Стул барный мягкий с подлокотниками", category: "seating", widthM: 0.45, depthM: 0.45, image: "stul-barnyy-myagkiy.svg", source: "price2026" },
  { id: "stul-silviya", catalogId: "663", title: "Стул белый мягкий Сильвия", category: "seating", widthM: 0.5, depthM: 0.5, image: "stul-silviya.svg", source: "price2026" },
  { id: "stul-hrom", catalogId: "662", title: "Стул хром", category: "seating", widthM: 0.5, depthM: 0.5, image: "stul-hrom.svg", source: "price2026" },
  { id: "kreslo-tulsta", catalogId: "611", title: "Кресло Тульста, белое", category: "seating", widthM: 0.7, depthM: 0.7, image: "kreslo-tulsta.svg", source: "price2026" },
  { id: "kreslo-mk6", catalogId: "", title: "Кресло кожаное МК6", category: "seating", widthM: 0.8, depthM: 0.8, image: "kreslo-mk6.svg", source: "price2026" },
  { id: "divan-2m", catalogId: "604", title: "Диван кожаный, 2 места", category: "seating", widthM: 1.4, depthM: 0.8, image: "divan-2m.svg", source: "price2026" },
  { id: "stol-70x70", catalogId: "621", title: "Стол квадратный 0,7 x 0,7 м", category: "tables", widthM: 0.7, depthM: 0.7, image: "stol-70x70.svg", source: "price2026" },
  { id: "stol-110x70", catalogId: "623", title: "Стол 1,1 x 0,7 м", category: "tables", widthM: 1.1, depthM: 0.7, image: "stol-110x70.svg", source: "price2026" },
  { id: "stol-kruglyy-d70", catalogId: "70", title: "Стол круглый D-0,7 м", category: "tables", widthM: 0.7, depthM: 0.7, image: "stol-kruglyy-d70.svg", source: "price2026" },
  { id: "stol-kruglyy-steklyannyy", catalogId: "630", title: "Стол круглый стеклянный", category: "tables", widthM: 0.7, depthM: 0.7, image: "stol-kruglyy-steklyannyy.svg", source: "price2026" },
  { id: "stol-barnyy", catalogId: "405", title: "Стол барный ЛДСП", category: "tables", widthM: 0.6, depthM: 0.6, image: "stol-barnyy.svg", source: "price2026" },
  { id: "stol-zhurnalnyy", catalogId: "606", title: "Журнальный стол стеклянный", category: "tables", widthM: 1, depthM: 0.6, image: "stol-zhurnalnyy.svg", source: "price2026" },
  { id: "holodilnik-150", catalogId: "411", title: "Холодильник 150 л", category: "equipment", widthM: 0.6, depthM: 0.6, image: "holodilnik-150.svg", source: "price2026" },
  { id: "holodilnik-220", catalogId: "", title: "Холодильник 220 л", category: "equipment", widthM: 0.6, depthM: 0.6, image: "holodilnik-220.svg", source: "price2026" },
  { id: "kuler", catalogId: "401", title: "Кулер с бутылью 19 л", category: "equipment", widthM: 0.5, depthM: 0.5, image: "kuler.svg", source: "price2026" },
  { id: "plazma-50", catalogId: "", title: "Плазменная панель 50\"", category: "equipment", widthM: 1.2, depthM: 0.2, image: "plazma-50.svg", source: "price2026" },
  { id: "shchit-pod-plazmu", catalogId: "", title: "Щит под плазменную панель", category: "equipment", widthM: 1, depthM: 0.1, image: "shchit-pod-plazmu.svg", source: "price2026" },
  { id: "stoyka-pod-plazmu", catalogId: "", title: "Стойка напольная под панель", category: "equipment", widthM: 0.6, depthM: 0.6, image: "stoyka-pod-plazmu.svg", source: "price2026" },
  { id: "elektroshchit", catalogId: "301", title: "Электрощит 16 А до 10 кВт", category: "power", widthM: 0.4, depthM: 0.3, image: "elektroshchit.svg", source: "price2026" },
  { id: "rozetki-1kvt", catalogId: "318", title: "Блок розеток 220 В, 1 кВт", category: "power", widthM: 0.2, depthM: 0.2, image: "rozetki-1kvt.svg", source: "price2026" },
  { id: "rozetki-25kvt", catalogId: "", title: "Блок розеток 220 В, 2,5 кВт", category: "power", widthM: 0.2, depthM: 0.2, image: "rozetki-25kvt.svg", source: "price2026" },
  { id: "spot-bra", catalogId: "305", title: "Спот-бра 50 Вт", category: "lighting", widthM: 0.2, depthM: 0.2, image: "spot-bra.svg", source: "price2026" },
  { id: "svetilnik-lyuminescentnyy", catalogId: "314", title: "Светильник люминесцентный 40 Вт", category: "lighting", widthM: 1.2, depthM: 0.2, image: "svetilnik-lyuminescentnyy.svg", source: "price2026" },
  { id: "prozhektor-mg-kronshteyn", catalogId: "302", title: "Прожектор МГ 150 Вт на кронштейне", category: "lighting", widthM: 0.3, depthM: 0.2, image: "prozhektor-mg-kronshteyn.svg", source: "price2026" },
  { id: "prozhektor-mg", catalogId: "310", title: "Прожектор МГ 150 Вт", category: "lighting", widthM: 0.3, depthM: 0.2, image: "prozhektor-mg.svg", source: "price2026" },
  { id: "prozhektor-led", catalogId: "303", title: "Прожектор светодиодный 70 Вт", category: "lighting", widthM: 0.3, depthM: 0.2, image: "prozhektor-led.svg", source: "price2026" },
  { id: "veshalka-nastennaya", catalogId: "602", title: "Вешалка настенная", category: "other", widthM: 0.6, depthM: 0.1, image: "veshalka-nastennaya.svg", source: "price2026" },
  { id: "veshalka-napolnaya", catalogId: "601", title: "Вешалка напольная", category: "other", widthM: 0.5, depthM: 0.5, image: "veshalka-napolnaya.svg", source: "price2026" },
  { id: "veshalo-na-rolikah", catalogId: "603", title: "Вешало на роликах", category: "other", widthM: 1, depthM: 0.5, image: "veshalo-na-rolikah.svg", source: "price2026" },
  { id: "veshalo-dzhoker", catalogId: "607", title: "Вешало-труба «Джокер»", category: "other", widthM: 1, depthM: 0.1, image: "veshalo-dzhoker.svg", source: "price2026" },
  { id: "korzina", catalogId: "609", title: "Корзина для бумаг", category: "other", widthM: 0.3, depthM: 0.3, image: "korzina.svg", source: "price2026" },
  { id: "listovkoderzhatel", catalogId: "412", title: "Листовкодержатель простой", category: "other", widthM: 0.3, depthM: 0.3, image: "listovkoderzhatel.svg", source: "price2026" },
  { id: "listovkoderzhatel-parus", catalogId: "412a", title: "Листовкодержатель «парус»", category: "other", widthM: 0.3, depthM: 0.3, image: "listovkoderzhatel-parus.svg", source: "price2026" },
];
