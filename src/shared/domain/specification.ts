import { furnitureCategories, getFurnitureItem } from "./furniture";
import { getFloorPlan, getFloorPlanObjects, getObjectFurnitureMeta, getStandAreaM2 } from "./project";
import type { ExhibitionProject, Specification, SpecificationGroup, SpecificationRow } from "./types";

/**
 * Собирает перечень того, что стоит на плане стенда.
 *
 * Повторяет логику старого specification.php: предметы группируются по позиции
 * каталога и типу, отдельно считаются площадь и периметр стенда — по ним
 * заказывается ковролин и стеновые панели.
 *
 * Цены пока не заполнены ни у одной позиции: они лежат в каталоге Битрикс24.
 * Поэтому суммы не считаются, а не подставляются нулями.
 */
export function buildSpecification(project: ExhibitionProject | null, floorPlanId: string | null): Specification {
  const plan = getFloorPlan(project, floorPlanId);
  const objects = getFloorPlanObjects(project, floorPlanId).filter((object) => object.kind === "equipment");

  const counts = new Map<string, number>();
  // Фриз и оклейка растягиваются, поэтому их считаем не штуками, а настоящей длиной.
  const pxPerMeter = plan ? plan.grid.cellSizePx / plan.grid.metersPerCell : 1;
  let friezeLengthM = 0;
  let filmLengthM = 0;
  // Ковёр — по настоящей площади каждого прямоугольника.
  const carpetAreaM2 = new Map<string, number>();

  for (const object of objects) {
    const meta = getObjectFurnitureMeta(object);
    if (!meta) continue;
    counts.set(meta.itemId, (counts.get(meta.itemId) ?? 0) + 1);

    const item = getFurnitureItem(meta.itemId);
    if (object.shape.kind !== "rectangle") continue;
    if (item?.frieze) friezeLengthM += object.shape.width / pxPerMeter;
    if (item?.film) filmLengthM += object.shape.width / pxPerMeter;
    if (item?.carpet) {
      const area = (object.shape.width / pxPerMeter) * (object.shape.height / pxPerMeter);
      carpetAreaM2.set(meta.itemId, (carpetAreaM2.get(meta.itemId) ?? 0) + area);
    }
  }

  const rows: SpecificationRow[] = [];
  let wallLengthM = 0;

  for (const [itemId, count] of counts) {
    const item = getFurnitureItem(itemId);
    if (!item) continue;

    // Фриз и оклейку заказывают погонными метрами, остальное — штуками.
    const quantity = item.frieze
      ? round1(friezeLengthM)
      : item.film
        ? round1(filmLengthM)
        : item.carpet
          ? round1(carpetAreaM2.get(itemId) ?? 0)
          : count;
    const priceRub = item.priceRub;
    rows.push({
      itemId,
      catalogId: item.catalogId,
      title: item.title,
      category: item.category,
      quantity,
      unit: item.frieze || item.film ? "м" : item.carpet ? "м²" : "шт",
      priceRub,
      sumRub: priceRub === undefined ? undefined : priceRub * quantity,
    });

    if (item.frieze || item.film) {
      // Длина полос уже посчитана по объектам, к стенам их не добавляем.
    } else if (item.category === "walls") {
      // У стеновых панелей длина — это их ширина по плану.
      wallLengthM += item.widthM * quantity;
    }
  }

  const groups: SpecificationGroup[] = furnitureCategories
    .map((category) => ({
      category: category.id,
      title: category.title,
      rows: rows.filter((row) => row.category === category.id).sort((left, right) => left.title.localeCompare(right.title, "ru")),
    }))
    .filter((group) => group.rows.length > 0);

  // По настоящему контуру: у изогнутого стенда площадь меньше габаритного прямоугольника.
  const areaM2 = plan ? getStandAreaM2(project, plan) : 0;

  const pricedSums = rows.map((row) => row.sumRub).filter((value): value is number => value !== undefined);
  const totalRub = pricedSums.length === rows.length && rows.length > 0 ? pricedSums.reduce((sum, value) => sum + value, 0) : undefined;

  return {
    groups,
    itemsCount: objects.length,
    areaM2,
    wallLengthM: round1(wallLengthM),
    friezeLengthM: round1(friezeLengthM),
    filmLengthM: round1(filmLengthM),
    totalRub,
    itemsWithoutCatalogId: rows.filter((row) => !row.catalogId).reduce((sum, row) => sum + row.quantity, 0),
  };
}

/** Спецификация в виде текста — чтобы скопировать в письмо или заявку монтажникам. */
export function specificationToText(specification: Specification, standTitle: string): string {
  const lines: string[] = [standTitle, ""];

  lines.push(`Площадь: ${formatNumber(specification.areaM2)} м²`);
  if (specification.friezeLengthM > 0) {
    lines.push(`Фризовые панели: ${formatNumber(specification.friezeLengthM)} м`);
  }
  if (specification.filmLengthM > 0) {
    lines.push(`Оклейка плёнкой: ${formatNumber(specification.filmLengthM)} м`);
  }
  if (specification.wallLengthM > 0) {
    lines.push(`Стеновые панели: ${formatNumber(specification.wallLengthM)} м`);
  }
  lines.push("");

  for (const group of specification.groups) {
    lines.push(group.title.toUpperCase());
    for (const row of group.rows) {
      const article = row.catalogId ? ` (арт. ${row.catalogId})` : "";
      lines.push(`  ${row.title}${article} — ${row.quantity} ${row.unit}`);
    }
    lines.push("");
  }

  lines.push(`Всего предметов: ${specification.itemsCount}`);
  return lines.join("\n");
}

export function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
