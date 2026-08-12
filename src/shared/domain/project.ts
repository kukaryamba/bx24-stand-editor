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

export function getObjectFurnitureMeta(object: CanvasObject): FurnitureObjectMeta | null {
  return object.kind === "equipment" && object.meta.furniture ? object.meta.furniture : null;
}

export function withPolygonPoints(object: CanvasObject, points: Point[]): CanvasObject {
  return { ...object, shape: { kind: "polygon", points } satisfies PolygonShape };
}
