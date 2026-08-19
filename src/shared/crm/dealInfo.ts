import { callMethod } from "./bitrixApi";

/**
 * Сведения о сделке для печатных форм.
 *
 * Паспорт стенда подписывается компанией и контактным лицом, а они лежат
 * не в сделке, а в связанных с ней сущностях: сделка хранит только их номера.
 */

export type DealSummary = {
  title: string;
  companyName: string | null;
  contactName: string | null;
};

export async function getDealSummary(dealId: string): Promise<DealSummary> {
  const deal = await callMethod<Record<string, unknown>>("crm.deal.get", { id: Number(dealId) });

  const companyId = asId(deal.COMPANY_ID);
  const contactId = asId(deal.CONTACT_ID);

  const [companyName, contactName] = await Promise.all([
    companyId ? companyTitle(companyId) : Promise.resolve(null),
    contactId ? contactTitle(contactId) : Promise.resolve(null),
  ]);

  return {
    title: typeof deal.TITLE === "string" ? deal.TITLE : `Сделка ${dealId}`,
    companyName,
    contactName,
  };
}

async function companyTitle(companyId: string): Promise<string | null> {
  try {
    const company = await callMethod<Record<string, unknown>>("crm.company.get", { id: Number(companyId) });
    return typeof company.TITLE === "string" ? company.TITLE : null;
  } catch (error) {
    console.warn("Не удалось получить компанию сделки.", error);
    return null;
  }
}

async function contactTitle(contactId: string): Promise<string | null> {
  try {
    const contact = await callMethod<Record<string, unknown>>("crm.contact.get", { id: Number(contactId) });
    const parts = [contact.LAST_NAME, contact.NAME, contact.SECOND_NAME]
      .filter((part): part is string => typeof part === "string" && part.trim() !== "")
      .map((part) => part.trim());

    return parts.length > 0 ? parts.join(" ") : null;
  } catch (error) {
    console.warn("Не удалось получить контакт сделки.", error);
    return null;
  }
}

/** Пустая связь приходит то нулём, то пустой строкой, то отсутствует вовсе. */
function asId(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;

  const value = String(raw).trim();
  return value === "" || value === "0" ? null : value;
}
