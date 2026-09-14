import { getObjectPoints } from "../domain/project";
import type { CanvasObject, FloorPlan, Point } from "../domain/types";

const epsilon = 0.00001;

export function snapPoint(point: Point, gridSize: number, offset: Point = { x: 0, y: 0 }): Point {
  return {
    x: Math.round((point.x - offset.x) / gridSize) * gridSize + offset.x,
    y: Math.round((point.y - offset.y) / gridSize) * gridSize + offset.y,
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

/**
 * Годится ли контур стенда.
 *
 * Соседние стенды не проверяются: контур, замкнутый поверх соседа, — это
 * просто другой стенд, и решает тот, кто рисует. Раньше наложение запрещалось,
 * и нарисовать стенд рядом с соседом не получалось. Объекты и id оставлены
 * в подписи, чтобы вызовы не менять, если проверку вернут.
 */
export function validateStandPolygon(points: Point[], plan: FloorPlan, _objects: CanvasObject[], _ignoredStandId?: string): string | null {
  if (points.length < 3) return "Нужно минимум 3 вершины.";
  if (!isInsidePlan(points, plan)) return "Стенд выходит за пределы плана.";
  if (hasSelfIntersection(points)) return "Контур стенда самопересекается.";
  return null;
}

/** Габариты полигона — прямоугольник, в который он вписан. */
export function polygonBounds(points: Point[]): { width: number; height: number } {
  if (points.length === 0) return { width: 0, height: 0 };

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

export function flattenPoints(points: Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

/**
 * Накладываются ли площадки друг на друга.
 *
 * Общая стена или общий угол — не наложение: стенды на выставке стоят
 * вплотную, ряд за рядом. Поэтому касание границ не считается, а считается
 * только общая площадь: рёбра пересекаются крест-накрест, или вершина,
 * середина ребра, внутренняя точка одного стенда лежит строго внутри другого.
 * Последние проверки ловят наложения без пересечения рёбер — когда стенд
 * сдвинут вдоль общей линии или совпадает с другим.
 */
function polygonsIntersect(first: Point[], second: Point[]): boolean {
  for (let i = 0; i < first.length; i += 1) {
    const a = first[i];
    const b = first[(i + 1) % first.length];

    for (let j = 0; j < second.length; j += 1) {
      const c = second[j];
      const d = second[(j + 1) % second.length];
      if (segmentsCrossProperly(a, b, c, d)) return true;
    }
  }

  return samplePoints(first).some((point) => strictlyInside(point, second)) || samplePoints(second).some((point) => strictlyInside(point, first));
}

/** Рёбра пересекаются крест-накрест, а не касаются концом или лежат на одной линии. */
function segmentsCrossProperly(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

/** Вершины, середины рёбер и внутренняя точка — чем проверять наложение. */
function samplePoints(polygon: Point[]): Point[] {
  const points = [...polygon];
  for (let i = 0; i < polygon.length; i += 1) {
    const next = polygon[(i + 1) % polygon.length];
    points.push({ x: (polygon[i].x + next.x) / 2, y: (polygon[i].y + next.y) / 2 });
  }

  // Центр тяжести у вогнутого контура бывает снаружи — тогда он не годится.
  const centroid = polygonCentroid(polygon);
  if (strictlyInside(centroid, polygon)) points.push(centroid);
  return points;
}

/** Допуск касания, пиксели плана: координаты с сеткой в дробных пикселях. */
const touchTolerancePx = 0.01;

function strictlyInside(point: Point, polygon: Point[]): boolean {
  for (let i = 0; i < polygon.length; i += 1) {
    if (distanceToSegment(point, polygon[i], polygon[(i + 1) % polygon.length]) <= touchTolerancePx) return false;
  }
  return pointInPolygon(point, polygon);
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
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
