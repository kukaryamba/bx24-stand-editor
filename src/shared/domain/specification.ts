import { furnitureCategories, getFurnitureItem } from "./furniture";
import { getFloorPlan, getFloorPlanObjects, getObjectFurnitureMeta, getStandSizeMeters } from "./project";
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
  for (const object of objects) {
    const meta = getObjectFurnitureMeta(object);
    if (!meta) continue;
    counts.set(meta.itemId, (counts.get(meta.itemId) ?? 0) + 1);
  }

  const rows: SpecificationRow[] = [];
  let wallLengthM = 0;

  for (const [itemId, quantity] of counts) {
    const item = getFurnitureItem(itemId);
    if (!item) continue;

    const priceRub = item.priceRub;
    rows.push({
      itemId,
      catalogId: item.catalogId,
      title: item.title,
      category: item.category,
      quantity,
      unit: "шт",
      priceRub,
      sumRub: priceRub === undefined ? undefined : priceRub * quantity,
    });

    if (item.category === "walls") {
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

  const size = plan ? getStandSizeMeters(plan) : { width: 0, depth: 0 };
  const areaM2 = round1(size.width * size.depth);
  const perimeterM = round1((size.width + size.depth) * 2);

  const pricedSums = rows.map((row) => row.sumRub).filter((value): value is number => value !== undefined);
  const totalRub = pricedSums.length === rows.length && rows.length > 0 ? pricedSums.reduce((sum, value) => sum + value, 0) : undefined;

  return {
    groups,
    itemsCount: objects.length,
    areaM2,
    perimeterM,
    wallLengthM: round1(wallLengthM),
    totalRub,
    itemsWithoutCatalogId: rows.filter((row) => !row.catalogId).reduce((sum, row) => sum + row.quantity, 0),
  };
}

/** Спецификация в виде текста — чтобы скопировать в письмо или заявку монтажникам. */
export function specificationToText(specification: Specification, standTitle: string): string {
  const lines: string[] = [standTitle, ""];

  lines.push(`Площадь: ${formatNumber(specification.areaM2)} м²`);
  lines.push(`Периметр: ${formatNumber(specification.perimeterM)} м`);
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
