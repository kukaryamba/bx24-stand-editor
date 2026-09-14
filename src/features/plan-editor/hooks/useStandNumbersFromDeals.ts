import { useEffect } from "react";
import { loadDealTitles, standNumberFromTitle } from "../../../shared/crm/dealTitle";
import { getObjectStandMeta } from "../../../shared/domain/project";
import { useEditorStore } from "../store/editorStore";

/**
 * Номера стендов берутся из названий их сделок: сделки называют с номером
 * вида «D4-1», и вписывать его второй раз руками — повод ошибиться.
 *
 * Сверка идёт при каждой смене набора сделок на карте: стенд привязали
 * к сделке — номер подставился. Если в названии номера нет, остаётся
 * вписанный вручную.
 */
export function useStandNumbersFromDeals(): void {
  const project = useEditorStore((state) => state.project);
  const crm = useEditorStore((state) => state.crm);
  const syncStandNumbers = useEditorStore((state) => state.syncStandNumbers);

  // Ключ — пары «стенд:сделка». Меняется только при привязке, а не на каждую правку.
  const bindings = (project?.objects ?? [])
    .map((object) => {
      const dealId = getObjectStandMeta(object)?.dealId;
      return dealId ? `${object.id}:${dealId}` : null;
    })
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    if (crm.provider !== "bitrix24" || !bindings) return;

    let cancelled = false;
    const pairs = bindings.split(",").map((pair) => pair.split(":") as [string, string]);

    void loadDealTitles(pairs.map(([, dealId]) => dealId)).then((titles) => {
      if (cancelled) return;

      const numbers: Record<string, string> = {};
      for (const [standId, dealId] of pairs) {
        const number = standNumberFromTitle(titles.get(dealId) ?? null);
        if (number) numbers[standId] = number;
      }
      syncStandNumbers(numbers);
    });

    return () => {
      cancelled = true;
    };
  }, [bindings, crm.provider, syncStandNumbers]);
}
