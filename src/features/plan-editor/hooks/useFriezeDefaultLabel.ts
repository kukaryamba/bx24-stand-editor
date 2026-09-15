import { companyName, useDealTitle } from "../../../shared/crm/dealTitle";
import { getCanvasObject, getFloorPlan, getObjectStandMeta } from "../../../shared/domain/project";
import { useEditorStore } from "../store/editorStore";

/**
 * Надпись на фризе для открытой площадки стенда.
 *
 * Одна на стенд. Пока её не трогали, это название компании из сделки —
 * без «ООО», кавычек, слова «стенд» и номера. Как только её поправили,
 * хранится в анкете паспорта, в том числе пустая: стёртое поле не должно
 * тут же снова заполняться из сделки, иначе надпись не набрать заново.
 */
export function useFriezeLabels(): {
  /** Стенд открытой площадки — ему принадлежит надпись. Нет стенда — общий план. */
  standObjectId: string | null;
  /** Вписанное в анкету; undefined — не трогали, берётся из сделки. */
  passportText: string | undefined;
  /** Название компании из сделки. */
  fromDeal: string;
  /** Что в итоге написано на панелях. */
  label: string;
} {
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const crm = useEditorStore((state) => state.crm);

  const plan = getFloorPlan(project, activeFloorPlanId);
  const stand = plan?.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
  const standMeta = stand ? getObjectStandMeta(stand) : null;
  const dealId = standMeta?.dealId ?? crm.dealId;

  const title = useDealTitle(dealId, crm.provider === "bitrix24");
  const fromDeal = companyName(title);
  const passportText = standMeta?.passport?.friezeText;

  return {
    standObjectId: stand && standMeta ? stand.id : null,
    passportText,
    fromDeal,
    label: passportText ?? fromDeal,
  };
}

/** Надпись на панелях фриза, если у панели нет своей. */
export function useFriezeDefaultLabel(): string {
  return useFriezeLabels().label;
}
