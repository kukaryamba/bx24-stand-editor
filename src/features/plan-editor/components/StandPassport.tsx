import { useEffect, useMemo, useState } from "react";
import { getDealSummary, type DealSummary } from "../../../shared/crm/dealInfo";
import { readPassportValues } from "../../../shared/crm/passportFields";
import { getFurnitureImageUrl, getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getObjectFurnitureMeta, getObjectStandMeta, getStandSizeMeters } from "../../../shared/domain/project";
import { buildSpecification, formatNumber } from "../../../shared/domain/specification";
import { renderPlanToDataUrl } from "../exportPlanImage";
import { useFriezeDefaultLabel } from "../hooks/useFriezeDefaultLabel";
import { useStandHeading } from "../hooks/useStandHeading";
import { baseCarpetColor, baseFriezeColor } from "../../../shared/domain/standBase";
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
  const heading = useStandHeading(plan);
  const dealId = standMeta?.dealId ?? crm.dealId;

  const [deal, setDeal] = useState<DealSummary | null>(null);
  // Надпись на фризе та же, что на панелях: пустая анкета — из названия сделки.
  const friezeLabel = useFriezeDefaultLabel();
  // У панелей фриза надписи бывают разные — в паспорт все разные, через « / ».
  const friezeLabels = useMemo(() => {
    const labels = (project?.objects ?? [])
      .filter((object) => object.floorPlanId === plan?.id)
      .map((object) => getObjectFurnitureMeta(object))
      .filter((meta) => meta && getFurnitureItem(meta.itemId)?.frieze)
      .map((meta) => (meta?.label ?? friezeLabel).trim())
      .filter(Boolean);
    const distinct = [...new Set(labels)];
    return distinct.length > 0 ? distinct : [friezeLabel];
  }, [friezeLabel, plan?.id, project]);
  const values = useMemo(
    // Ковёр серый у всех, пока в анкете не вписан другой.
    () =>
      readPassportValues({
        ...standMeta?.passport,
        friezeText: friezeLabels.join(" / "),
        carpetColor: standMeta?.passport?.carpetColor || baseCarpetColor,
        friezeColor: standMeta?.passport?.friezeColor || baseFriezeColor,
      }),
    [standMeta, friezeLabels],
  );
  const [snapshot, setSnapshot] = useState<string | null>(null);

  // Снимок берётся с холста, поэтому делается один раз при открытии:
  // за диалогом холст не перерисовывается.
  useEffect(() => {
    if (!plan) return;

    try {
      setSnapshot(renderPlanToDataUrl(plan, project?.objects ?? [], 2));
    } catch (error) {
      console.warn("Не удалось снять план стенда для паспорта.", error);
    }
  }, [plan]);

  useEffect(() => {
    if (crm.provider !== "bitrix24" || !dealId) return;

    let cancelled = false;

    void getDealSummary(dealId)
      .then((summary) => {
        if (!cancelled) setDeal(summary);
      })
      .catch((error: unknown) => {
        console.warn("Не удалось получить данные сделки для паспорта.", error);
      });
    return () => {
      cancelled = true;
    };
  }, [crm.provider, dealId]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Паспорт стенда" onClick={onClose}>
      <div className="modal passport" onClick={(event) => event.stopPropagation()}>
        <div className="modal__head">
          <h2>Паспорт стенда</h2>
          {/* Печать и сверху: паспорт длинный, листать до конца ради кнопки неудобно. */}
          <div className="modal__actions">
            <button className="primary-action" onClick={() => window.print()}>
              Печать
            </button>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
              ✕
            </button>
          </div>
        </div>

        {/* Сверху только название стенда — то же, что в заголовке редактора. */}
        <div className="passport__head">
          <h3>{heading}</h3>
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
                    {item.slot.id === "friezeText" ? (
                      <span className="passport__hint">
                        {" — знаков: "}
                        {friezeLabels.map((label) => Array.from(label).length).join(" / ")}
                      </span>
                    ) : null}
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
                  <th className="passport__col-num">№</th>
                  <th className="passport__col-title">ITEM // НАИМЕНОВАНИЕ</th>
                  <th className="passport__col-code">CODE // АРТ.</th>
                  <th className="passport__col-qty">QUANTITY // КОЛ-ВО</th>
                  <th className="passport__col-picture">PICTURE // ОБОЗНАЧЕНИЕ</th>
                </tr>
              </thead>
              <tbody>
                {/* Нумерация сквозная по всему списку: по номеру строки монтажники сверяются с заявкой. */}
                {specification.groups
                  .flatMap((group) => group.rows)
                  .map((row, index) => {
                    const item = getFurnitureItem(row.itemId);
                    return (
                      <tr key={row.itemId}>
                        <td className="passport__col-num">{index + 1}</td>
                        <td className="passport__col-title">{row.title}</td>
                        {/* Артикула нет у части позиций прайса — ставим прочерк, а не выдумываем. */}
                        <td className="passport__col-code">{row.catalogId || "—"}</td>
                        <td className="passport__col-qty">
                          {row.quantity} {row.unit}
                        </td>
                        <td className="passport__col-picture">{item ? <img src={getFurnitureImageUrl(item)} alt="" /> : null}</td>
                      </tr>
                    );
                  })}
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

        {specification.friezeLengthM > 0 ? (
          <div className="passport__section">
            <h3>FRAME BOARD PANELS // ФРИЗОВЫЕ ПАНЕЛИ</h3>
            <p>Суммарная длина: {formatNumber(specification.friezeLengthM)} м</p>
          </div>
        ) : null}

        {specification.filmLengthM > 0 ? (
          <div className="passport__section">
            <h3>FILM WRAPPING // ОКЛЕЙКА ПЛЁНКОЙ</h3>
            <p>Суммарная длина: {formatNumber(specification.filmLengthM)} м</p>
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
