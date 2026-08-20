import { useEffect, useMemo, useState } from "react";
import { getDealSummary, type DealSummary } from "../../../shared/crm/dealInfo";
import { getPassportMapping, listDealFields, readPassportValues, type PassportValue } from "../../../shared/crm/passportFields";
import { getFurnitureImageUrl, getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getObjectStandMeta, getStandSizeMeters } from "../../../shared/domain/project";
import { buildSpecification, formatNumber } from "../../../shared/domain/specification";
import { renderPlanToDataUrl } from "../exportPlanImage";
import { useEditorStore } from "../store/editorStore";

type Props = {
  onClose: () => void;
};

/**
 * Паспорт стенда — документ для монтажников и клиента.
 *
 * Повторяет состав старого pasport_generator: кто застраивается, какой стенд,
 * что на нём стоит и как он выглядит. Заголовки двуязычные, как в оригинале:
 * паспорта уходят и иностранным участникам.
 *
 * Поля фриза, цвета покрытия и диплома в старом приложении брались из полей
 * сделки amoCRM по номерам. В Битрикс24 это другие поля, и пока они не сверены,
 * паспорт честно показывает пропуск, а не выдуманное значение.
 */
export function StandPassport({ onClose }: Props) {
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const crm = useEditorStore((state) => state.crm);

  const plan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const specification = useMemo(() => buildSpecification(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const stand = plan?.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
  const standMeta = stand ? getObjectStandMeta(stand) : null;
  const size = plan ? getStandSizeMeters(plan) : { width: 0, depth: 0 };
  const exhibition = project?.exhibitions[0]?.title ?? "Выставка";
  const dealId = standMeta?.dealId ?? crm.dealId;

  const [deal, setDeal] = useState<DealSummary | null>(null);
  const [values, setValues] = useState<PassportValue[]>([]);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  // Снимок берётся с холста, поэтому делается один раз при открытии:
  // за диалогом холст не перерисовывается.
  useEffect(() => {
    if (!plan) return;

    try {
      setSnapshot(renderPlanToDataUrl(plan, 2));
    } catch (error) {
      console.warn("Не удалось снять план стенда для паспорта.", error);
    }
  }, [plan]);

  useEffect(() => {
    if (crm.provider !== "bitrix24" || !dealId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [summary, mapping, fields] = await Promise.all([
          getDealSummary(dealId),
          getPassportMapping(),
          listDealFields(),
        ]);
        if (cancelled) return;

        setDeal(summary);
        setValues(readPassportValues(summary.raw, mapping, fields));
      } catch (error) {
        console.warn("Не удалось получить данные сделки для паспорта.", error);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [crm.provider, dealId]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Паспорт стенда" onClick={onClose}>
      <div className="modal passport" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <h2>Паспорт стенда</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="passport__head">
          <div>
            <h3>{exhibition}</h3>
            <p className="passport__kicker">Паспорт стенда // Stand passport</p>
          </div>
          <div className="passport__number">
            <span>STAND // СТЕНД</span>
            <strong>№ {standMeta?.number ?? plan?.title ?? "—"}</strong>
          </div>
        </div>

        <dl className="passport__facts">
          <div>
            <dt>Company // Компания</dt>
            <dd>{deal?.companyName ?? (crm.provider === "bitrix24" ? "не указана" : "—")}</dd>
          </div>
          <div>
            <dt>Contact // Контакт</dt>
            <dd>{deal?.contactName ?? "—"}</dd>
          </div>
          <div>
            <dt>Area // Площадь</dt>
            <dd>
              {formatNumber(specification.areaM2)} м² ({formatNumber(size.width)} x {formatNumber(size.depth)})
            </dd>
          </div>
          <div>
            <dt>Perimeter // Периметр</dt>
            <dd>{formatNumber(specification.perimeterM)} м</dd>
          </div>
        </dl>

        {values.length > 0 ? (
          <div className="passport__section">
            <h3>FRAME BOARD // ФРИЗ И ОФОРМЛЕНИЕ</h3>
            <dl className="passport__list">
              {values.map((item) => (
                <div key={item.slot.id}>
                  <dt>{item.slot.title}</dt>
                  <dd>
                    {item.value}
                    {item.slot.id === "friezeText" ? <span className="passport__hint"> — знаков: {item.value.length}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {snapshot ? (
          <div className="passport__section">
            <h3>PLAN // ПЛАН СТЕНДА</h3>
            <img className="passport__plan" src={snapshot} alt="План стенда" />
          </div>
        ) : null}

        <div className="passport__section">
          <h3>LIST OF EQUIPMENT // СПИСОК ОБОРУДОВАНИЯ</h3>

          {specification.groups.length === 0 ? (
            <p>На плане пока ничего не расставлено.</p>
          ) : (
            <table className="passport__table">
              <thead>
                <tr>
                  <th>ITEM // НАИМЕНОВАНИЕ</th>
                  <th>QUANTITY // КОЛИЧЕСТВО</th>
                  <th>PICTURE // ОБОЗНАЧЕНИЕ</th>
                </tr>
              </thead>
              <tbody>
                {specification.groups.flatMap((group) =>
                  group.rows.map((row) => {
                    const item = getFurnitureItem(row.itemId);
                    return (
                      <tr key={row.itemId}>
                        <td>{row.title}</td>
                        <td>
                          {row.quantity} {row.unit}
                        </td>
                        <td>{item ? <img src={getFurnitureImageUrl(item)} alt="" /> : null}</td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          )}
        </div>

        {specification.wallLengthM > 0 ? (
          <div className="passport__section">
            <h3>WALLS // СТЕНОВЫЕ ПАНЕЛИ</h3>
            <p>Суммарная длина: {formatNumber(specification.wallLengthM)} м</p>
          </div>
        ) : null}

        <div className="passport__section">
          <h3>COMMENTS // ПРИМЕЧАНИЯ</h3>
          <p>{standMeta?.note?.trim() ? standMeta.note : "—"}</p>
        </div>

        <div className="modal__actions">
          <button className="primary-action" onClick={() => window.print()}>
            Печать
          </button>
          <button onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
