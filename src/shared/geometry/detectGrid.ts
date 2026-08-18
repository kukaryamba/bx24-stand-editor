/**
 * Определение шага сетки по картинке плана.
 *
 * Планы павильонов чертят по сетке, и её линии на картинке повторяются
 * с постоянным шагом. Находим этот шаг — и получаем масштаб: сколько
 * пикселей приходится на одну клетку чертежа.
 *
 * Работает в два приёма: сначала автокорреляция профиля яркости находит
 * период примерно, затем шаг уточняется по положениям самих линий методом
 * наименьших квадратов — иначе ошибка в полпикселя на клетке за сотню
 * клеток превращается в полсотни пикселей.
 */

export type GridDetection = {
  /** Шаг сетки в пикселях исходной картинки. */
  cellSizePx: number;
  /** Насколько уверенно нашлась периодичность, от 0 до 1. */
  confidence: number;
};

/** Больше этого размера картинку уменьшаем: точности хватает, а считается быстрее. */
const maxAnalyzedSize = 2000;
/** Пиксель темнее этого считаем линией, а не фоном. */
const inkThreshold = 245;
const minStepPx = 6;
const maxStepPx = 200;
/** Ниже этого совпадения считаем, что сетки на картинке нет. */
const minConfidence = 0.12;

export function detectGridStep(image: HTMLImageElement): GridDetection | null {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width < minStepPx * 4 || height < minStepPx * 4) return null;

  const scale = Math.min(1, maxAnalyzedSize / Math.max(width, height));
  const canvasWidth = Math.max(1, Math.round(width * scale));
  const canvasHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0, canvasWidth, canvasHeight);

  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, canvasWidth, canvasHeight).data;
  } catch {
    // Картинка из другого источника пометит холст «грязным» и читать его нельзя.
    return null;
  }

  const columns = new Float64Array(canvasWidth);
  const rows = new Float64Array(canvasHeight);

  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      const index = (y * canvasWidth + x) * 4;
      const luminance = (pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 1000;
      if (luminance < inkThreshold) {
        columns[x] += 1;
        rows[y] += 1;
      }
    }
  }

  const byColumns = findPeriod(columns);
  const byRows = findPeriod(rows);
  const best = pickBest(byColumns, byRows);
  if (!best) return null;

  return {
    cellSizePx: round2(best.period / scale),
    confidence: round2(best.confidence),
  };
}

type Period = {
  period: number;
  confidence: number;
};

/**
 * Из двух осей берём ту, где периодичность выражена чётче.
 * Если оси согласны между собой, шаг усредняем — так точнее.
 */
function pickBest(first: Period | null, second: Period | null): Period | null {
  if (!first) return second;
  if (!second) return first;

  const agree = Math.abs(first.period - second.period) / Math.max(first.period, second.period) < 0.05;
  if (agree) {
    return {
      period: (first.period + second.period) / 2,
      confidence: Math.max(first.confidence, second.confidence),
    };
  }

  return first.confidence >= second.confidence ? first : second;
}

function findPeriod(profile: Float64Array): Period | null {
  const length = profile.length;
  const maxLag = Math.min(maxStepPx, Math.floor(length / 4));
  if (maxLag <= minStepPx) return null;

  const centered = center(profile);
  const energy = dot(centered, centered, 0);
  if (energy <= 0) return null;

  let bestLag = 0;
  let bestScore = 0;
  const scores = new Float64Array(maxLag + 1);

  for (let lag = minStepPx; lag <= maxLag; lag += 1) {
    const score = dot(centered, centered, lag) / (energy * ((length - lag) / length));
    scores[lag] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || bestScore < minConfidence) return null;

  // Кратные шагу тоже дают всплеск: 2 и 3 клетки повторяются не хуже одной.
  // Берём самый мелкий шаг, который объясняет картину не хуже найденного.
  let base = bestLag;
  for (const divisor of [4, 3, 2]) {
    const candidate = Math.round(bestLag / divisor);
    if (candidate >= minStepPx && scores[candidate] >= bestScore * 0.8) {
      base = candidate;
      break;
    }
  }

  return {
    period: refine(profile, base) ?? base,
    confidence: Math.min(1, bestScore),
  };
}

/**
 * Уточняет шаг по положениям линий: находит их центры и подгоняет прямую
 * «номер линии → координата». Наклон прямой и есть шаг.
 */
function refine(profile: Float64Array, approximate: number): number | null {
  const peaks = findPeaks(profile, approximate);
  if (peaks.length < 4) return null;

  const first = peaks[0];
  const indexes = peaks.map((position) => Math.round((position - first) / approximate));

  let sumIndex = 0;
  let sumPosition = 0;
  let sumIndexSquared = 0;
  let sumProduct = 0;

  for (let i = 0; i < peaks.length; i += 1) {
    sumIndex += indexes[i];
    sumPosition += peaks[i];
    sumIndexSquared += indexes[i] * indexes[i];
    sumProduct += indexes[i] * peaks[i];
  }

  const count = peaks.length;
  const divisor = count * sumIndexSquared - sumIndex * sumIndex;
  if (Math.abs(divisor) < 1e-6) return null;

  const step = (count * sumProduct - sumIndex * sumPosition) / divisor;
  if (!Number.isFinite(step) || step < minStepPx || step > maxStepPx) return null;

  // Уточнение не должно уводить далеко: иначе линии нашлись не те.
  if (Math.abs(step - approximate) / approximate > 0.25) return null;

  return step;
}

function findPeaks(profile: Float64Array, minDistance: number): number[] {
  const mean = average(profile);
  const threshold = mean + deviation(profile, mean) * 0.5;
  const gap = Math.max(2, Math.floor(minDistance * 0.6));

  const peaks: number[] = [];
  let index = 0;

  while (index < profile.length) {
    if (profile[index] <= threshold) {
      index += 1;
      continue;
    }

    // Линия толще одного пикселя, поэтому берём середину полосы.
    let end = index;
    while (end + 1 < profile.length && profile[end + 1] > threshold) end += 1;

    const centerPosition = (index + end) / 2;
    if (peaks.length === 0 || centerPosition - peaks[peaks.length - 1] >= gap) {
      peaks.push(centerPosition);
    }

    index = end + 1;
  }

  return peaks;
}

function center(profile: Float64Array): Float64Array {
  const mean = average(profile);
  const result = new Float64Array(profile.length);
  for (let i = 0; i < profile.length; i += 1) result[i] = profile[i] - mean;
  return result;
}

function dot(values: Float64Array, other: Float64Array, lag: number): number {
  let sum = 0;
  for (let i = 0; i + lag < values.length; i += 1) sum += values[i] * other[i + lag];
  return sum;
}

function average(values: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += values[i];
  return sum / values.length;
}

function deviation(values: Float64Array, mean: number): number {
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) sum += (values[i] - mean) ** 2;
  return Math.sqrt(sum / values.length);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
