import { getObjectFurnitureMeta, getObjectPoints } from "../../shared/domain/project";
import type { CanvasObject, FloorPlan } from "../../shared/domain/types";
import { getStage } from "./stageRegistry";

/**
 * Сохраняет план целиком в PNG.
 *
 * Холст показывает только видимую часть плана в текущем масштабе, поэтому перед
 * снимком масштаб и сдвиг временно сбрасываются, а после — возвращаются.
 * Пользователь этого не замечает: между сбросом и возвратом браузер не перерисовывает.
 */
export function exportPlanToPng(plan: FloorPlan, objects: CanvasObject[] = [], pixelRatio = 2): void {
  downloadDataUrl(renderPlanToDataUrl(plan, objects, pixelRatio), `${sanitizeFileName(plan.title)}.png`);
}

/** Поля вокруг снимка, чтобы вынесенная наружу панель не касалась края. */
const snapshotMargin = 12;

/**
 * Снимок плана целиком — для паспорта стенда и других печатных форм.
 *
 * В кадр попадает не только площадка, но и всё, что стоит за её границей:
 * фриз и оклейку вешают над проходом, снаружи стенда, и без этого они
 * пропадали бы из паспорта.
 */
export function renderPlanToDataUrl(plan: FloorPlan, objects: CanvasObject[] = [], pixelRatio = 2): string {
  const stage = getStage();
  if (!stage) throw new Error("Холст ещё не готов.");

  const bounds = contentBounds(plan, objects);

  const saved = {
    scale: stage.scaleX(),
    x: stage.x(),
    y: stage.y(),
    width: stage.width(),
    height: stage.height(),
  };

  try {
    stage.scale({ x: 1, y: 1 });
    // Сдвигаем сцену, чтобы левый верхний угол кадра оказался в нуле:
    // вынесенный наружу предмет может стоять в отрицательных координатах.
    stage.position({ x: -bounds.x, y: -bounds.y });
    stage.size({ width: bounds.width, height: bounds.height });
    stage.draw();

    return stage.toDataURL({
      mimeType: "image/png",
      pixelRatio,
      x: 0,
      y: 0,
      width: bounds.width,
      height: bounds.height,
    });
  } finally {
    stage.scale({ x: saved.scale, y: saved.scale });
    stage.position({ x: saved.x, y: saved.y });
    stage.size({ width: saved.width, height: saved.height });
    stage.draw();
  }
}

/** Прямоугольник, в который помещаются площадка и все её предметы. */
function contentBounds(plan: FloorPlan, objects: CanvasObject[]): { x: number; y: number; width: number; height: number } {
  let minX = 0;
  let minY = 0;
  let maxX = plan.width;
  let maxY = plan.height;

  for (const object of objects) {
    if (object.floorPlanId !== plan.id) continue;

    if (object.shape.kind === "rectangle") {
      const meta = getObjectFurnitureMeta(object);
      const rotated = meta?.rotation === 90 || meta?.rotation === 270;
      // При повороте на четверть оборота рамка предмета меняет ширину и высоту местами.
      const width = rotated ? object.shape.height : object.shape.width;
      const height = rotated ? object.shape.width : object.shape.height;

      minX = Math.min(minX, object.shape.origin.x);
      minY = Math.min(minY, object.shape.origin.y);
      maxX = Math.max(maxX, object.shape.origin.x + width);
      maxY = Math.max(maxY, object.shape.origin.y + height);
      continue;
    }

    for (const point of getObjectPoints(object)) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  const expanded = minX < 0 || minY < 0 || maxX > plan.width || maxY > plan.height;
  const margin = expanded ? snapshotMargin : 0;

  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + margin * 2,
    height: maxY - minY + margin * 2,
  };
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "План";
}
