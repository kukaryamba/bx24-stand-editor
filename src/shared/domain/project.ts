import type {
  CanvasObject,
  ExhibitionProject,
  FloorPlan,
  FurnitureObjectMeta,
  Point,
  PolygonShape,
  ProjectLayer,
  StandObjectMeta,
} from "./types";

export function getFloorPlan(project: ExhibitionProject | null, floorPlanId: string | null): FloorPlan | null {
  if (!project || !floorPlanId) return null;
  return project.floorPlans.find((plan) => plan.id === floorPlanId) ?? null;
}

export function getFloorPlanLayers(project: ExhibitionProject | null, floorPlanId: string | null): ProjectLayer[] {
  if (!project || !floorPlanId) return [];
  return project.layers.filter((layer) => layer.floorPlanId === floorPlanId).sort((left, right) => left.order - right.order);
}

export function getFloorPlanObjects(project: ExhibitionProject | null, floorPlanId: string | null): CanvasObject[] {
  if (!project || !floorPlanId) return [];
  return project.objects.filter((item) => item.floorPlanId === floorPlanId);
}

export function getCanvasObject(project: ExhibitionProject | null, objectId: string | null): CanvasObject | null {
  if (!project || !objectId) return null;
  return project.objects.find((item) => item.id === objectId) ?? null;
}

export function getObjectPoints(object: CanvasObject): Point[] {
  if (object.shape.kind === "polygon") return object.shape.points;

  const { origin, width, height } = object.shape;
  return [
    origin,
    { x: origin.x + width, y: origin.y },
    { x: origin.x + width, y: origin.y + height },
    { x: origin.x, y: origin.y + height },
  ];
}

export function getObjectStandMeta(object: CanvasObject): StandObjectMeta | null {
  return object.kind === "stand" && object.meta.stand ? object.meta.stand : null;
}

/** Идентификатор плана стенда — он в проекте один. */
export const standFloorPlanId = "plan-stand";

/** Размеры площадки стенда по умолчанию, метры. */
export const defaultStandSizeM = { width: 3, depth: 3 };

/** Пиксели на метр для плана стенда: стенд маленький, поэтому клетка крупнее, чем на карте павильона. */
export const standCellSizePx = 60;

export function getFloorPlanKind(plan: FloorPlan | null): "expo" | "stand" {
  return plan?.kind === "stand" ? "stand" : "expo";
}

export function findFloorPlanByKind(project: ExhibitionProject | null, kind: "expo" | "stand"): FloorPlan | null {
  if (!project) return null;
  return project.floorPlans.find((plan) => getFloorPlanKind(plan) === kind) ?? null;
}

/** Создаёт площадку стенда заданных размеров вместе с её слоями. */
export function createStandFloorPlan(
  exhibitionId: string,
  widthM: number = defaultStandSizeM.width,
  depthM: number = defaultStandSizeM.depth,
): { plan: FloorPlan; layers: ProjectLayer[] } {
  const plan: FloorPlan = {
    id: standFloorPlanId,
    exhibitionId,
    title: `Стенд ${formatMeters(widthM)} x ${formatMeters(depthM)} м`,
    kind: "stand",
    width: widthM * standCellSizePx,
    height: depthM * standCellSizePx,
    background: null,
    grid: {
      enabled: true,
      snap: true,
      cellSizePx: standCellSizePx,
      metersPerCell: 1,
    },
  };

  return { plan, layers: createLayersForPlan(plan.id) };
}

export function createLayersForPlan(floorPlanId: string): ProjectLayer[] {
  return [
    { id: `${floorPlanId}-background`, floorPlanId, kind: "background", name: "Фон", visible: true, locked: false, order: 0 },
    { id: `${floorPlanId}-passages`, floorPlanId, kind: "passages", name: "Проходы", visible: true, locked: false, order: 1 },
    { id: `${floorPlanId}-columns`, floorPlanId, kind: "columns", name: "Колонны", visible: true, locked: false, order: 2 },
    { id: `${floorPlanId}-walls`, floorPlanId, kind: "walls", name: "Стены", visible: true, locked: false, order: 3 },
    { id: `${floorPlanId}-stands`, floorPlanId, kind: "stands", name: "Объекты", visible: true, locked: false, order: 4 },
    { id: `${floorPlanId}-selection`, floorPlanId, kind: "selection", name: "Выделение", visible: true, locked: false, order: 5 },
  ];
}

/** Размеры площадки стенда в метрах. */
export function getStandSizeMeters(plan: FloorPlan): { width: number; depth: number } {
  const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;
  return {
    width: round1(plan.width / pxPerMeter),
    depth: round1(plan.height / pxPerMeter),
  };
}

export function formatMeters(value: number): string {
  return String(round1(value)).replace(".", ",");
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getObjectFurnitureMeta(object: CanvasObject): FurnitureObjectMeta | null {
  return object.kind === "equipment" && object.meta.furniture ? object.meta.furniture : null;
}

export function withPolygonPoints(object: CanvasObject, points: Point[]): CanvasObject {
  return { ...object, shape: { kind: "polygon", points } satisfies PolygonShape };
}
