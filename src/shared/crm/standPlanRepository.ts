import type { CanvasObject, ExhibitionProject, GridSettings } from "../domain/types";
import { callMethod, createStandPlanField, findStandPlanField } from "./bitrixApi";

/**
 * Хранение плана стенда в карточке сделки Битрикс24.
 *
 * В сделке лежит план одного стенда — предметы и масштаб сетки, — а не вся
 * выставка. Так же было устроено старое приложение: общий план один на выставку,
 * а расстановка предметов своя в каждой сделке.
 */

/** Версия формата: пригодится, когда структура плана изменится. */
const planFormatVersion = 1;

export type StandPlanPayload = {
  version: number;
  savedAt: string;
  grid: Pick<GridSettings, "cellSizePx" | "metersPerCell">;
  objects: CanvasObject[];
};

let cachedFieldName: string | null = null;

/** Находит поле сделки, при необходимости создаёт его. */
export async function ensureStandPlanField(): Promise<string> {
  if (cachedFieldName) return cachedFieldName;

  const existing = await findStandPlanField();
  cachedFieldName = existing ?? (await createStandPlanField());
  return cachedFieldName;
}

export function buildStandPlanPayload(project: ExhibitionProject, floorPlanId: string | null): StandPlanPayload {
  const plan = project.floorPlans.find((item) => item.id === floorPlanId) ?? project.floorPlans[0];
  const objects = project.objects.filter((object) => object.kind === "equipment" && (!floorPlanId || object.floorPlanId === floorPlanId));

  return {
    version: planFormatVersion,
    savedAt: new Date().toISOString(),
    grid: {
      cellSizePx: plan?.grid.cellSizePx ?? 24,
      metersPerCell: plan?.grid.metersPerCell ?? 1,
    },
    objects,
  };
}

export async function saveStandPlan(dealId: string, payload: StandPlanPayload): Promise<void> {
  const fieldName = await ensureStandPlanField();
  const serialized = JSON.stringify(payload);

  await callMethod("crm.deal.update", {
    id: Number(dealId),
    fields: { [fieldName]: serialized },
  });
}

export async function loadStandPlan(dealId: string): Promise<StandPlanPayload | null> {
  const fieldName = await ensureStandPlanField();
  const deal = await callMethod<Record<string, unknown>>("crm.deal.get", { id: Number(dealId) });

  const raw = deal[fieldName];
  if (typeof raw !== "string" || raw.trim() === "") return null;

  try {
    const parsed = JSON.parse(raw) as StandPlanPayload;
    if (!Array.isArray(parsed.objects)) return null;
    return parsed;
  } catch (error) {
    console.warn("План стенда в сделке повреждён и будет проигнорирован.", error);
    return null;
  }
}

/** Размер плана в килобайтах — чтобы предупредить о слишком тяжёлых планах. */
export function payloadSizeKb(payload: StandPlanPayload): number {
  return Math.round((new Blob([JSON.stringify(payload)]).size / 1024) * 10) / 10;
}
