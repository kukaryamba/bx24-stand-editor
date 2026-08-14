import { callMethod } from "./bitrixApi";

/**
 * Ограничение приложения одной воронкой сделок.
 *
 * Встраивание в Битрикс24 привязывается ко всем сделкам сразу: у точки
 * CRM_DEAL_DETAIL_TAB нет параметров фильтрации, а обработчик получает только
 * номер сделки. Поэтому воронку приложение проверяет само и в чужой показывает
 * заглушку вместо редактора.
 *
 * Выбранная воронка хранится в настройках приложения на портале, а не в
 * браузере: настройка общая для всех сотрудников.
 */

const optionName = "stand_editor_deal_category";

export type DealCategory = {
  id: string;
  name: string;
};

/** Воронки сделок портала. entityTypeId 2 — это сделка. */
export async function listDealCategories(): Promise<DealCategory[]> {
  const result = await callMethod<{ categories?: Array<{ id: number | string; name?: string }> }>("crm.category.list", {
    entityTypeId: 2,
  });

  return (result?.categories ?? []).map((item) => ({
    id: String(item.id),
    name: item.name?.trim() || `Воронка ${item.id}`,
  }));
}

/** Воронка, в которой лежит сделка. */
export async function getDealCategoryId(dealId: string): Promise<string | null> {
  const deal = await callMethod<Record<string, unknown>>("crm.deal.get", { id: Number(dealId) });
  const raw = deal.CATEGORY_ID;

  return raw === undefined || raw === null ? null : String(raw);
}

/** Какая воронка выбрана. null — ограничение не настроено, работают все. */
export async function getAllowedCategory(): Promise<DealCategory | null> {
  const raw = await callMethod<unknown>("app.option.get", { option: optionName });
  const value = typeof raw === "string" ? raw : extractOption(raw);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as DealCategory;
    return parsed.id ? parsed : null;
  } catch {
    return null;
  }
}

export async function setAllowedCategory(category: DealCategory | null): Promise<void> {
  await callMethod("app.option.set", {
    options: { [optionName]: category ? JSON.stringify(category) : "" },
  });
}

/** Ответ app.option.get приходит то строкой, то объектом с настройками. */
function extractOption(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;

  const value = (raw as Record<string, unknown>)[optionName];
  return typeof value === "string" ? value : null;
}
