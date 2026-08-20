import { callMethod } from "./bitrixApi";

/**
 * Сопоставление полей паспорта с полями сделки портала.
 *
 * В старом приложении номера полей amoCRM были вписаны в код: 481677 — текст
 * фриза, 542243 — его цвет и так далее. В Битрикс24 поля другие, у каждого
 * портала свои, и зашивать их в код заново — значит повторить ту же ошибку.
 *
 * Поэтому соответствие выбирается один раз в настройках приложения и хранится
 * в портале: администратор указывает, какое поле сделки чему отвечает.
 */

const optionName = "stand_editor_passport_fields";

export type PassportSlot = {
  id: string;
  /** Как называется строка в паспорте. */
  title: string;
};

/** Что паспорт умеет показывать, если для этого найдётся поле сделки. */
export const passportSlots: PassportSlot[] = [
  { id: "friezeText", title: "Надпись на фризе" },
  { id: "friezeColor", title: "Цвет надписи" },
  { id: "carpetColor", title: "Цвет ковра" },
  { id: "selfBuild", title: "Самостоятельная застройка" },
  { id: "diploma", title: "Название для диплома" },
  { id: "heavyTech", title: "Комментарий по тяжёлой технике" },
];

export type DealField = {
  code: string;
  title: string;
  /** Для списков: значения по идентификаторам, иначе сделка вернёт число. */
  items?: Record<string, string>;
};

export type PassportMapping = Record<string, string>;

/** Поля сделки портала, из которых можно выбирать. */
export async function listDealFields(): Promise<DealField[]> {
  const fields = await callMethod<Record<string, unknown>>("crm.deal.fields");

  return Object.entries(fields ?? {})
    .map(([code, raw]) => {
      const field = (raw ?? {}) as { title?: string; formLabel?: string; listLabel?: string; items?: Array<{ ID?: unknown; VALUE?: unknown }> };
      const title = field.formLabel || field.title || field.listLabel || code;

      const items = Array.isArray(field.items)
        ? Object.fromEntries(field.items.map((item) => [String(item.ID), String(item.VALUE ?? "")]))
        : undefined;

      return { code, title, items };
    })
    // Служебные поля вроде идентификаторов в паспорте бесполезны, но отсеивать
    // по списку рискованно: у каждого портала свои. Оставляем всё, сортируя
    // пользовательские поля вверх — их и ищут.
    .sort((left, right) => {
      const leftUser = left.code.startsWith("UF_") ? 0 : 1;
      const rightUser = right.code.startsWith("UF_") ? 0 : 1;
      return leftUser - rightUser || left.title.localeCompare(right.title, "ru");
    });
}

export async function getPassportMapping(): Promise<PassportMapping> {
  const raw = await callMethod<unknown>("app.option.get", { option: optionName });
  const value = typeof raw === "string" ? raw : extractOption(raw);
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as PassportMapping;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function setPassportMapping(mapping: PassportMapping): Promise<void> {
  await callMethod("app.option.set", { options: { [optionName]: JSON.stringify(mapping) } });
}

export type PassportValue = {
  slot: PassportSlot;
  value: string;
};

/**
 * Значения полей паспорта для сделки.
 *
 * Пустые строки не возвращаются: пустая строка в документе для монтажников
 * выглядит как «здесь ничего не нужно», а на деле означает «не заполнили».
 */
export function readPassportValues(
  deal: Record<string, unknown>,
  mapping: PassportMapping,
  fields: DealField[],
): PassportValue[] {
  const byCode = new Map(fields.map((field) => [field.code, field]));

  return passportSlots
    .map((slot) => {
      const code = mapping[slot.id];
      if (!code) return null;

      const value = formatValue(deal[code], byCode.get(code));
      return value ? { slot, value } : null;
    })
    .filter((item): item is PassportValue => item !== null);
}

function formatValue(raw: unknown, field: DealField | undefined): string {
  if (raw === null || raw === undefined) return "";

  if (Array.isArray(raw)) {
    return raw.map((item) => formatValue(item, field)).filter(Boolean).join(", ");
  }

  const text = String(raw).trim();
  if (text === "" || text === "0") return "";

  // Список: сделка возвращает идентификатор значения, а не сам текст.
  if (field?.items?.[text]) return field.items[text];

  if (text === "Y") return "Да";
  if (text === "N") return "Нет";

  return text;
}

function extractOption(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;

  const value = (raw as Record<string, unknown>)[optionName];
  return typeof value === "string" ? value : null;
}
