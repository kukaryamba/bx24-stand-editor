import type { CanvasObject, FloorPlan } from "./types";

/**
 * Типовые схемы выставочных стендов.
 *
 * Отличаются тем, с каких сторон стенд закрыт стенами, а с каких открыт
 * для посетителей. Это стандартная классификация: чем больше открытых сторон,
 * тем дороже место и тем меньше нужно стеновых панелей.
 */

export type StandTemplateId = "linear" | "corner" | "peninsula" | "island";

/** Стороны площадки, вдоль которых ставятся стены. */
type Side = "back" | "left" | "right" | "front";

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

/**
 * Строит объекты стен для выбранной схемы.
 * Возвращает готовые объекты холста — их остаётся положить в проект.
 */
export function buildTemplateWalls(
  template: StandTemplate,
  plan: FloorPlan,
  layerId: string,
  createId: (prefix: string) => string,
): CanvasObject[] {
  const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;
  const widthM = plan.width / pxPerMeter;
  const depthM = plan.height / pxPerMeter;
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

  for (const side of template.walls) {
    const horizontal = side === "back" || side === "front";
    const parts = splitSide(horizontal ? widthM : depthM);
    let offset = 0;

    for (const part of parts) {
      if (side === "back") addWall(part.itemId, offset, 0, 0, part.lengthM);
      if (side === "front") addWall(part.itemId, offset, depthM - wallThicknessM, 0, part.lengthM);
      // У повёрнутой панели ширина и глубина меняются местами, поэтому
      // правая стена смещается на свою толщину внутрь площадки.
      if (side === "left") addWall(part.itemId, 0, offset, 90, part.lengthM);
      if (side === "right") addWall(part.itemId, widthM - wallThicknessM, offset, 90, part.lengthM);

      offset = Math.round((offset + part.lengthM) * 10) / 10;
    }
  }

  return objects;
}
