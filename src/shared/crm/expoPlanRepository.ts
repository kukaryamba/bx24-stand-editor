import type { ExhibitionProject } from "../domain/types";
import { callMethod } from "./bitrixApi";

/**
 * Хранение карты выставки в портале.
 *
 * Раньше карта жила только в памяти браузера, и это давало неприятности:
 * стенды пропадали при смене адреса приложения, не открывались у коллег и
 * различались в портале и по прямой ссылке — браузер разделяет хранилище
 * для страницы во фрейме и для неё же, открытой напрямую.
 *
 * Настройки приложения на портале — общие для всех сотрудников, поэтому
 * карта выставки лежит здесь. Планы отдельных стендов по-прежнему в сделках:
 * у каждого стенда своя.
 */

const optionName = "stand_editor_expo_plan";
const planFormatVersion = 1;

type StoredPlan = {
  version: number;
  savedAt: string;
  project: ExhibitionProject;
};

/**
 * Готовит проект к отправке: выбрасывает то, что в настройки не влезет
 * или хранится в другом месте.
 *
 * Фоновая картинка — сотни килобайт в виде текста, ей место на Диске.
 * Предметы на стендах лежат в сделках, дублировать их здесь незачем.
 */
export function stripForPortal(project: ExhibitionProject): ExhibitionProject {
  return {
    ...project,
    floorPlans: project.floorPlans.map((plan) =>
      plan.background
        ? { ...plan, background: { ...plan.background, imageUrl: "" } }
        : plan,
    ),
    objects: project.objects.filter((object) => object.kind !== "equipment"),
  };
}

export function portalPayloadSizeKb(project: ExhibitionProject): number {
  const payload = buildPayload(project);
  return Math.round((new Blob([JSON.stringify(payload)]).size / 1024) * 10) / 10;
}

export async function saveExpoPlan(project: ExhibitionProject): Promise<void> {
  await callMethod("app.option.set", {
    options: { [optionName]: JSON.stringify(buildPayload(project)) },
  });
}

export async function loadExpoPlan(): Promise<ExhibitionProject | null> {
  const raw = await callMethod<unknown>("app.option.get", { option: optionName });
  const value = typeof raw === "string" ? raw : extractOption(raw);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as StoredPlan;
    if (!parsed.project || !Array.isArray(parsed.project.floorPlans)) return null;
    return parsed.project;
  } catch (error) {
    console.warn("Карта выставки в портале повреждена и будет проигнорирована.", error);
    return null;
  }
}

/**
 * Соединяет карту из портала с тем, что открыто сейчас.
 *
 * Из портала берутся стенды и планы, из браузера — фоновые картинки:
 * их в портал не отправляли, а терять уже загруженную подложку не хочется.
 */
export function mergeWithLocalBackgrounds(portal: ExhibitionProject, local: ExhibitionProject | null): ExhibitionProject {
  if (!local) return portal;

  const localPlans = new Map(local.floorPlans.map((plan) => [plan.id, plan]));
  const equipment = local.objects.filter((object) => object.kind === "equipment");

  return {
    ...portal,
    floorPlans: portal.floorPlans.map((plan) => {
      const savedImage = localPlans.get(plan.id)?.background?.imageUrl;
      if (!plan.background || plan.background.imageUrl || !savedImage) return plan;
      return { ...plan, background: { ...plan.background, imageUrl: savedImage } };
    }),
    objects: [...portal.objects, ...equipment],
  };
}

function buildPayload(project: ExhibitionProject): StoredPlan {
  return {
    version: planFormatVersion,
    savedAt: new Date().toISOString(),
    project: stripForPortal(project),
  };
}

function extractOption(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;

  const value = (raw as Record<string, unknown>)[optionName];
  return typeof value === "string" ? value : null;
}
