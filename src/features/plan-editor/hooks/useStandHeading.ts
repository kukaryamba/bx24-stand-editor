import { companyShortName, standNumberFromTitle, useDealTitle } from "../../../shared/crm/dealTitle";
import { formatMeters, getCanvasObject, getObjectStandMeta, getStandSizeMeters } from "../../../shared/domain/project";
import type { FloorPlan } from "../../../shared/domain/types";
import { useEditorStore } from "../store/editorStore";

/**
 * Название стенда: «Стенд D4-1 · Ромашка — 6 м²».
 *
 * Одно на заголовок редактора и паспорт. Собирается при показе, а не берётся
 * из сохранённого: номер и название сделки меняются уже после того, как
 * площадку создали. Номер — из названия сделки, иначе вписанный вручную.
 */
export function useStandHeading(plan: FloorPlan | null): string {
  const project = useEditorStore((state) => state.project);
  const crm = useEditorStore((state) => state.crm);

  const stand = plan?.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
  const meta = stand ? getObjectStandMeta(stand) : null;
  const title = useDealTitle(meta?.dealId ?? crm.dealId, crm.provider === "bitrix24");

  if (!plan) return "План стенда";

  const size = getStandSizeMeters(plan);
  const number = standNumberFromTitle(title) ?? meta?.number;
  const name = [number ? `Стенд ${number}` : "Стенд", companyShortName(title)].filter(Boolean).join(" · ");
  // Площадь, а не габариты: стенды продают по метрам, «2 x 3 м» приходится пересчитывать в уме.
  return `${name} — ${formatMeters(size.width * size.depth)} м²`;
}
