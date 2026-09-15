import { useEffect, useState } from "react";
import { companyShortName, loadDealTitles } from "../../../shared/crm/dealTitle";
import { getObjectStandMeta } from "../../../shared/domain/project";
import type { CanvasObject } from "../../../shared/domain/types";
import { useEditorStore } from "../store/editorStore";

/**
 * Короткие названия компаний стендов — для подписей на общем плане.
 *
 * Берутся из названий сделок, как номер и заголовок площадки. Названия
 * запрашиваются списком и кэшируются, поэтому сотня стендов не превращается
 * в сотню запросов, а номера и подписи делят один кэш.
 */
export function useStandCompanies(stands: CanvasObject[]): Record<string, string> {
  const crm = useEditorStore((state) => state.crm);
  const [companies, setCompanies] = useState<Record<string, string>>({});

  // Ключ — пары «стенд:сделка»: меняется при привязке, а не на каждую правку.
  const bindings = stands
    .map((stand) => {
      const dealId = getObjectStandMeta(stand)?.dealId;
      return dealId ? `${stand.id}:${dealId}` : null;
    })
    .filter(Boolean)
    .join(",");

  useEffect(() => {
    if (crm.provider !== "bitrix24" || !bindings) {
      setCompanies({});
      return;
    }

    let cancelled = false;
    const pairs = bindings.split(",").map((pair) => pair.split(":") as [string, string]);

    void loadDealTitles(pairs.map(([, dealId]) => dealId)).then((titles) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [standId, dealId] of pairs) {
        const name = companyShortName(titles.get(dealId) ?? null);
        if (name) next[standId] = name;
      }
      setCompanies(next);
    });

    return () => {
      cancelled = true;
    };
  }, [bindings, crm.provider]);

  return companies;
}
