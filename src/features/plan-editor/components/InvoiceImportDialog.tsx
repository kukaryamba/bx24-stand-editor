import { useEffect, useMemo, useState } from "react";
import { loadInvoiceMappings, saveInvoiceMappings, type InvoiceMappings } from "../../../shared/crm/invoiceMappings";
import { priceCatalog2026 } from "../../../shared/domain/catalog2026";
import { furnitureCategories, getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getObjectStandMeta, getStandSizeMeters } from "../../../shared/domain/project";
import { baseMaxAreaM2 } from "../../../shared/domain/standBase";
import { normalizeRowText, parseInvoice, pieces, type InvoiceMatch, type ParsedInvoice } from "../../../shared/invoice/parseInvoice";
import { readPdfLines } from "../../../shared/invoice/pdfText";
import { useEditorStore } from "../store/editorStore";

/**
 * Загрузка счетов PDF: оборудование из счетов — на площадку стенда.
 *
 * Счета читаются в браузере. Перед добавлением всё показывается списком:
 * что опознано, что нужно выбрать, что пропущено и почему. Выбор, сделанный
 * вручную, запоминается для всех — второй раз то же название узнаётся само.
 */

const SKIP = "skip";

type Row = {
  key: string;
  fileName: string;
  text: string;
  count: number;
  unit: string;
  match: InvoiceMatch;
  /** id позиции каталога, SKIP или "" — ещё не выбрано. */
  choice: string;
  /** Выбор взят из запомненного или сделан сейчас — значит, его стоит запомнить. */
  manual: boolean;
};

const catalogGroups = furnitureCategories
  .map((category) => ({
    ...category,
    items: priceCatalog2026.filter((item) => item.category === category.id && !item.frieze && !item.film),
  }))
  .filter((group) => group.items.length > 0);

export function InvoiceImportDialog({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const crm = useEditorStore((state) => state.crm);
  const addFurnitureBatch = useEditorStore((state) => state.addFurnitureBatch);

  const plan = getFloorPlan(project, activeFloorPlanId);
  const stand = plan?.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
  const standNumber = stand ? getObjectStandMeta(stand)?.number : null;
  const size = plan ? getStandSizeMeters(plan) : { width: 0, depth: 0 };
  const planArea = Math.round(size.width * size.depth * 10) / 10;

  const [mappings, setMappings] = useState<InvoiceMappings>({});
  const [invoices, setInvoices] = useState<Array<{ fileName: string; parsed: ParsedInvoice }>>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);

  const inPortal = crm.provider === "bitrix24";

  useEffect(() => {
    if (!inPortal) return;
    void loadInvoiceMappings()
      .then(setMappings)
      .catch((error: unknown) => console.warn("Не удалось загрузить запомненные названия из счетов.", error));
  }, [inPortal]);

  const readFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setStatus({ text: "Читаю счета..." });

    const nextInvoices: typeof invoices = [];
    const nextRows: Row[] = [];
    const failed: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const parsed = parseInvoice(await readPdfLines(file));
        if (parsed.rows.length === 0) {
          failed.push(`${file.name} — не нашлась таблица позиций. Если это скан, текст из него не прочитать.`);
          continue;
        }
        nextInvoices.push({ fileName: file.name, parsed });
        parsed.rows.forEach((row, index) => {
          const remembered = mappings[normalizeRowText(row.text)];
          const auto = row.match.kind === "item" ? row.match.itemId : row.match.kind === "skip" ? SKIP : "";
          nextRows.push({
            key: `${file.name}-${index}`,
            fileName: file.name,
            text: row.text,
            count: pieces(row),
            unit: row.unit,
            match: row.match,
            choice: remembered ?? auto,
            manual: false,
          });
        });
      } catch (error) {
        console.warn("Не удалось прочитать счёт.", error);
        failed.push(`${file.name} — не удалось открыть как PDF.`);
      }
    }

    setInvoices((current) => [...current, ...nextInvoices]);
    setRows((current) => [...current, ...nextRows]);
    setStatus(failed.length ? { text: failed.join(" "), error: true } : null);
  };

  const choose = (key: string, choice: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, choice, manual: true } : row)));

  // Застройка из счетов: номер и площадь — первое найденное. Схему из счёта
  // («угловой» и т. п.) не предлагаем: стены расставляют сами, счёт их не знает.
  const found = useMemo(() => {
    const pick = <T,>(get: (parsed: ParsedInvoice) => T | null) => invoices.map((item) => get(item.parsed)).find((value) => value !== null) ?? null;
    return { number: pick((p) => p.standNumber), area: pick((p) => p.areaM2) };
  }, [invoices]);

  const toAdd = rows.filter((row) => row.choice && row.choice !== SKIP);
  const itemCount = toAdd.reduce((sum, row) => sum + row.count, 0);
  const undecided = rows.filter((row) => !row.choice).length;

  const add = async () => {
    addFurnitureBatch(toAdd.flatMap((row) => Array.from({ length: row.count }, () => row.choice)));

    // Запоминаем выбор, сделанный руками, — для этого названия в следующих счетах.
    const learned = Object.fromEntries(rows.filter((row) => row.manual && row.choice).map((row) => [normalizeRowText(row.text), row.choice]));
    if (inPortal && Object.keys(learned).length > 0) {
      try {
        await saveInvoiceMappings({ ...mappings, ...learned });
      } catch (error) {
        console.warn("Не удалось запомнить выбор для названий из счетов.", error);
      }
    }
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Загрузка счетов" onClick={onClose}>
      <div className="modal invoice-import" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <h2>Оборудование из счетов</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <label className="invoice-import__files">
          <span>Выберите один или несколько счетов в PDF. Файлы читаются здесь, в браузере, и никуда не отправляются.</span>
          <input type="file" accept="application/pdf,.pdf" multiple onChange={(event) => void readFiles(event.target.files)} />
        </label>

        {status ? <p className={status.error ? "install-card__error" : "stand-hint"}>{status.text}</p> : null}

        {invoices.length > 0 ? (
          <div className="invoice-import__summary">
            <p>Счета: {invoices.map((item) => item.fileName).join(", ")}</p>
            {found.number && standNumber && found.number !== standNumber ? (
              <p className="install-card__error">
                В счёте стенд {found.number}, а открыт стенд {standNumber}. Проверьте, тот ли это счёт.
              </p>
            ) : null}
            {found.area !== null && Math.abs(found.area - planArea) > 0.05 ? (
              <p className="install-card__error">
                В счёте {String(found.area).replace(".", ",")} м², а площадка {String(planArea).replace(".", ",")} м². Размер площадки поменяйте слева, в полях «Ширина» и «Глубина».
              </p>
            ) : null}
            {found.area !== null && found.area > baseMaxAreaM2 ? (
              <p className="stand-hint">Стенд больше {baseMaxAreaM2} м² — базовой комплектации нет, мебель и свет только по счёту.</p>
            ) : null}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="invoice-import__table">
            <table>
              <thead>
                <tr>
                  <th>Позиция в счёте</th>
                  <th>Кол-во</th>
                  <th>Что ставить</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className={row.choice === SKIP ? "is-skipped" : !row.choice ? "is-undecided" : undefined}>
                    <td>
                      {row.text}
                      {row.match.kind === "skip" && row.choice === SKIP ? <small> — {row.match.reason}</small> : null}
                    </td>
                    <td>
                      {row.count} {row.unit === "шт" ? "шт" : `(${row.unit})`}
                    </td>
                    <td>
                      <select value={row.choice} onChange={(event) => choose(row.key, event.target.value)}>
                        <option value="">— выберите —</option>
                        <option value={SKIP}>Не ставить</option>
                        {row.match.kind === "choice" ? (
                          <optgroup label="Подходит по названию">
                            {row.match.itemIds.map((id) => (
                              <option key={id} value={id}>
                                {getFurnitureItem(id)?.title ?? id}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {/* Каталог по разделам — как в палитре предметов, иначе в длинном списке не найти. */}
                        {catalogGroups.map((group) => (
                          <optgroup key={group.id} label={group.title}>
                            {group.items.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.catalogId ? `${item.catalogId} · ` : ""}
                                {item.title}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="modal__actions">
            <button type="button" className="primary-action" disabled={itemCount === 0} onClick={() => void add()}>
              Добавить на площадку: {itemCount} шт
            </button>
            <button type="button" onClick={onClose}>
              Отмена
            </button>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <p className="stand-hint">
            {undecided > 0 ? `Не выбрано позиций: ${undecided} — они не добавятся. ` : ""}
            Предметы встанут под площадкой, выделенными, — перетащите их на места. Выбор, сделанный вручную, запомнится
            для следующих счетов.
          </p>
        ) : null}
      </div>
    </div>
  );
}
