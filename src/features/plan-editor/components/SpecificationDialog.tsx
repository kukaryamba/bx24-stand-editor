import { Fragment, useMemo, useState } from "react";
import { getFloorPlan } from "../../../shared/domain/project";
import { buildSpecification, formatNumber, specificationToText } from "../../../shared/domain/specification";
import { useEditorStore } from "../store/editorStore";

type Props = {
  onClose: () => void;
};

/**
 * Перечень того, что стоит на плане стенда.
 *
 * Цены не показываются: в каталоге их пока нет, а нули или выдуманные суммы
 * в документе для клиента опаснее, чем их отсутствие.
 */
export function SpecificationDialog({ onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);

  const plan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const specification = useMemo(() => buildSpecification(project, activeFloorPlanId), [activeFloorPlanId, project]);

  const handleCopy = async () => {
    const text = specificationToText(specification, plan?.title ?? "План стенда");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Спецификация" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <h2>Спецификация</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <dl className="spec-summary">
          <div>
            <dt>Стенд</dt>
            <dd>{plan?.title ?? "—"}</dd>
          </div>
          <div>
            <dt>Площадь</dt>
            <dd>{formatNumber(specification.areaM2)} м²</dd>
          </div>
          <div>
            <dt>Периметр</dt>
            <dd>{formatNumber(specification.perimeterM)} м</dd>
          </div>
          <div>
            <dt>Предметов</dt>
            <dd>{specification.itemsCount}</dd>
          </div>
          {specification.wallLengthM > 0 ? (
            <div>
              <dt>Стеновые панели</dt>
              <dd>{formatNumber(specification.wallLengthM)} м</dd>
            </div>
          ) : null}
        </dl>

        {specification.groups.length === 0 ? (
          <p className="spec-empty">На плане пока ничего не расставлено. Добавьте предметы из палитры слева.</p>
        ) : (
          <div className="spec-table-wrap">
            <table className="spec-table">
              <thead>
                <tr>
                  <th>Наименование</th>
                  <th>Артикул</th>
                  <th className="is-num">Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {specification.groups.map((group) => (
                  <Fragment key={group.category}>
                    <tr className="spec-table__group">
                      <th colSpan={3}>{group.title}</th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.itemId}>
                        <td>{row.title}</td>
                        <td className="is-muted">{row.catalogId || "—"}</td>
                        <td className="is-num">
                          {row.quantity} {row.unit}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="spec-note">
          Цены не показаны: они хранятся в каталоге Битрикс24 и появятся здесь после подключения к порталу.
          {specification.itemsWithoutCatalogId > 0
            ? ` Без артикула: ${specification.itemsWithoutCatalogId} предм. — такие позиции не попадут в смету CRM.`
            : ""}
        </p>

        <div className="modal__actions">
          <button type="button" className="primary-action" onClick={handleCopy} disabled={specification.itemsCount === 0}>
            {copied ? "Скопировано" : "Скопировать текстом"}
          </button>
          <button type="button" onClick={() => window.print()} disabled={specification.itemsCount === 0}>
            Печать
          </button>
        </div>
      </div>
    </div>
  );
}
