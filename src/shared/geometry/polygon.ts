import { getObjectPoints } from "../domain/project";
import type { CanvasObject, FloorPlan, Point } from "../domain/types";

const epsilon = 0.00001;

export function snapPoint(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function polygonArea(points: Point[], metersPerCell: number, gridSizePx: number): number {
  if (points.length < 3) return 0;
  const pixelArea = Math.abs(shoelace(points));
  const metersPerPixel = metersPerCell / gridSizePx;
  return round(pixelArea * metersPerPixel * metersPerPixel, 2);
}

export function polygonCentroid(points: Point[]): Point {
  const fallback = points[0] ?? { x: 0, y: 0 };
  if (points.length < 3) return fallback;

  let factorSum = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const factor = current.x * next.y - next.x * current.y;
    factorSum += factor;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }

  if (Math.abs(factorSum) < epsilon) return fallback;
  return { x: x / (3 * factorSum), y: y / (3 * factorSum) };
}

export function isInsidePlan(points: Point[], plan: FloorPlan): boolean {
  return points.every((point) => point.x >= 0 && point.y >= 0 && point.x <= plan.width && point.y <= plan.height);
}

export function hasSelfIntersection(points: Point[]): boolean {
  if (points.length < 4) return false;

  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];

    for (let j = i + 1; j < points.length; j += 1) {
      const c = points[j];
      const d = points[(j + 1) % points.length];
      const adjacent = Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 1);
      if (!adjacent && segmentsIntersect(a, b, c, d)) return true;
    }
  }

  return false;
}

export function intersectsAnyStand(points: Point[], objects: CanvasObject[], ignoredStandId?: string): boolean {
  return objects.some((object) => {
    if (object.id === ignoredStandId || object.kind !== "stand") return false;
    return polygonsIntersect(points, getObjectPoints(object));
  });
}

export function validateStandPolygon(points: Point[], plan: FloorPlan, objects: CanvasObject[], ignoredStandId?: string): string | null {
  if (points.length < 3) return "Нужно минимум 3 вершины.";
  if (!isInsidePlan(points, plan)) return "Стенд выходит за пределы плана.";
  if (hasSelfIntersection(points)) return "Контур стенда самопересекается.";
  if (intersectsAnyStand(points, objects, ignoredStandId)) return "Стенд пересекается с существующим стендом.";
  return null;
}

export function flattenPoints(points: Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

function polygonsIntersect(first: Point[], second: Point[]): boolean {
  for (let i = 0; i < first.length; i += 1) {
    const a = first[i];
    const b = first[(i + 1) % first.length];

    for (let j = 0; j < second.length; j += 1) {
      const c = second[j];
      const d = second[(j + 1) % second.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }

  return pointInPolygon(first[0], second) || pointInPolygon(second[0], first);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;

  return false;
}

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < epsilon) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return b.x <= Math.max(a.x, c.x) + epsilon && b.x + epsilon >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) + epsilon && b.y + epsilon >= Math.min(a.y, c.y);
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i];
    const previous = polygon[j];
    const crosses = current.y > point.y !== previous.y > point.y && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function shoelace(points: Point[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function round(value: number, decimals: number): number {
  const power = 10 ** decimals;
  return Math.round(value * power) / power;
}
