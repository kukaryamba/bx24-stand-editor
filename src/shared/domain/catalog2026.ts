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
  { id: "p101", catalogId: "101", title: "Элемент стены 0,5 м", category: "walls", widthM: 0.5, depthM: 0.1, image: "101.svg", source: "price2026" },
  { id: "p103", catalogId: "103", title: "Элемент стены 1 м", category: "walls", widthM: 1, depthM: 0.1, image: "103.svg", source: "price2026" },
  { id: "p111", catalogId: "111", title: "Элемент стены с занавеской", category: "walls", widthM: 1, depthM: 0.1, image: "111.svg", source: "price2026" },
  { id: "p109", catalogId: "109", title: "Дверь раздвижная", category: "walls", widthM: 1, depthM: 0.2, image: "109.svg", source: "price2026" },
  { id: "p110", catalogId: "110", title: "Дверь распашная", category: "walls", widthM: 1, depthM: 0.2, image: "110.svg", source: "price2026" },
  { id: "p115", catalogId: "115", title: "Полка ЛДСП 1 x 0,3 м", category: "storage", widthM: 1, depthM: 0.3, image: "115.svg", source: "price2026" },
  { id: "p115a", catalogId: "115a", title: "Полка ЛДСП 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "115a.svg", source: "price2026" },
  { id: "p115n", catalogId: "115n", title: "Полка ЛДСП наклонная 1 x 0,3 м", category: "storage", widthM: 1, depthM: 0.3, image: "115n.svg", source: "price2026" },
  { id: "p116", catalogId: "116", title: "Полка стеклянная 0,97 x 0,47 м", category: "storage", widthM: 0.97, depthM: 0.47, image: "116.svg", source: "price2026" },
  { id: "p202a", catalogId: "202a", title: "Стойка информационная R-0,5 м", category: "tables", widthM: 1, depthM: 0.5, image: "202a.svg", source: "price2026" },
  { id: "p202", catalogId: "202", title: "Стойка информационная R-1 м", category: "tables", widthM: 1, depthM: 1, image: "202.svg", source: "price2026" },
  { id: "p203", catalogId: "203", title: "Стойка информационная 1 x 0,5 м", category: "tables", widthM: 1, depthM: 0.5, image: "203.svg", source: "price2026" },
  { id: "p211", catalogId: "211", title: "Стойка с узкой верхней полкой 1 x 0,5 м", category: "tables", widthM: 1, depthM: 0.5, image: "211.svg", source: "price2026" },
  { id: "p213", catalogId: "213", title: "Стеллаж пластмассовый, 5 полок", category: "storage", widthM: 1, depthM: 0.4, image: "213.svg", source: "price2026" },
  { id: "p214", catalogId: "214", title: "Витрина низкая 0,5 x 0,5 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "214.svg", source: "price2026" },
  { id: "p215", catalogId: "215", title: "Витрина низкая 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "215.svg", source: "price2026" },
  { id: "p215-R05", catalogId: "215-R05", title: "Витрина радиусная R-0,5 м, h=1 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "215_R05.svg", source: "price2026" },
  { id: "p215-R10", catalogId: "215-R10", title: "Витрина радиусная R-1 м, h=1 м", category: "storage", widthM: 1, depthM: 1, image: "215_R10.svg", source: "price2026" },
  { id: "p216", catalogId: "216", title: "Витрина высокая 0,5 x 0,5 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "216.svg", source: "price2026" },
  { id: "p217", catalogId: "217", title: "Витрина высокая 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "217.svg", source: "price2026" },
  { id: "p219", catalogId: "219", title: "Витрина радиусная R-0,5 м, h=2,5 м", category: "storage", widthM: 0.5, depthM: 0.5, image: "219.svg", source: "price2026" },
  { id: "p218", catalogId: "218", title: "Витрина радиусная R-1 м, h=2,5 м", category: "storage", widthM: 1, depthM: 1, image: "218.svg", source: "price2026" },
  { id: "p220", catalogId: "220", title: "Шкаф архивный 1 x 0,5 м", category: "storage", widthM: 1, depthM: 0.5, image: "220.svg", source: "price2026" },
  { id: "p624", catalogId: "624", title: "Стул полумягкий", category: "seating", widthM: 0.5, depthM: 0.5, image: "624.svg", source: "price2026" },
  { id: "p629", catalogId: "629", title: "Стул барный Z, чёрный", category: "seating", widthM: 0.4, depthM: 0.4, image: "629.svg", source: "price2026" },
  { id: "p629a", catalogId: "629a", title: "Стул барный Latina, белый", category: "seating", widthM: 0.4, depthM: 0.4, image: "629a.svg", source: "price2026" },
  { id: "p629m", catalogId: "629m", title: "Стул барный мягкий с подлокотниками", category: "seating", widthM: 0.45, depthM: 0.45, image: "629m.svg", source: "price2026" },
  { id: "p663", catalogId: "663", title: "Стул белый мягкий Сильвия", category: "seating", widthM: 0.5, depthM: 0.5, image: "663.svg", source: "price2026" },
  { id: "p662", catalogId: "662", title: "Стул хром", category: "seating", widthM: 0.5, depthM: 0.5, image: "662.svg", source: "price2026" },
  { id: "p611", catalogId: "611", title: "Кресло Тульста, белое", category: "seating", widthM: 0.7, depthM: 0.7, image: "611.svg", source: "price2026" },
  { id: "p612", catalogId: "612", title: "Кресло кожаное МК6", category: "seating", widthM: 0.8, depthM: 0.8, image: "612.svg", source: "price2026" },
  { id: "p604", catalogId: "604", title: "Диван кожаный, 2 места", category: "seating", widthM: 1.4, depthM: 0.8, image: "604.svg", source: "price2026" },
  { id: "p621", catalogId: "621", title: "Стол квадратный 0,7 x 0,7 м", category: "tables", widthM: 0.7, depthM: 0.7, image: "621.svg", source: "price2026" },
  { id: "p623", catalogId: "623", title: "Стол 1,1 x 0,7 м", category: "tables", widthM: 1.1, depthM: 0.7, image: "623.svg", source: "price2026" },
  { id: "p70", catalogId: "70", title: "Стол круглый D-0,7 м", category: "tables", widthM: 0.7, depthM: 0.7, image: "70.svg", source: "price2026" },
  { id: "p630", catalogId: "630", title: "Стол круглый стеклянный", category: "tables", widthM: 0.7, depthM: 0.7, image: "630.svg", source: "price2026" },
  { id: "p405", catalogId: "405", title: "Стол барный ЛДСП", category: "tables", widthM: 0.6, depthM: 0.6, image: "405.svg", source: "price2026" },
  { id: "p606", catalogId: "606", title: "Журнальный стол стеклянный", category: "tables", widthM: 1, depthM: 0.6, image: "606.svg", source: "price2026" },
  { id: "p411", catalogId: "411", title: "Холодильник 150 л", category: "equipment", widthM: 0.6, depthM: 0.6, image: "411.svg", source: "price2026" },
  { id: "p411a", catalogId: "411a", title: "Холодильник 220 л", category: "equipment", widthM: 0.6, depthM: 0.6, image: "411a.svg", source: "price2026" },
  { id: "p401", catalogId: "401", title: "Кулер с бутылью 19 л", category: "equipment", widthM: 0.5, depthM: 0.5, image: "401.svg", source: "price2026" },
  { id: "p501", catalogId: "501", title: "Плазменная панель 50\"", category: "equipment", widthM: 1.2, depthM: 0.2, image: "501.svg", source: "price2026" },
  { id: "p502", catalogId: "502", title: "Щит под плазменную панель", category: "equipment", widthM: 1, depthM: 0.1, image: "502.svg", source: "price2026" },
  { id: "p503", catalogId: "503", title: "Стойка напольная под панель", category: "equipment", widthM: 0.6, depthM: 0.6, image: "503.svg", source: "price2026" },
  { id: "p301", catalogId: "301", title: "Электрощит 16 А до 10 кВт", category: "power", widthM: 0.4, depthM: 0.3, image: "301.svg", source: "price2026" },
  { id: "p318", catalogId: "318", title: "Блок розеток 220 В, 1 кВт", category: "power", widthM: 0.2, depthM: 0.2, image: "318.svg", source: "price2026" },
  { id: "p318a", catalogId: "318a", title: "Блок розеток 220 В, 2,5 кВт", category: "power", widthM: 0.2, depthM: 0.2, image: "318a.svg", source: "price2026" },
  { id: "p305", catalogId: "305", title: "Спот-бра 50 Вт", category: "lighting", widthM: 0.2, depthM: 0.2, image: "305.svg", source: "price2026" },
  { id: "p314", catalogId: "314", title: "Светильник люминесцентный 40 Вт", category: "lighting", widthM: 1.2, depthM: 0.2, image: "314.svg", source: "price2026" },
  { id: "p302", catalogId: "302", title: "Прожектор МГ 150 Вт на кронштейне", category: "lighting", widthM: 0.3, depthM: 0.2, image: "302.svg", source: "price2026" },
  { id: "p310", catalogId: "310", title: "Прожектор МГ 150 Вт", category: "lighting", widthM: 0.3, depthM: 0.2, image: "310.svg", source: "price2026" },
  { id: "p303", catalogId: "303", title: "Прожектор светодиодный 70 Вт", category: "lighting", widthM: 0.3, depthM: 0.2, image: "303.svg", source: "price2026" },
  { id: "p602", catalogId: "602", title: "Вешалка настенная", category: "other", widthM: 0.6, depthM: 0.1, image: "602.svg", source: "price2026" },
  { id: "p601", catalogId: "601", title: "Вешалка напольная", category: "other", widthM: 0.5, depthM: 0.5, image: "601.svg", source: "price2026" },
  { id: "p603", catalogId: "603", title: "Вешало на роликах", category: "other", widthM: 1, depthM: 0.5, image: "603.svg", source: "price2026" },
  { id: "p607", catalogId: "607", title: "Вешало-труба «Джокер»", category: "other", widthM: 1, depthM: 0.1, image: "607.svg", source: "price2026" },
  { id: "p609", catalogId: "609", title: "Корзина для бумаг", category: "other", widthM: 0.3, depthM: 0.3, image: "609.svg", source: "price2026" },
  { id: "p412", catalogId: "412", title: "Листовкодержатель простой", category: "other", widthM: 0.3, depthM: 0.3, image: "412.svg", source: "price2026" },
  { id: "p412a", catalogId: "412a", title: "Листовкодержатель «парус»", category: "other", widthM: 0.3, depthM: 0.3, image: "412a.svg", source: "price2026" },
];
