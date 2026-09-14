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

/** Надпись по умолчанию: название сделки до слова «стенд». */
export function friezeLabelFromTitle(title: string | null): string {
  if (!title) return "";

  const [beforeStand] = title.split(/\s*стенд/i);
  // Убираем то, чем название обычно отделяют от номера стенда: тире, запятые, кавычки-хвосты.
  return beforeStand.replace(/[\s,;:—–-]+$/u, "").trim() || title.trim();
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
