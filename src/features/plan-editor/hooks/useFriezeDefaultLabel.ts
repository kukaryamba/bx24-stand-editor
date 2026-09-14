import { friezeLabelFromTitle, useDealTitle } from "../../../shared/crm/dealTitle";
import { getCanvasObject, getFloorPlan, getObjectStandMeta } from "../../../shared/domain/project";
import { useEditorStore } from "../store/editorStore";

/**
 * Надпись на фризе по умолчанию для открытой площадки стенда: название сделки
 * этого стенда до слова «стенд». Сделка берётся та, что закреплена за стендом,
 * а если её нет — та, из которой открыто приложение.
 */
export function useFriezeDefaultLabel(): string {
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const crm = useEditorStore((state) => state.crm);

  const plan = getFloorPlan(project, activeFloorPlanId);
  const stand = plan?.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
  const dealId = (stand ? getObjectStandMeta(stand)?.dealId : null) ?? crm.dealId;

  const title = useDealTitle(dealId, crm.provider === "bitrix24");
  return friezeLabelFromTitle(title);
}
