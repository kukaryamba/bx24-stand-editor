import { companyName, companyShortName, standNumberFromTitle, useDealTitle } from "../../../shared/crm/dealTitle";
import { formatMeters, getCanvasObject, getObjectStandMeta, getStandAreaM2 } from "../../../shared/domain/project";
import type { FloorPlan } from "../../../shared/domain/types";
import { useEditorStore } from "../store/editorStore";

/**
 * Название стенда: «Стенд D4-1 · Ромашка — 6 м²».
 *
 * Одно на заголовок редактора и паспорт. Собирается при показе, а не берётся
 * из сохранённого: номер и название сделки меняются уже после того, как
 * площадку создали. Номер — из названия сделки, иначе вписанный вручную.
 */
export function useStandHeading(plan: FloorPlan | null, { fullCompany = false } = {}): string {
  const project = useEditorStore((state) => state.project);
  const crm = useEditorStore((state) => state.crm);

  const stand = plan?.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
  const meta = stand ? getObjectStandMeta(stand) : null;
  const title = useDealTitle(meta?.dealId ?? crm.dealId, crm.provider === "bitrix24");

  if (!plan) return "План стенда";

  const area = getStandAreaM2(project, plan);
  const number = standNumberFromTitle(title) ?? meta?.number;
  // В редакторе название компании обрезается, чтобы заголовок не расползался;
  // в паспорте — целиком: это документ, многоточие там ни к чему.
  const company = fullCompany ? companyName(title) : companyShortName(title);
  const name = [number ? `Стенд ${number}` : "Стенд", company].filter(Boolean).join(" · ");
  // Площадь, а не габариты: стенды продают по метрам, «2 x 3 м» приходится пересчитывать в уме.
  return `${name} — ${formatMeters(area)} м²`;
}
