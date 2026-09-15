/**
 * Текст PDF по строкам — для разбора счетов.
 *
 * Файл читается прямо в браузере: счета с реквизитами и суммами никуда
 * не отправляются. Библиотека PDF тяжёлая, поэтому грузится только когда
 * счёт действительно выбрали.
 */

/** Кусок текста на странице с положением — как его отдаёт pdf.js. */
export type PdfTextItem = { str: string; x: number; y: number; width: number };

/**
 * Собирает куски текста в строки: по вертикали кусок в пределах допуска —
 * та же строка, внутри строки — слева направо. pdf.js отдаёт текст кусками
 * в порядке рисования, и столбцы таблицы счёта иначе перемешиваются.
 */
export function groupTextLines(items: PdfTextItem[], tolerance = 2.5): string[] {
  const rows: Array<{ y: number; items: PdfTextItem[] }> = [];

  // Сверху вниз: у PDF ось Y смотрит вверх.
  for (const item of [...items].filter((entry) => entry.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => a.x - b.x);
      let line = "";
      let end = -Infinity;
      for (const item of sorted) {
        // Между кусками с заметным зазором — пробел: так не слипаются столбцы.
        if (line && item.x - end > 1) line += " ";
        line += item.str;
        end = item.x + item.width;
      }
      return line.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

export async function readPdfLines(file: File): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      items.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width });
    }
    lines.push(...groupTextLines(items));
  }

  await document.destroy();
  return lines;
}
