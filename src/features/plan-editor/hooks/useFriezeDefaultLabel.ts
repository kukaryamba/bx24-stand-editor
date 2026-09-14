import { friezeLabelFromTitle, useDealTitle } from "../../../shared/crm/dealTitle";
import { getCanvasObject, getFloorPlan, getObjectStandMeta } from "../../../shared/domain/project";
import { useEditorStore } from "../store/editorStore";

/**
 * Надпись на фризе для открытой площадки стенда.
 *
 * Одна на стенд: сначала то, что вписано в анкету паспорта, а если там пусто —
 * название сделки до слова «стенд». Сделка берётся та, что закреплена
 * за стендом, а если её нет — та, из которой открыто приложение.
 */
export function useFriezeLabels(): {
  /** Стенд открытой площадки — ему принадлежит надпись. Нет стенда — общий план. */
  standObjectId: string | null;
  /** Вписанное в анкету. */
  passportText: string;
  /** Из названия сделки — подсказка, пока анкета пуста. */
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
  const fromDeal = friezeLabelFromTitle(title);
  const passportText = standMeta?.passport?.friezeText ?? "";

  return {
    standObjectId: stand && standMeta ? stand.id : null,
    passportText,
    fromDeal,
    label: passportText.trim() || fromDeal,
  };
}

/** Надпись на панелях фриза, если у панели нет своей. */
export function useFriezeDefaultLabel(): string {
  return useFriezeLabels().label;
}
