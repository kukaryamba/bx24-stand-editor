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
  /** Где проходит первая линия по горизонтали, от левого края картинки. */
  offsetX: number;
  /** То же по вертикали, от верхнего края. */
  offsetY: number;
  /** Насколько уверенно нашлась периодичность, от 0 до 1. */
  confidence: number;
  /**
   * Где на картинке сам чертёж, в пикселях исходной картинки. Края лежат
   * на узлах сетки. Пусто, если обрезать нечего или границы не нашлись.
   */
  frame: PlanFrame | null;
};

export type PlanFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Запас вокруг сетки: стены, стрелки и подписи часто выходят за её край. */
const frameMarginCells = 2;
/**
 * Обрезаем, только если это заметно уменьшает картинку. Иначе ради пары
 * пикселей пережимали бы и так аккуратный план.
 */
const minCroppedShare = 0.05;

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

  return detectGridFromPixels(pixels, canvasWidth, canvasHeight, scale, width, height);
}

/**
 * Сам расчёт — по готовым пикселям, без браузера. Отделён, чтобы его можно
 * было прогнать на настоящих планах и убедиться, что обрезка не промахивается.
 *
 * pixels — RGBA уменьшенной картинки, scale — во сколько раз её уменьшили,
 * width и height — размеры исходной.
 */
export function detectGridFromPixels(
  pixels: Uint8ClampedArray | Uint8Array,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  width: number,
  height: number,
): GridDetection | null {
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

  // Грубый шаг уточняем спектрально — сразу по обеим осям, — а из того же
  // расчёта берём фазу. Шапка, подписи и стрелки не периодичны и почти
  // не влияют, а шаг выходит точным до сотых: без этого граница сетки
  // теряется уже через два десятка клеток.
  const period = refinePeriod(columns, rows, best.period);
  const phaseX = spectralPhase(columns, period);
  const phaseY = spectralPhase(rows, period);

  const spanX = gridSpan(columns, canvasHeight, period, phaseX);
  const spanY = gridSpan(rows, canvasWidth, period, phaseY);

  let frame: PlanFrame | null = null;
  if (spanX && spanY) {
    const margin = frameMarginCells * period;

    // Край среза ставим на узел сетки, отступив от крайней линии на целое
    // число клеток, — тогда после обрезки сетка ложится с нулевым сдвигом.
    const nodeAtOrBefore = (value: number, phase: number) => phase + Math.floor((value - phase) / period) * period;
    const left = Math.max(nodeAtOrBefore(spanX.first - margin, phaseX), phaseX);
    const top = Math.max(nodeAtOrBefore(spanY.first - margin, phaseY), phaseY);
    const right = Math.min(spanX.last + margin, canvasWidth);
    const bottom = Math.min(spanY.last + margin, canvasHeight);

    const candidate = {
      x: Math.round(left / scale),
      y: Math.round(top / scale),
      width: Math.round((right - left) / scale),
      height: Math.round((bottom - top) / scale),
    };

    const croppedShare = 1 - (candidate.width * candidate.height) / (width * height);
    if (candidate.width > 0 && candidate.height > 0 && croppedShare >= minCroppedShare) {
      frame = candidate;
    }
  }

  return {
    cellSizePx: round2(period / scale),
    offsetX: round2(phaseX / scale),
    offsetY: round2(phaseY / scale),
    confidence: round2(best.confidence),
    frame,
  };
}

/**
 * Где на оси начинается и кончается сетка чертежа.
 *
 * Проверяем места, где по шагу и фазе должна идти линия. Линия — это не
 * просто тёмная полоса: посередине между линиями должно быть светло. Иначе
 * крупные буквы в шапке плана, тёмные сплошняком, сошли бы за сетку.
 *
 * Отдельные пропуски допустимы — линию может перекрыть стенд или подпись.
 * Берётся самый длинный непрерывный участок.
 *
 * Шагаем строго по расчётным местам, не подтягиваясь к найденной линии:
 * у толстой стены подтягивание цепляется за стену и сбивается с шага.
 * Это возможно только потому, что шаг уже уточнён до сотых.
 */
type GridSpan = {
  first: number;
  last: number;
};

function gridSpan(profile: Float64Array, crossSize: number, period: number, phase: number): GridSpan | null {
  const threshold = crossSize * 0.04;
  // Пустые места бывают широкими: конференц-зал на плане ЦБСС — два десятка
  // клеток, где сетка идёт только выше и ниже. Поэтому пропусков допускаем много.
  const allowedGaps = 6;

  let best: GridSpan | null = null;
  let runFirst: number | null = null;
  let runLast = 0;
  let gaps = 0;

  const closeRun = () => {
    if (runFirst === null) return;
    if (!best || runLast - runFirst > best.last - best.first) best = { first: runFirst, last: runLast };
    runFirst = null;
  };

  let position = phase;
  while (position < profile.length) {
    const index = localMaxIndex(profile, position, period * 0.25);
    const isLine = profile[index] - betweenAt(profile, index, period) >= threshold;

    if (isLine) {
      if (runFirst === null) runFirst = index;
      runLast = index;
      gaps = 0;
      position += period;
    } else {
      if (runFirst !== null) {
        gaps += 1;
        if (gaps > allowedGaps) {
          closeRun();
          gaps = 0;
        }
      }
      position += period;
    }
  }
  closeRun();

  // Пара совпадений — это ещё не сетка.
  const found = best as GridSpan | null;
  if (!found || found.last - found.first < period * 4) return null;
  return found;
}

/** Насколько шире грубой оценки искать точный шаг — в обе стороны. */
const refineRange = 0.04;
const refineSteps = 400;

/**
 * Точный шаг: при каком периоде картинка «звучит» сильнее всего.
 *
 * Для каждого близкого шага считаем, насколько профиль совпадает с гребёнкой
 * этого шага (амплитуда преобразования Фурье на его частоте). Линии сетки
 * складываются в фазе, а шапка и подписи — вразнобой и гасят друг друга.
 * Диапазон узкий, ±4%, поэтому половинный и двойной шаг сюда не попадают —
 * их отсеял выбор кандидатов по контрасту.
 */
function refinePeriod(columns: Float64Array, rows: Float64Array, approximate: number): number {
  const centeredColumns = center(columns);
  const centeredRows = center(rows);

  let bestPeriod = approximate;
  let bestPower = -1;
  for (let step = -refineSteps; step <= refineSteps; step += 1) {
    const period = approximate * (1 + (step / refineSteps) * refineRange);
    const power = spectrumPower(centeredColumns, period) + spectrumPower(centeredRows, period);
    if (power > bestPower) {
      bestPower = power;
      bestPeriod = period;
    }
  }

  return bestPeriod;
}

function spectrum(centered: Float64Array, period: number): { re: number; im: number } {
  const omega = (2 * Math.PI) / period;
  let re = 0;
  let im = 0;
  for (let x = 0; x < centered.length; x += 1) {
    re += centered[x] * Math.cos(omega * x);
    im -= centered[x] * Math.sin(omega * x);
  }
  return { re, im };
}

function spectrumPower(centered: Float64Array, period: number): number {
  const { re, im } = spectrum(centered, period);
  // Нормируем на длину оси: иначе длинная ось перевешивала бы короткую.
  return (re * re + im * im) / (centered.length * centered.length);
}

/**
 * Где проходит первая линия, по фазе того же преобразования.
 *
 * Если линии стоят в точках φ + k·шаг, их вклады складываются в число
 * с углом −2π·φ/шаг — по этому углу φ и восстанавливается.
 */
function spectralPhase(profile: Float64Array, period: number): number {
  const { re, im } = spectrum(center(profile), period);
  const phase = (-Math.atan2(im, re) / (2 * Math.PI)) * period;
  return ((phase % period) + period) % period;
}

/**
 * Вырезает чертёж из картинки плана.
 *
 * Сохраняем в JPEG: план хранится в браузере текстом, и PNG на несколько
 * тысяч пикселей легко переполнил бы хранилище. Фон заливаем белым — у PNG
 * с прозрачностью иначе вышел бы чёрный.
 */
export function cropImage(image: HTMLImageElement, frame: PlanFrame): string {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;

  const context = canvas.getContext("2d");
  if (!context) return image.src;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, frame.width, frame.height);
  context.drawImage(image, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);

  return canvas.toDataURL("image/jpeg", 0.92);
}

/**
 * Где проходит ближайшая к краю линия сетки.
 *
 * Остатки от деления координат линий на шаг усредняются по кругу: обычное
 * среднее врёт, когда линии стоят около нуля и около целого шага сразу.
 */
function phaseOf(profile: Float64Array, period: number): number {
  const peaks = findPeaks(profile, period);
  if (peaks.length < 3) return 0;

  let sin = 0;
  let cos = 0;
  for (const peak of peaks) {
    const angle = (2 * Math.PI * peak) / period;
    sin += Math.sin(angle);
    cos += Math.cos(angle);
  }

  const mean = (Math.atan2(sin, cos) / (2 * Math.PI)) * period;
  return ((mean % period) + period) % period;
}

type Period = {
  period: number;
  confidence: number;
  /** Насколько чётко линии отличаются от середины клеток — судья между осями. */
  contrast: number;
};

/**
 * Из двух осей берём ту, где сетка выражена чётче.
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
      contrast: Math.max(first.contrast, second.contrast),
    };
  }

  return first.contrast >= second.contrast ? first : second;
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

  // Всплеск автокорреляции дают и кратные шагу, и его доли: две клетки
  // повторяются не хуже одной, а полклетки — там, где на чертеже есть мелкие
  // детали. Раньше бралась самая мелкая подходящая доля, и на планах ЦБСС
  // это давало полшага вместо шага. Теперь кандидатов судит контраст:
  // у настоящей сетки на линии темно, а посередине между линиями светло.
  const candidates = new Set<number>();
  for (const factor of [0.25, 1 / 3, 0.5, 1, 2]) {
    const candidate = bestLag * factor;
    if (candidate >= minStepPx && candidate <= maxStepPx) candidates.add(candidate);
  }

  let base = bestLag;
  let bestContrast = -Infinity;
  for (const candidate of candidates) {
    const period = refine(profile, candidate) ?? candidate;
    const contrast = lineContrast(profile, period);
    if (contrast > bestContrast) {
      bestContrast = contrast;
      base = period;
    }
  }

  return {
    period: base,
    confidence: Math.min(1, bestScore),
    contrast: bestContrast,
  };
}

/**
 * Насколько хорошо шаг объясняет картину: средняя разница между яркостью
 * на линии и посередине между линиями.
 *
 * У половинного шага каждая вторая «линия» попадает в пустую клетку, у двойного
 * «середина» попадает на настоящую линию — оба набирают меньше. Высокий балл
 * получает только настоящий шаг.
 */
function lineContrast(profile: Float64Array, period: number): number {
  const phase = phaseOf(profile, period);
  let peak = 0;
  for (let i = 0; i < profile.length; i += 1) if (profile[i] > peak) peak = profile[i];
  if (peak <= 0) return 0;

  let sum = 0;
  let count = 0;
  let position = phase;
  while (position < profile.length) {
    const index = localMaxIndex(profile, position, period * 0.2);
    sum += Math.max(0, profile[index] - betweenAt(profile, index, period));
    count += 1;
    // Подтягиваемся к найденной линии, чтобы ошибка шага не накапливалась.
    position = index + period;
  }

  return count > 0 ? sum / count / peak : 0;
}

/**
 * Яркость посередине клетки — точечно, в пиксель.
 *
 * Окно поиска не должно расти вместе с проверяемым шагом: у двойного шага
 * середина приходится на настоящую линию, но широкое окно дотянулось бы
 * до светлого места рядом, и двойной шаг выглядел бы убедительно.
 */
function betweenAt(profile: Float64Array, lineIndex: number, period: number): number {
  // Смотрим самое тёмное в крошечном окне: линия после уменьшения картинки
  // бывает толщиной в пиксель, и по самому светлому месту рядом с ней всегда
  // нашёлся бы белый — двойной шаг проходил бы проверку.
  return Math.max(localMaxValue(profile, lineIndex - period / 2, 1), localMaxValue(profile, lineIndex + period / 2, 1));
}

function localMaxValue(profile: Float64Array, position: number, radius: number): number {
  return profile[localMaxIndex(profile, position, radius)] ?? 0;
}

/** Самое тёмное место рядом: линия редко попадает точно в расчётную точку. */
function localMaxIndex(profile: Float64Array, position: number, radius: number): number {
  const from = Math.max(0, Math.floor(position - radius));
  const to = Math.min(profile.length - 1, Math.ceil(position + radius));
  let best = Math.min(profile.length - 1, Math.max(0, Math.round(position)));
  for (let i = from; i <= to; i += 1) if (profile[i] > profile[best]) best = i;
  return best;
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
