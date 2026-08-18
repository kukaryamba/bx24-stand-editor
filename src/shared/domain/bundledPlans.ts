import type { BackgroundImage, GridSettings } from "./types";

/**
 * Планы павильонов, входящие в состав приложения.
 *
 * Загруженная пользователем картинка хранится в браузере в виде текста и
 * в портал не отправляется — она слишком тяжёлая для настроек приложения.
 * Поэтому у коллег стенды открывались без подложки.
 *
 * План, лежащий в самом приложении, раздаётся по обычной ссылке: она
 * помещается в настройки, и подложку видят все. Масштаб и сдвиг сетки
 * измерены заранее, подбирать их заново не нужно.
 */

export type BundledPlan = {
  id: string;
  title: string;
  description: string;
  background: BackgroundImage;
  grid: Pick<GridSettings, "cellSizePx" | "metersPerCell" | "offsetX" | "offsetY">;
};

export const bundledPlans: BundledPlan[] = [
  {
    id: "cbss-2026",
    title: "ЦБСС 2026",
    description: "ВДНХ, 30 сентября — 2 октября. Зал 123 x 46 м.",
    background: {
      name: "cbss-2026.jpg",
      // Относительный путь: приложение живёт в подкаталоге и в iframe портала.
      imageUrl: "./plans/cbss-2026.jpg",
      width: 3406,
      height: 1274,
    },
    grid: {
      // Измерено по сетке чертежа: 27,68 px по горизонтали и 27,69 по вертикали.
      cellSizePx: 27.69,
      metersPerCell: 1,
      // Картинка обрезана по узлам сетки, поэтому сдвиг нулевой.
      offsetX: 0,
      offsetY: 0,
    },
  },
];
