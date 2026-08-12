import type { FloorPlan } from "../../shared/domain/types";
import { getStage } from "./stageRegistry";

/**
 * Сохраняет план целиком в PNG.
 *
 * Холст показывает только видимую часть плана в текущем масштабе, поэтому перед
 * снимком масштаб и сдвиг временно сбрасываются, а после — возвращаются.
 * Пользователь этого не замечает: между сбросом и возвратом браузер не перерисовывает.
 */
export function exportPlanToPng(plan: FloorPlan, pixelRatio = 2): void {
  const stage = getStage();
  if (!stage) throw new Error("Холст ещё не готов.");

  const saved = {
    scale: stage.scaleX(),
    x: stage.x(),
    y: stage.y(),
    width: stage.width(),
    height: stage.height(),
  };

  try {
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.size({ width: plan.width, height: plan.height });
    stage.draw();

    const dataUrl = stage.toDataURL({
      mimeType: "image/png",
      pixelRatio,
      x: 0,
      y: 0,
      width: plan.width,
      height: plan.height,
    });

    downloadDataUrl(dataUrl, `${sanitizeFileName(plan.title)}.png`);
  } finally {
    stage.scale({ x: saved.scale, y: saved.scale });
    stage.position({ x: saved.x, y: saved.y });
    stage.size({ width: saved.width, height: saved.height });
    stage.draw();
  }
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
