import { getFurnitureItem } from "./furniture";
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

/** Идентификатор площадки для конкретного стенда. */
export function standPlanIdFor(standObjectId: string): string {
  return `plan-stand-${standObjectId}`;
}

/** Площадка выбранного стенда, если она уже заведена. */
export function findStandPlan(project: ExhibitionProject | null, standObjectId: string): FloorPlan | null {
  if (!project) return null;
  return project.floorPlans.find((plan) => plan.standObjectId === standObjectId) ?? null;
}

/**
 * Стена ли это.
 *
 * Стены обязаны идти по рёбрам клеток: по ним считают погонные метры панелей,
 * и стык между двумя панелями не должен попадать в середину клетки. Остальная
 * мебель ставится свободно — стол посреди клетки никому не мешает.
 */
export function isWallObject(object: CanvasObject): boolean {
  const meta = getObjectFurnitureMeta(object);
  if (!meta) return false;

  return getFurnitureItem(meta.itemId)?.category === "walls";
}

/** Сколько знаков помещается на фризовой панели — ограничение прайса. */
export const friezeMaxChars = 15;

/**
 * Надпись фриза, разделённая на то, что помещается, и лишнее.
 * Лишнее показывают красным, а не обрезают: так видно, сколько сократить.
 */
export function splitFriezeLabel(label: string): { fits: string; extra: string } {
  // Array.from, а не slice: иначе составные символы вроде эмодзи рвались бы пополам.
  const chars = Array.from(label);
  return { fits: chars.slice(0, friezeMaxChars).join(""), extra: chars.slice(friezeMaxChars).join("") };
}

/**
 * Растягиваемые полосы с надписью: фриз и оклейка. Устроены одинаково —
 * тянутся в длину, надпись не растягивается, ставятся и снаружи стенда.
 */
export type StripKind = "frieze" | "film";

export function stripKindOf(object: CanvasObject): StripKind | null {
  const meta = getObjectFurnitureMeta(object);
  if (!meta) return null;

  const item = getFurnitureItem(meta.itemId);
  if (item?.frieze) return "frieze";
  if (item?.film) return "film";
  return null;
}

/** Фризовая панель — растягивается в длину и несёт надпись. */
export function isFriezeObject(object: CanvasObject): boolean {
  return stripKindOf(object) === "frieze";
}

/**
 * Стенд, закреплённый за сделкой.
 *
 * Приложение открывается из карточки сделки, и показывать оно должно стенд
 * именно этой сделки, а не первый попавшийся.
 */
export function findStandByDeal(project: ExhibitionProject | null, dealId: string | null): CanvasObject | null {
  if (!project || !dealId) return null;

  return (
    project.objects.find((object) => object.kind === "stand" && getObjectStandMeta(object)?.dealId === dealId) ?? null
  );
}

/** Все заведённые площадки стендов. */
export function getStandPlans(project: ExhibitionProject | null): FloorPlan[] {
  if (!project) return [];
  return project.floorPlans.filter((plan) => getFloorPlanKind(plan) === "stand");
}

/** Заголовок площадки стенда: номер и площадь. Один на создание, изменение размера и смену номера. */
export function standPlanTitle(standNumber: string | null, widthM: number, depthM: number): string {
  const size = `${formatMeters(widthM * depthM)} м²`;
  return standNumber ? `Стенд ${standNumber} — ${size}` : `Стенд ${size}`;
}

/** Создаёт площадку конкретного стенда вместе с её слоями. */
export function createStandFloorPlan(
  exhibitionId: string,
  standObjectId: string,
  standNumber: string,
  widthM: number = defaultStandSizeM.width,
  depthM: number = defaultStandSizeM.depth,
): { plan: FloorPlan; layers: ProjectLayer[] } {
  const plan: FloorPlan = {
    id: standPlanIdFor(standObjectId),
    exhibitionId,
    title: standPlanTitle(standNumber, widthM, depthM),
    kind: "stand",
    standObjectId,
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

/**
 * Настоящий контур стенда на его площадке, в пикселях площадки.
 *
 * Площадка строится прямоугольником по габаритам стенда, а сам стенд на карте
 * бывает любой формы — Г-образный, с вырезом. Контур берётся с карты и
 * растягивается на площадку, поэтому всегда совпадает с нарисованным.
 * Для обычного прямоугольного стенда — null: контур и есть вся площадка.
 */
export function getStandOutline(project: ExhibitionProject | null, plan: FloorPlan | null): Point[] | null {
  if (!project || !plan?.standObjectId) return null;
  const stand = getCanvasObject(project, plan.standObjectId);
  if (!stand || stand.kind !== "stand") return null;

  const points = getObjectPoints(stand);
  if (points.length < 3) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  if (width <= 0 || height <= 0) return null;

  const tolerance = Math.max(width, height) * 0.001;
  const onCorner = (point: Point) =>
    (Math.abs(point.x - minX) < tolerance || Math.abs(point.x - minX - width) < tolerance) &&
    (Math.abs(point.y - minY) < tolerance || Math.abs(point.y - minY - height) < tolerance);
  if (points.length === 4 && points.every(onCorner)) return null;

  // Площадку могли развернуть: контур поворачиваем так же, на четверти против часовой.
  const turns = (((plan.turns ?? 0) % 4) + 4) % 4;
  return points.map((point) => {
    let u = (point.x - minX) / width;
    let v = (point.y - minY) / height;
    for (let i = 0; i < turns; i += 1) [u, v] = [v, 1 - u];
    return { x: u * plan.width, y: v * plan.height };
  });
}

/** Площадь стенда, м²: по настоящему контуру, если стенд не прямоугольный. */
export function getStandAreaM2(project: ExhibitionProject | null, plan: FloorPlan): number {
  const size = getStandSizeMeters(plan);
  const outline = getStandOutline(project, plan);
  if (!outline) return round1(size.width * size.depth);

  const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;
  const doubled = outline.reduce((sum, point, index) => {
    const next = outline[(index + 1) % outline.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0);
  return round1(Math.abs(doubled) / 2 / (pxPerMeter * pxPerMeter));
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
