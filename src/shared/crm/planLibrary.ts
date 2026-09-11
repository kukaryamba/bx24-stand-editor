import type { BundledPlan } from "../domain/bundledPlans";
import { callMethod } from "./bitrixApi";

/**
 * Список сохранённых планов выставок, общий для всех сотрудников.
 *
 * Готовые планы из состава приложения добавляются только коммитом. Чтобы
 * новый план попадал в список без программиста, сохранённые хранятся здесь,
 * в настройках приложения на портале. Сама картинка лежит на хостинге —
 * в списке только ссылка на неё и выверенная сетка.
 */

const optionName = "stand_editor_plan_library";

export type SavedPlan = BundledPlan & {
  savedAt: string;
};

export async function loadPlanLibrary(): Promise<SavedPlan[]> {
  const raw = await callMethod<unknown>("app.option.get", { option: optionName });
  const value = typeof raw === "string" ? raw : extractOption(raw);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as SavedPlan[];
    return Array.isArray(parsed) ? parsed.filter((plan) => plan?.id && plan.background?.imageUrl) : [];
  } catch {
    return [];
  }
}

export async function savePlanLibrary(plans: SavedPlan[]): Promise<void> {
  await callMethod("app.option.set", { options: { [optionName]: JSON.stringify(plans) } });
}

function extractOption(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;

  const value = (raw as Record<string, unknown>)[optionName];
  return typeof value === "string" ? value : null;
}
