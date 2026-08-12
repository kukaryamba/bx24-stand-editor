import { createEmptyProject } from "../domain/seed";
import type {
  CanvasObject,
  Exhibition,
  ExhibitionProject,
  FloorPlan,
  ObjectMeta,
  ProjectLayer,
  StandStatus,
} from "../domain/types";

const storageKey = "bitrix24-expo-plan-project";
const legacyStorageKey = "bitrix24-expo-plan-workspace";
const seedUrl = "/data/exhibitions.json";

type LegacyPlan = {
  id: string;
  exhibitionId: string;
  title: string;
  imageUrl: string;
  gridSizePx: number;
  metersPerCell: number;
  scale: number;
  width: number;
  height: number;
};

type LegacyStand = {
  id: string;
  planId: string;
  number: string;
  points: Array<{ x: number; y: number }>;
  status: StandStatus;
  dealId: string | null;
  note: string;
};

type LegacyWorkspace = {
  exhibitions: Exhibition[];
  plans: LegacyPlan[];
  stands: LegacyStand[];
};

export const localPlanRepository = {
  async load(): Promise<ExhibitionProject> {
    const saved = loadJson(storageKey) ?? loadJson(legacyStorageKey);
    if (saved) {
      const project = migrateProject(saved);
      if (project) {
        window.localStorage.removeItem(legacyStorageKey);
        return project;
      }

      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(legacyStorageKey);
    }

    const response = await fetch(seedUrl);
    if (!response.ok) throw new Error("Не удалось загрузить локальные данные плана.");

    const seed = (await response.json()) as unknown;
    const project = migrateProject(seed);
    if (!project) throw new Error("Не удалось распознать seed-данные проекта.");
    return project;
  },

  async save(project: ExhibitionProject): Promise<void> {
    window.localStorage.setItem(storageKey, JSON.stringify(project, null, 2));
  },
};

function loadJson(key: string): unknown | null {
  const saved = window.localStorage.getItem(key);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as unknown;
  } catch (error) {
    console.warn(`Saved JSON in ${key} is invalid.`, error);
    return null;
  }
}

function migrateProject(value: unknown): ExhibitionProject | null {
  if (isProject(value)) return value;
  if (isLegacyWorkspace(value)) return legacyWorkspaceToProject(value);
  return null;
}

function legacyWorkspaceToProject(workspace: LegacyWorkspace): ExhibitionProject {
  const floorPlans: FloorPlan[] = workspace.plans.map((plan) => ({
    id: plan.id,
    exhibitionId: plan.exhibitionId,
    title: plan.title,
    width: plan.width,
    height: plan.height,
    background: plan.imageUrl
      ? {
          name: plan.title,
          imageUrl: plan.imageUrl,
          width: plan.width,
          height: plan.height,
        }
      : null,
    grid: {
      enabled: true,
      snap: true,
      cellSizePx: plan.gridSizePx,
      metersPerCell: plan.metersPerCell,
    },
  }));

  const layers: ProjectLayer[] = floorPlans.flatMap((plan) =>
    [
      { id: `${plan.id}-background`, floorPlanId: plan.id, kind: "background", name: "Фон", visible: true, locked: false, order: 0 },
      { id: `${plan.id}-passages`, floorPlanId: plan.id, kind: "passages", name: "Проходы", visible: true, locked: false, order: 1 },
      { id: `${plan.id}-columns`, floorPlanId: plan.id, kind: "columns", name: "Колонны", visible: true, locked: false, order: 2 },
      { id: `${plan.id}-walls`, floorPlanId: plan.id, kind: "walls", name: "Стены", visible: true, locked: false, order: 3 },
      { id: `${plan.id}-stands`, floorPlanId: plan.id, kind: "stands", name: "Стенды", visible: true, locked: false, order: 4 },
      { id: `${plan.id}-selection`, floorPlanId: plan.id, kind: "selection", name: "Выделение", visible: true, locked: false, order: 5 },
    ] satisfies ProjectLayer[],
  );

  const objects: CanvasObject[] = workspace.stands.map((stand) => ({
    id: stand.id,
    floorPlanId: stand.planId,
    layerId: `${stand.planId}-stands`,
    kind: "stand",
    name: stand.number,
    shape: {
      kind: "polygon",
      points: stand.points,
    },
    meta: {
      stand: {
        number: stand.number,
        status: stand.status,
        dealId: stand.dealId,
        note: stand.note,
      },
    } satisfies ObjectMeta,
  }));

  return {
    ...createEmptyProject(),
    id: workspace.exhibitions[0]?.id ?? "project-local",
    title: workspace.exhibitions[0]?.title ?? "Выставочный проект",
    exhibitions: workspace.exhibitions,
    floorPlans,
    layers,
    objects,
  };
}

function isProject(value: unknown): value is ExhibitionProject {
  if (!value || typeof value !== "object") return false;
  const project = value as ExhibitionProject;
  return Array.isArray(project.exhibitions) && Array.isArray(project.floorPlans) && Array.isArray(project.layers) && Array.isArray(project.objects) && Boolean(project.settings);
}

function isLegacyWorkspace(value: unknown): value is LegacyWorkspace {
  if (!value || typeof value !== "object") return false;
  const workspace = value as LegacyWorkspace;
  return Array.isArray(workspace.exhibitions) && Array.isArray(workspace.plans) && Array.isArray(workspace.stands);
}
