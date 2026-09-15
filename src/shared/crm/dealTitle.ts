import { useEffect, useState } from "react";
import { callMethod } from "./bitrixApi";

/**
 * Название сделки — для надписи на фризе по умолчанию.
 *
 * Сделки у выставки называют по шаблону «Компания стенд номер», поэтому
 * название компании для фриза — это всё до слова «стенд». Если такого слова
 * нет, берётся название целиком: так хотя бы что-то осмысленное.
 */

/** Кэш на сессию: название нужно и холсту, и карточке справа. */
const titles = new Map<string, Promise<string | null>>();

export function loadDealTitle(dealId: string): Promise<string | null> {
  let pending = titles.get(dealId);
  if (!pending) {
    pending = callMethod<Record<string, unknown>>("crm.deal.get", { id: Number(dealId) })
      .then((deal) => (typeof deal.TITLE === "string" ? deal.TITLE : null))
      .catch((error: unknown) => {
        console.warn("Не удалось получить название сделки для фриза.", error);
        titles.delete(dealId);
        return null;
      });
    titles.set(dealId, pending);
  }
  return pending;
}

/**
 * Номер стенда в названии: буквы ряда, число и через дефис место — D4-1.
 * Между буквой и числом бывает пробел — «D 4-2». Границы — не буква
 * и не цифра, чтобы не выхватить кусок слова.
 */
const standNumberPattern = /(?<![\p{L}\d])(\p{L}{1,3} ?\d{1,4}\s*[-–—]\s*\d{1,4})(?![\p{L}\d])/u;

/**
 * Номер стенда из названия сделки, например «D4-1». Нет номера — null,
 * и тогда номер остаётся тем, что вписали руками.
 */
export function standNumberFromTitle(title: string | null): string | null {
  const match = title?.match(standNumberPattern);
  return match ? match[1].replace(/\s*[-–—]\s*/u, "-").replace(/\s+/gu, "").toUpperCase() : null;
}

/**
 * Названия сразу многих сделок — для номеров всех стендов на карте.
 * По одной сделке на запрос сотня стендов упёрлась бы в лимит портала,
 * поэтому списком, по 50 — столько портал отдаёт за раз. Складываем в тот же кэш.
 */
export async function loadDealTitles(dealIds: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(dealIds)];
  const missing = unique.filter((id) => !titles.has(id));

  for (let start = 0; start < missing.length; start += 50) {
    const chunk = missing.slice(start, start + 50);
    const pending = callMethod<Array<Record<string, unknown>>>("crm.deal.list", {
      filter: { "@ID": chunk.map(Number) },
      select: ["ID", "TITLE"],
    }).then((deals) => new Map(deals.map((deal) => [String(deal.ID), typeof deal.TITLE === "string" ? deal.TITLE : null])));

    for (const id of chunk) {
      const single = () => callMethod<Record<string, unknown>>("crm.deal.get", { id: Number(id) }).then((deal) => (typeof deal.TITLE === "string" ? deal.TITLE : null));
      titles.set(
        id,
        pending
          // Список не отдал сделку или не сработал вовсе — спрашиваем её отдельно,
          // чтобы из-за списка номер не пропал.
          .then((found) => (found.has(id) ? (found.get(id) ?? null) : single()))
          .catch(() => single())
          .catch((error: unknown) => {
            console.warn("Не удалось получить название сделки.", error);
            titles.delete(id);
            return null;
          }),
      );
    }
  }

  const result = new Map<string, string | null>();
  for (const id of unique) result.set(id, (await titles.get(id)) ?? null);
  return result;
}

/** Организационно-правовые формы: в заголовке они только занимают место. */
const legalForms = /(?<![\p{L}\d])(ООО|ОАО|ЗАО|ПАО|НАО|АО|ИП|ТОО|НПО|НПП|НПФ|ГУП|МУП|ФГУП|ФГБУ|АНО|ООО\s+ТД|ТД|LLC|LTD|GMBH|INC)(?![\p{L}\d])\.?/giu;

/** Длиннее — заголовок площадки переносится на три строки. */
const companyMaxLength = 24;

/**
 * Короткое название компании для заголовка: название сделки до слова «стенд»,
 * без ООО, ИП и прочих форм и без кавычек; длинное обрезается многоточием.
 */
export function companyShortName(title: string | null): string {
  const company = friezeLabelFromTitle(title)
    .replace(legalForms, " ")
    .replace(/[«»"“”„']/gu, " ")
    .replace(/\s+/gu, " ")
    .replace(/^[\s,;:—–-]+|[\s,;:—–-]+$/gu, "");

  const chars = Array.from(company);
  return chars.length > companyMaxLength ? `${chars.slice(0, companyMaxLength - 1).join("").trimEnd()}…` : company;
}

/** Надпись по умолчанию: название сделки до слова «стенд». */
export function friezeLabelFromTitle(title: string | null): string {
  if (!title) return "";

  const [beforeStand] = title.split(/\s*стенд/i);
  // Слова «стенд» нет — отрезаем хотя бы номер стенда, на фризе он не нужен.
  const numberAt = beforeStand === title ? title.search(standNumberPattern) : -1;
  const company = numberAt > 0 ? title.slice(0, numberAt) : beforeStand;
  // Убираем то, чем название обычно отделяют от номера стенда: тире, запятые, кавычки-хвосты.
  return company.replace(/[\s,;:—–№#-]+$/u, "").trim() || title.trim();
}

export function useDealTitle(dealId: string | null, enabled: boolean): string | null {
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !dealId) {
      setTitle(null);
      return;
    }

    let cancelled = false;
    void loadDealTitle(dealId).then((loaded) => {
      if (!cancelled) setTitle(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [dealId, enabled]);

  return title;
}
