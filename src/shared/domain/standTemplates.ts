import type { CanvasObject, FloorPlan, Point } from "./types";

/**
 * Типовые схемы выставочных стендов.
 *
 * Отличаются тем, с каких сторон стенд закрыт стенами, а с каких открыт
 * для посетителей. Это стандартная классификация: чем больше открытых сторон,
 * тем дороже место и тем меньше нужно стеновых панелей.
 */

export type StandTemplateId = "linear" | "corner" | "peninsula" | "island";

/** Стороны площадки, вдоль которых ставятся стены. */
export type Side = "back" | "left" | "right" | "front";

export type StandTemplate = {
  id: StandTemplateId;
  title: string;
  description: string;
  walls: Side[];
};

export const standTemplates: StandTemplate[] = [
  {
    id: "linear",
    title: "Линейный",
    description: "Открыт спереди, стены с трёх сторон",
    walls: ["back", "left", "right"],
  },
  {
    id: "corner",
    title: "Угловой",
    description: "Открыт с двух смежных сторон",
    walls: ["back", "left"],
  },
  {
    id: "peninsula",
    title: "Полуостров",
    description: "Открыт с трёх сторон, стена сзади",
    walls: ["back"],
  },
  {
    id: "island",
    title: "Остров",
    description: "Открыт со всех сторон, без стен",
    walls: [],
  },
];

/** Стороны по часовой стрелке, если смотреть на план сверху. */
const clockwise: Side[] = ["back", "right", "front", "left"];

/**
 * Схема, повёрнутая на turns четвертей оборота по часовой стрелке.
 * Стенд на выставке бывает открыт в любую сторону — к проходу, а не
 * обязательно вниз по плану.
 */
export function rotateTemplate(template: StandTemplate, turns: number): StandTemplate {
  const walls = template.walls.map((side) => clockwise[(clockwise.indexOf(side) + turns) % clockwise.length]);
  return { ...template, walls };
}

/**
 * Сколько разных расстановок даёт поворот. Остров без стен одинаков
 * при любом повороте; у остальных схем стены несимметричны — четыре.
 */
export function templateVariants(template: StandTemplate): number {
  return template.walls.length === 0 ? 1 : clockwise.length;
}

const sideNames: Record<Side, string> = { back: "сзади", right: "справа", front: "спереди", left: "слева" };

/** Где стены у повёрнутой схемы — словами, по порядку обхода. */
export function describeWalls(template: StandTemplate): string {
  const sides = clockwise.filter((side) => template.walls.includes(side));
  return sides.length ? `Стены ${sides.map((side) => sideNames[side]).join(", ")}` : "Без стен";
}

/** Толщина стеновой панели, метры — как у элемента стены в каталоге. */
const wallThicknessM = 0.1;

/**
 * Раскладывает сторону длиной lengthM на панели по 1 м, добирая остаток
 * половинками. Так же комплектуют стенд в жизни: целые панели плюс доборы.
 */
function splitSide(lengthM: number): Array<{ itemId: string; lengthM: number }> {
  const parts: Array<{ itemId: string; lengthM: number }> = [];
  let left = Math.round(lengthM * 10) / 10;

  while (left >= 1) {
    parts.push({ itemId: "wall_1", lengthM: 1 });
    left = Math.round((left - 1) * 10) / 10;
  }

  if (left >= 0.5) {
    parts.push({ itemId: "wall_05", lengthM: 0.5 });
    left = Math.round((left - 0.5) * 10) / 10;
  }

  // Остаток меньше половины панели закрывать нечем — округляем вниз,
  // монтажники подрезают по месту.
  return parts;
}

/** Прямая сторона площадки в пикселях: откуда, докуда и куда смотрит наружу. */
export type PlanEdge = { side: Side; from: number; to: number; at: number };

/**
 * Стороны площадки. У прямоугольной — четыре. У стенда сложной формы —
 * стороны его контура: каждая относится к той стороне света, куда смотрит
 * наружу (вверх — задняя, вниз — передняя). Косые стороны пропускаются:
 * прямыми панелями их не закрыть.
 *
 * from/to — отрезок вдоль стороны, at — её положение поперёк (y у
 * горизонтальной, x у вертикальной).
 */
export function planEdges(plan: FloorPlan, outline?: Point[] | null): PlanEdge[] {
  if (!outline || outline.length < 3) {
    return [
      { side: "back", from: 0, to: plan.width, at: 0 },
      { side: "front", from: 0, to: plan.width, at: plan.height },
      { side: "left", from: 0, to: plan.height, at: 0 },
      { side: "right", from: 0, to: plan.height, at: plan.width },
    ];
  }

  const edges: PlanEdge[] = [];
  const tolerance = 0.5;
  outline.forEach((a, index) => {
    const b = outline[(index + 1) % outline.length];
    const horizontal = Math.abs(a.y - b.y) < tolerance;
    const vertical = Math.abs(a.x - b.x) < tolerance;
    if (horizontal === vertical) return;

    // Наружу — та сторона, где рядом с серединой стороны уже не стенд.
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (horizontal) {
      const aboveInside = insidePolygon({ x: mid.x, y: mid.y - 1 }, outline);
      edges.push({ side: aboveInside ? "front" : "back", from: Math.min(a.x, b.x), to: Math.max(a.x, b.x), at: a.y });
    } else {
      const leftInside = insidePolygon({ x: mid.x - 1, y: mid.y }, outline);
      edges.push({ side: leftInside ? "right" : "left", from: Math.min(a.y, b.y), to: Math.max(a.y, b.y), at: a.x });
    }
  });
  return edges;
}

function insidePolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i];
    const previous = polygon[j];
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Строит объекты стен для выбранной схемы.
 * Возвращает готовые объекты холста — их остаётся положить в проект.
 *
 * outline — контур непрямоугольного стенда: тогда стены идут по его сторонам,
 * а не по габаритному прямоугольнику площадки.
 */
export function buildTemplateWalls(
  template: StandTemplate,
  plan: FloorPlan,
  layerId: string,
  createId: (prefix: string) => string,
  outline?: Point[] | null,
): CanvasObject[] {
  const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;
  const objects: CanvasObject[] = [];

  const addWall = (itemId: string, xM: number, yM: number, rotation: number, lengthM: number) => {
    objects.push({
      id: createId("wall"),
      floorPlanId: plan.id,
      layerId,
      kind: "equipment",
      name: lengthM === 1 ? "Элемент стены 1 x 2,5 м" : "Элемент стены 0,5 x 2,5 м",
      shape: {
        kind: "rectangle",
        origin: { x: xM * pxPerMeter, y: yM * pxPerMeter },
        width: lengthM * pxPerMeter,
        height: wallThicknessM * pxPerMeter,
      },
      meta: { furniture: { itemId, rotation } },
    });
  };

  for (const edge of planEdges(plan, outline)) {
    if (!template.walls.includes(edge.side)) continue;

    const startM = edge.from / pxPerMeter;
    const atM = edge.at / pxPerMeter;
    let offset = 0;

    for (const part of splitSide((edge.to - edge.from) / pxPerMeter)) {
      const along = Math.round((startM + offset) * 100) / 100;
      // Панель всегда внутри стенда: у задней и левой стороны — от линии внутрь,
      // у передней и правой — на свою толщину от линии.
      if (edge.side === "back") addWall(part.itemId, along, atM, 0, part.lengthM);
      if (edge.side === "front") addWall(part.itemId, along, atM - wallThicknessM, 0, part.lengthM);
      // У повёрнутой панели ширина и глубина меняются местами.
      if (edge.side === "left") addWall(part.itemId, atM, along, 90, part.lengthM);
      if (edge.side === "right") addWall(part.itemId, atM - wallThicknessM, along, 90, part.lengthM);

      offset = Math.round((offset + part.lengthM) * 10) / 10;
    }
  }

  return objects;
}
