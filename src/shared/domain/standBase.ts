import { buildTemplateWalls, planEdges, standTemplates } from "./standTemplates";
import { getFurnitureItem } from "./furniture";
import type { CanvasObject, FloorPlan, Point } from "./types";

/**
 * Базовая комплектация стенда «Стандарт».
 *
 * У каждого стенда есть набор, который входит в застройку и зависит только
 * от площади, — таблица из прайса. Допы к нему добавляют руками. Поэтому
 * новая площадка сразу получает базу, расставленную как на схеме прайса:
 * стены сзади и по бокам, фриз над открытой стороной, вешалка на левой стене,
 * стул у задней стены, стол посередине, корзина в дальнем правом углу.
 *
 * Сзади — верх плана, открытая сторона — низ.
 */

/** Позиции таблицы. Порядок колонок: 4–5, 6–8, 9–11, 12–14, 15–17, 18–20 м². */
const baseTable: Record<string, number[]> = {
  "stol-70x70": [1, 1, 1, 1, 1, 2],
  "stul-polumyagkiy": [1, 1, 2, 3, 4, 4],
  "spot-bra": [1, 1, 2, 3, 4, 4],
  "rozetki-1kvt": [0, 0, 0, 1, 1, 1],
  "veshalka-nastennaya": [1, 1, 1, 1, 1, 1],
  korzina: [1, 1, 1, 1, 1, 1],
  // Комната переговоров: стены 1 м, дверь, стена с занавеской.
  "stena-10": [0, 0, 0, 1, 1, 2],
  "dver-razdvizhnaya": [0, 0, 0, 0, 1, 1],
  "stena-zanaveska": [0, 0, 0, 1, 0, 0],
};

/**
 * Колонка таблицы по площади. Между колонками в прайсе дыры (5,5 м², 8,5 м²) —
 * такая площадь идёт в меньшую колонку. Меньше 4 и больше 20 — крайние.
 */
function baseColumn(areaM2: number): number {
  const upper = [6, 9, 12, 15, 18];
  const index = upper.findIndex((limit) => areaM2 < limit);
  return index === -1 ? upper.length : index;
}

/**
 * Больше этой площади базы нет: у больших стендов мебель и свет — всё по счёту.
 * Стены и фриз остаются: это застройка, а не комплектация.
 */
export const baseMaxAreaM2 = 20;

/** Сколько штук позиции входит в базу стенда такой площади. */
export function baseQuantity(itemId: string, areaM2: number): number {
  if (areaM2 > baseMaxAreaM2 + 1e-6) return 0;
  return baseTable[itemId]?.[baseColumn(areaM2)] ?? 0;
}

/** Цвет ковра по умолчанию у всех стендов «Стандарт». Меняется в анкете паспорта. */
export const baseCarpetColor = "Серый";

/**
 * Заливка площадки на плане по цвету ковра из анкеты — бледная, чтобы предметы
 * читались. Цвет пишут словом, поэтому узнаём по началу слова; незнакомый —
 * серый, как ковёр по умолчанию.
 */
export function carpetFill(color: string | undefined): string {
  const name = (color || baseCarpetColor).trim().toLowerCase().replace("ё", "е");
  const fills: Array<[string, string]> = [
    ["син", "#dfe8f7"],
    ["голуб", "#e2f0f8"],
    ["красн", "#f7e0e0"],
    ["бордо", "#f0dde2"],
    ["зелен", "#e1f1e4"],
    ["беж", "#f3ece0"],
    ["коричн", "#ece3da"],
    ["черн", "#d9dbdf"],
    ["желт", "#f8f2d8"],
    ["оранж", "#f9e8d6"],
    ["фиолет", "#ebe2f3"],
  ];
  return fills.find(([prefix]) => name.startsWith(prefix))?.[1] ?? "#e9ebee";
}

/** Толщина стеновой панели, метры — как у стен схемы. */
const wall = 0.1;
/** Зазор между предметами, метры. */
const gap = 0.05;

/** areaM2 — настоящая площадь стенда, если он не прямоугольный: по ней выбирается колонка таблицы. */
/** outline — контур непрямоугольного стенда: стены и фриз идут по его сторонам. */
export function buildBaseObjects(
  plan: FloorPlan,
  layerId: string,
  createId: (prefix: string) => string,
  areaM2?: number,
  outline?: Point[] | null,
): CanvasObject[] {
  const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;
  const W = plan.width / pxPerMeter;
  const D = plan.height / pxPerMeter;
  const area = areaM2 ?? W * D;
  const qty = (itemId: string) => baseQuantity(itemId, area);

  const linear = standTemplates.find((template) => template.id === "linear");
  const objects: CanvasObject[] = linear ? buildTemplateWalls(linear, plan, layerId, createId, outline) : [];

  /** Кладёт предмет левым верхним углом в точку (метры). Повёрнутый на 90° лежит вдоль стены. */
  const put = (itemId: string, x: number, y: number, rotation = 0, lengthM?: number) => {
    const item = getFurnitureItem(itemId);
    if (!item) return;
    objects.push({
      id: createId("furniture"),
      floorPlanId: plan.id,
      layerId,
      kind: "equipment",
      name: item.title,
      shape: {
        kind: "rectangle",
        origin: { x: x * pxPerMeter, y: y * pxPerMeter },
        width: (lengthM ?? item.widthM) * pxPerMeter,
        height: item.depthM * pxPerMeter,
      },
      meta: { furniture: { itemId: item.id, rotation } },
    });
  };

  // Фриз — над каждой открытой передней стороной, по её длине, вплотную к краю.
  // У прямоугольного стенда передняя сторона одна — во всю ширину.
  for (const edge of planEdges(plan, outline)) {
    if (edge.side !== "front") continue;
    put("friz-panel", edge.from / pxPerMeter, edge.at / pxPerMeter - 0.3, 0, (edge.to - edge.from) / pxPerMeter);
  }

  // Комната переговоров — в правом заднем углу: перегородка в метре от задней
  // стены, от правой стены к центру. Дверь или занавеска ближе к центру.
  const roomParts = [
    ...Array.from({ length: qty("stena-10") }, () => "stena-10"),
    ...Array.from({ length: qty("stena-zanaveska") }, () => "stena-zanaveska"),
    ...Array.from({ length: qty("dver-razdvizhnaya") }, () => "dver-razdvizhnaya"),
  ];
  const roomWidth = Math.min(roomParts.length, Math.max(0, W - 2 * wall - 1.5));
  let partX = W - wall;
  for (const part of roomParts.slice(0, Math.floor(roomWidth))) {
    partX -= 1;
    put(part, partX, 1, 0);
  }
  const hasRoom = roomWidth >= 1;
  const roomDepth = hasRoom ? 1 + 0.2 : 0;

  // Рабочая зона — всё, что левее комнаты переговоров.
  const zoneRight = hasRoom ? partX : W - wall;
  const zoneCenter = (wall + zoneRight) / 2;

  // Вешалка — на левой стене у задней.
  if (qty("veshalka-nastennaya")) put("veshalka-nastennaya", wall, wall + 0.3, 90);

  // Корзина — в дальнем правом углу рабочей зоны.
  if (qty("korzina")) put("korzina", zoneRight - 0.3 - gap, wall + gap);

  // Стол посередине рабочей зоны, стулья вокруг: первый — у задней стены,
  // дальше слева, справа и спереди от стола.
  const tables = qty("stol-70x70");
  const chairs = qty("stul-polumyagkiy");
  const tableTop = Math.max(wall + 0.5 + 2 * gap, Math.min(D / 2 - 0.35, D - 0.3 - 0.7 - 0.5 - gap));
  const tableX = zoneCenter - 0.35;
  const mainSeats: Array<[number, number]> = [
    [tableX + 0.1, tableTop - 0.5 - gap], // у задней стены
    [tableX - 0.5 - gap, tableTop + 0.1], // слева
    [tableX + 0.7 + gap, tableTop + 0.1], // справа
    [tableX + 0.1, tableTop + 0.7 + gap], // спереди
  ];
  if (tables > 0) put("stol-70x70", tableX, tableTop);

  // Второй стол — в комнату переговоров, со стульями по бокам: в рабочей зоне
  // рядом с комнатой два стола в ряд не помещаются.
  let seats = mainSeats;
  if (tables > 1 && hasRoom) {
    const roomX = (partX + W - wall) / 2 - 0.35;
    const roomY = wall + (1 - wall - 0.7) / 2;
    put("stol-70x70", roomX, roomY);
    const roomSeats: Array<[number, number]> = [
      [roomX - 0.5 - gap, roomY + 0.1],
      [roomX + 0.7 + gap, roomY + 0.1],
    ];
    // Сначала по два стула к каждому столу.
    seats = [mainSeats[0], mainSeats[1], ...roomSeats, mainSeats[2], mainSeats[3]];
  }
  seats.slice(0, chairs).forEach(([x, y]) => put("stul-polumyagkiy", x, y));

  // Споты — на фризе, светят внутрь стенда, поровну по ширине.
  // На задней стене они легли бы на стул.
  const spots = qty("spot-bra");
  for (let index = 0; index < spots; index += 1) {
    const step = W / spots;
    put("spot-bra", step * (index + 0.5) - 0.1, D - 0.3 - 0.2);
  }

  // Розетки — на задней стене в комнате переговоров, если она есть, иначе у правой стены.
  if (qty("rozetki-1kvt")) put("rozetki-1kvt", W - wall - 0.2 - gap, hasRoom ? roomDepth - 0.4 : wall + 0.5);

  return objects;
}
