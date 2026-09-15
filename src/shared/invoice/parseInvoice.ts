import { standNumberFromTitle } from "../crm/dealTitle";
import type { StandTemplateId } from "../domain/standTemplates";

/**
 * Разбор счёта на оплату из учётной программы.
 *
 * Счета выставки устроены одинаково: «Основание: Заявка-Договор № Е 3-1»,
 * таблица «№ Товары (работы, услуги) Кол-во Ед. Цена Сумма» и «Итого».
 * Из таблицы берётся доп. оборудование, а из строки застройки — площадь
 * и схема стенда. Всё, что не оборудование (сбор, отели, печать), помечается
 * пропущенным, чтобы было видно: строку прочитали, но ставить нечего.
 */

export type InvoiceRow = {
  /** Название позиции целиком, со всеми строками переноса. */
  text: string;
  quantity: number;
  unit: string;
};

export type InvoiceMatch =
  /** Позиция каталога найдена однозначно. */
  | { kind: "item"; itemId: string }
  /** Подходят несколько позиций — выбирает человек. */
  | { kind: "choice"; itemIds: string[] }
  /** Не оборудование: на площадку не ставится. */
  | { kind: "skip"; reason: string }
  /** Не узнали — можно выбрать позицию каталога вручную. */
  | { kind: "unknown" };

export type ParsedInvoice = {
  standNumber: string | null;
  /** Площадь из строки застройки, м². */
  areaM2: number | null;
  scheme: StandTemplateId | null;
  rows: Array<InvoiceRow & { match: InvoiceMatch }>;
};

/** Количество, единица, цена и сумма в конце строки таблицы. */
const tailPattern = /\s(\d+(?:[,.]\d+)?)\s+(шт|м2|м²|пог\.?\s?м|сут|усл|компл|кв\.?\s?м|м)\.?\s+(\d[\d ]*,\d{2})\s+(\d[\d ]*,\d{2})$/iu;

export function parseInvoice(lines: string[]): ParsedInvoice {
  const basis = lines.find((line) => /^Основание/i.test(line)) ?? "";
  const start = lines.findIndex((line) => /Товары\s*\(работы,\s*услуги\)/i.test(line));
  const end = lines.findIndex((line, index) => index > start && /^Итого/i.test(line));
  const table = start >= 0 ? lines.slice(start + 1, end > start ? end : undefined) : [];

  // Строка таблицы начинается со своего номера по порядку. Проверяем именно
  // следующий номер: перенос «2026 г.» тоже начинается с числа.
  const rows: InvoiceRow[] = [];
  let current: { parts: string[]; quantity: number; unit: string } | null = null;
  for (const line of table) {
    const expected = rows.length + (current ? 2 : 1);
    const head = line.match(/^(\d+)\s+(.*)$/u);
    if (head && Number(head[1]) === expected) {
      if (current) rows.push(finishRow(current));
      current = { parts: [], quantity: 0, unit: "" };
      addLine(current, head[2]);
    } else if (current) {
      addLine(current, line);
    }
  }
  if (current) rows.push(finishRow(current));

  const building = rows.find((row) => /застройк/i.test(row.text));

  return {
    standNumber: standNumberFromTitle(basis.replace(/от\s+\d{2}\.\d{2}\.\d{4}.*/u, "")),
    areaM2: building && /м2|м²|кв/i.test(building.unit) ? building.quantity : null,
    scheme: building ? schemeFromText(building.text) : null,
    rows: rows.map((row) => ({ ...row, match: matchRow(row.text) })),
  };
}

function addLine(row: { parts: string[]; quantity: number; unit: string }, line: string) {
  const tail = line.match(tailPattern);
  if (tail && !row.unit) {
    row.quantity = Number(tail[1].replace(",", "."));
    row.unit = tail[2].toLowerCase();
    row.parts.push(line.slice(0, tail.index).trim());
  } else {
    row.parts.push(line.trim());
  }
}

function finishRow(row: { parts: string[]; quantity: number; unit: string }): InvoiceRow {
  return { text: row.parts.join(" ").replace(/\s+/g, " ").trim(), quantity: row.quantity, unit: row.unit };
}

function schemeFromText(text: string): StandTemplateId | null {
  const value = text.toLowerCase();
  if (/углов|с\s*2-?х\s+сторон|с\s+двух\s+сторон/.test(value)) return "corner";
  if (/полуостров|с\s*3-?х\s+сторон|с\s+тр[её]х\s+сторон/.test(value)) return "peninsula";
  if (/остров|с\s*4-?х\s+сторон|со\s+всех\s+сторон/.test(value)) return "island";
  if (/линейн|с\s*1-?й\s+сторон|с\s+одной\s+сторон/.test(value)) return "linear";
  return null;
}

/**
 * Название позиции без обёртки «Аренда доп. оборудования -»: так одинаковое
 * оборудование в разных счетах сводится к одному тексту — по нему и
 * запоминается выбор, сделанный вручную.
 */
export function normalizeRowText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/аренда\s+доп\.?\s*оборудования\s*-?\s*/u, "")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Что точно не ставится на площадку. Проверяется раньше оборудования. */
const skipRules: Array<[RegExp, string]> = [
  [/регистрационн/, "регистрационный сбор"],
  [/застройк|аренда\s+оборудованной\s+площади|аренда\s+площади/, "площадь стенда"],
  [/оклейк|печать|пленк|плёнк|баннер|логотип|надпис/, "печать и оклейка — размечается полосой «Оклейка»"],
  [/размещени|отел|гостиниц|проживани/, "проживание"],
  [/презентаци|обед|кофе|пропуск|парковк|уборк|охран|страхован|реклам|каталог|дизайн|монтаж|доставк|трансфер/, "услуга"],
];

/** Словарь названий из счетов. Порядок важен: частные правила раньше общих. */
const itemRules: Array<[RegExp, string | string[]]> = [
  [/стол-?\s*подиум|подиум/, "stol-podium"],
  [/стол\s+барн|барн\S*\s+стол/, "stol-barnyy"],
  [/журнальн/, "stol-zhurnalnyy"],
  [/стол\s+кругл\S*\s+стекл|стекл\S*\s+кругл\S*\s+стол/, "stol-kruglyy-steklyannyy"],
  [/стол\s+кругл|кругл\S*\s+стол/, "stol-kruglyy-d70"],
  [/стол.*(110|1[,.]1\s*[хx*×]\s*0?[,.]?7)/, "stol-110x70"],
  [/стол\s+квадратн|стол.*70\s*[хx*×]\s*70/, "stol-70x70"],
  [/^стол\b/, ["stol-70x70", "stol-110x70", "stol-kruglyy-d70"]],

  [/стул\s+барн|барн\S*\s+стул/, ["stul-barnyy-z", "stul-barnyy-latina", "stul-barnyy-myagkiy"]],
  [/сильви/, "stul-silviya"],
  [/стул\s+хром|хром\S*\s+стул/, "stul-hrom"],
  [/стул\s+п\s*[/\\]?\s*мягк|полумягк/, "stul-polumyagkiy"],
  [/стул/, ["stul-polumyagkiy", "stul-silviya", "stul-hrom"]],
  [/кресло.*тульст|тульст/, "kreslo-tulsta"],
  [/кресло/, ["kreslo-mk6", "kreslo-tulsta"]],
  [/диван/, "divan-2m"],

  [/спот/, "spot-bra"],
  [/люминесцент/, "svetilnik-lyuminescentnyy"],
  [/прожектор.*(светодиод|led)/, "prozhektor-led"],
  [/прожектор.*кронштейн/, "prozhektor-mg-kronshteyn"],
  [/прожектор/, ["prozhektor-mg", "prozhektor-mg-kronshteyn", "prozhektor-led"]],
  [/электрощит|щит\s+электр/, "elektroshchit"],
  [/розетк.*2[,.]5\s*квт/, "rozetki-25kvt"],
  [/розетк/, "rozetki-1kvt"],

  [/вешал\S*\s+на\s+ролик|ролик/, "veshalo-na-rolikah"],
  [/джокер/, "veshalo-dzhoker"],
  [/вешалк\S*\s+напольн|напольн\S*\s+вешалк/, "veshalka-napolnaya"],
  [/вешалк/, "veshalka-nastennaya"],
  [/корзин/, "korzina"],
  [/листовкодерж.*парус/, "listovkoderzhatel-parus"],
  [/листовкодерж/, "listovkoderzhatel"],

  // Стойки раньше полок: «стойка информационная с внутренней полкой» — стойка.
  [/стойк\S*\s+информационн.*r\s*-?\s*0[,.]5/, "stoyka-r05"],
  [/стойк\S*\s+информационн.*r\s*-?\s*1/, "stoyka-r10"],
  [/стойк\S*.*узк/, "stoyka-uzkaya-polka"],
  [/стойк\S*\s+информационн/, ["stoyka-1x05", "stoyka-uzkaya-polka"]],
  [/стойк\S*\s+напольн.*панел|стойк\S*\s+под\s+(плазм|панел)/, "stoyka-pod-plazmu"],
  [/полк\S*.*наклон/, "polka-naklonnaya"],
  [/полк\S*.*стекл/, "polka-steklyannaya"],
  [/полк\S*.*[хx*×]\s*0[,.]5/, "polka-1x05"],
  [/полк/, "polka-1x03"],
  [/щит\s+под\s+(плазм|панел)/, "shchit-pod-plazmu"],
  [/плазм|телевизор|панель\s+\d+/, "plazma-50"],
  [/витрин/, [
    "vitrina-nizkaya-1x05",
    "vitrina-nizkaya-05x05",
    "vitrina-vysokaya-1x05",
    "vitrina-vysokaya-05x05",
    "vitrina-radiusnaya-r05-h1",
    "vitrina-radiusnaya-r10-h1",
    "vitrina-radiusnaya-r05-h25",
    "vitrina-radiusnaya-r10-h25",
  ]],
  [/шкаф\s+архивн|архивн\S*\s+шкаф/, "shkaf-arhivnyy"],
  [/стеллаж/, "stellazh-plastmassovyy"],
  [/холодильник.*220/, "holodilnik-220"],
  [/холодильник/, "holodilnik-150"],
  [/кулер/, "kuler"],

  [/дверь.*распашн|распашн\S*\s+двер/, "dver-raspashnaya"],
  [/двер/, "dver-razdvizhnaya"],
  [/стен\S*.*занавес/, "stena-zanaveska"],
  [/(элемент\s+стены|стенов|стена).*0[,.]5/, "stena-05"],
  [/элемент\s+стены|стенов\S*\s+панел/, "stena-10"],
];

export function matchRow(text: string): InvoiceMatch {
  const value = normalizeRowText(text);

  for (const [pattern, reason] of skipRules) {
    if (pattern.test(value)) return { kind: "skip", reason };
  }
  for (const [pattern, target] of itemRules) {
    if (!pattern.test(value)) continue;
    return typeof target === "string" ? { kind: "item", itemId: target } : { kind: "choice", itemIds: target };
  }
  return { kind: "unknown" };
}

/**
 * Сколько штук ставить. Полку в счёте считают погонными метрами, а полка
 * в каталоге — метровая: метр — штука. Дробное округляем вверх, чтобы
 * не потерять добор.
 */
export function pieces(row: InvoiceRow): number {
  return Math.max(1, Math.ceil(row.quantity - 1e-9));
}
