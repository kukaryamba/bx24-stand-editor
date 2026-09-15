import { callMethod } from "./bitrixApi";

/**
 * Выбор, сделанный вручную при загрузке счёта: какой позиции каталога
 * соответствует название из счёта. Общий для всех, хранится в настройках
 * приложения на портале — второй раз для того же названия выбирать не нужно.
 *
 * Ключ — название позиции без «Аренда доп. оборудования». Значение — id
 * позиции каталога или "skip", если строку решили не ставить.
 */

const optionName = "stand_editor_invoice_mappings";

export type InvoiceMappings = Record<string, string>;

export async function loadInvoiceMappings(): Promise<InvoiceMappings> {
  const raw = await callMethod<unknown>("app.option.get", { option: optionName });
  const value = typeof raw === "string" ? raw : raw && typeof raw === "object" ? (raw as Record<string, unknown>)[optionName] : null;
  if (typeof value !== "string" || !value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as InvoiceMappings) : {};
  } catch {
    return {};
  }
}

export async function saveInvoiceMappings(mappings: InvoiceMappings): Promise<void> {
  await callMethod("app.option.set", { options: { [optionName]: JSON.stringify(mappings) } });
}
