import { ExternalLink, LayoutGrid, Trash2 } from "lucide-react";
import { dealUrl } from "../../../shared/crm/bitrixApi";
import { useMemo, type ReactNode } from "react";
import { getFurnitureItem } from "../../../shared/domain/furniture";
import {
  friezeMaxChars,
  getCanvasObject,
  getFloorPlan,
  getObjectFurnitureMeta,
  getObjectPoints,
  getObjectStandMeta,
  splitFriezeLabel,
} from "../../../shared/domain/project";
import { statusLabels } from "../../../shared/domain/status";
import { polygonArea } from "../../../shared/geometry/polygon";
import { standNumberFromTitle, useDealTitle } from "../../../shared/crm/dealTitle";
import { useFriezeLabels } from "../hooks/useFriezeDefaultLabel";
import { standStatuses, useEditorStore } from "../store/editorStore";
import { PassportForm } from "./PassportForm";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Подсказка под надписью фриза: сколько знаков и что не помещается.
 * В поле ввода часть текста красным не выделить, поэтому лишнее
 * показывается здесь, как и на самой панели.
 */
function FriezeLabelHint({ label }: { label: string }) {
  const { fits, extra } = splitFriezeLabel(label);
  const count = Array.from(label).length;

  return (
    <p className="stand-hint">
      {extra ? (
        <>
          Знаков {count} из {friezeMaxChars}: {fits}
          <span className="frieze-extra">{extra}</span> — лишнее красным.
        </>
      ) : (
        <>Знаков {count} из {friezeMaxChars}.</>
      )}
    </p>
  );
}

/**
 * Номер стенда. Если в названии сделки есть номер вида «D4-1», он главный:
 * поле только показывает его, править нужно название сделки. Иначе номер
 * вписывается руками.
 */
function StandNumberField({ standObjectId, number, dealId }: { standObjectId: string; number: string; dealId: string | null }) {
  const crm = useEditorStore((state) => state.crm);
  const updateStand = useEditorStore((state) => state.updateStand);
  const title = useDealTitle(dealId, crm.provider === "bitrix24");
  const fromDeal = standNumberFromTitle(title);

  return (
    <>
      <label>
        Номер
        <input
          value={fromDeal ?? number}
          readOnly={Boolean(fromDeal)}
          onChange={(event) => updateStand(standObjectId, { number: event.target.value })}
        />
      </label>
      <p className="stand-hint">
        {fromDeal
          ? "Из названия сделки. Чтобы поменять, переименуйте сделку."
          : dealId
            ? "В названии сделки нет номера вида D4-1 — впишите вручную."
            : "Привяжите сделку — номер возьмётся из её названия."}
      </p>
    </>
  );
}

/**
 * Переход в сделку стенда — в новой вкладке, чтобы не терять план.
 *
 * Внутри портала сделка открылась бы и в боковой панели Битрикс24, но тогда
 * она перекрыла бы редактор. Отдельная вкладка позволяет держать рядом и план,
 * и карточку клиента.
 */
function OpenDealButton({ dealId }: { dealId: string }) {
  const url = dealUrl(dealId);

  if (!url) {
    return <p className="stand-hint">Открыть сделку можно, когда приложение запущено из портала.</p>;
  }

  return (
    <button type="button" onClick={() => window.open(url, "_blank", "noopener")}>
      <ExternalLink size={16} aria-hidden />
      Открыть сделку в новой вкладке
    </button>
  );
}

export function PropertiesPanel({ documents }: { documents?: ReactNode }) {
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const selectedObjectIds = useEditorStore((state) => state.selectedObjectIds);
  const deleteObjects = useEditorStore((state) => state.deleteObjects);
  const crm = useEditorStore((state) => state.crm);
  const validationMessage = useEditorStore((state) => state.validationMessage);
  const updateStand = useEditorStore((state) => state.updateStand);
  const deleteObject = useEditorStore((state) => state.deleteObject);
  const rotateFurniture = useEditorStore((state) => state.rotateFurniture);
  const updateFrieze = useEditorStore((state) => state.updateFrieze);
  const openStandPlan = useEditorStore((state) => state.openStandPlan);
  const setStandFriezeText = useEditorStore((state) => state.setStandFriezeText);
  const frieze = useFriezeLabels();
  const plan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const object = useMemo(() => getCanvasObject(project, selectedObjectId), [project, selectedObjectId]);
  const stand = object && object.kind === "stand" ? getObjectStandMeta(object) : null;
  const furniture = object ? getObjectFurnitureMeta(object) : null;
  const furnitureItem = furniture ? getFurnitureItem(furniture.itemId) : undefined;

  const area = stand && plan && object ? polygonArea(getObjectPoints(object), plan.grid.metersPerCell, plan.grid.cellSizePx) : 0;
  const pxPerMeter = plan ? plan.grid.cellSizePx / plan.grid.metersPerCell : 1;

  return (
    <aside className="right-panel" aria-label="Панель свойств">
      {documents}
      {validationMessage ? <div className="validation-message">{validationMessage}</div> : null}

      {selectedObjectIds.length > 1 ? (
        <div className="property-form">
          <h2>Выбрано объектов: {selectedObjectIds.length}</h2>
          <p>Общих свойств у разных объектов нет, но удалить их можно разом — одной отменой всё вернётся.</p>

          <button className="danger-action" onClick={() => deleteObjects(selectedObjectIds)}>
            <Trash2 size={16} aria-hidden />
            Удалить выбранные ({selectedObjectIds.length})
          </button>
        </div>
      ) : null}

      {object && furniture && furnitureItem ? (
        <div className="property-form">
          <h2>Предмет</h2>

          {(furnitureItem.frieze || furnitureItem.film) && object.shape.kind === "rectangle" ? (
            <>
              {furnitureItem.frieze && frieze.standObjectId ? (
                // На площадке стенда надпись общая с анкетой паспорта: правка здесь меняет её там и на всех панелях.
                <label>
                  Надпись
                  {/* В поле сам текст, а не бледная подсказка: название компании правят, а не набирают заново. */}
                  <input
                    value={furniture.label ?? frieze.label}
                    placeholder="ФРИЗ"
                    onChange={(event) => setStandFriezeText(frieze.standObjectId!, event.target.value)}
                  />
                </label>
              ) : (
                <label>
                  Надпись
                  <input
                    value={furniture.label ?? ""}
                    placeholder={furnitureItem.film ? "ОКЛЕЙКА" : frieze.label || "ФРИЗ"}
                    onChange={(event) => updateFrieze(object.id, { label: event.target.value })}
                  />
                </label>
              )}
              {furnitureItem.frieze ? (
                <>
                  <FriezeLabelHint label={furniture.label ?? frieze.label} />
                  {frieze.standObjectId ? (
                    <>
                      <p className="stand-hint">
                        {frieze.passportText === undefined ? "Название компании из сделки. " : ""}Та же надпись — в анкете паспорта внизу панели.
                      </p>
                      {frieze.passportText !== undefined && frieze.fromDeal && frieze.passportText !== frieze.fromDeal ? (
                        <button type="button" onClick={() => setStandFriezeText(frieze.standObjectId!, null)}>
                          Взять из сделки: {frieze.fromDeal}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </>
              ) : (
                <p className="stand-hint">Например, цвет плёнки. Пусто — на плане будет «ОКЛЕЙКА».</p>
              )}

              <label>
                Длина, м
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={round2(object.shape.width / pxPerMeter)}
                  onChange={(event) => {
                    const meters = Number(event.target.value);
                    if (meters > 0) updateFrieze(object.id, { lengthPx: meters * pxPerMeter });
                  }}
                />
              </label>
              <p className="stand-hint">Или потяните за кружок на конце панели.</p>
            </>
          ) : null}

          <dl className="stand-facts">
            <div>
              <dt>Название</dt>
              <dd>{furnitureItem.title}</dd>
            </div>
            <div>
              <dt>Размер</dt>
              <dd>
                {(furnitureItem.frieze || furnitureItem.film) && object.shape.kind === "rectangle"
                  ? `${String(round2(object.shape.width / pxPerMeter)).replace(".", ",")} м в длину`
                  : `${String(furnitureItem.widthM).replace(".", ",")} x ${String(furnitureItem.depthM).replace(".", ",")} м`}
              </dd>
            </div>
            <div>
              <dt>Поворот</dt>
              <dd>{furniture.rotation}°</dd>
            </div>
            <div>
              <dt>Позиция в каталоге</dt>
              <dd>{furnitureItem.catalogId || "нет в смете"}</dd>
            </div>
          </dl>

          <button className="primary-action" onClick={() => rotateFurniture(object.id)}>
            Повернуть на 90°
          </button>

          <button className="danger-action" onClick={() => deleteObject(object.id)}>
            <Trash2 size={16} aria-hidden />
            Удалить предмет
          </button>
        </div>
      ) : selectedObjectIds.length > 1 ? null : !stand || !object ? (
        <div className="empty-panel">
          <h2>Объект не выбран</h2>
          <p>Выберите объект на плане или создайте новый стенд. Архитектура уже готова для колонн, проходов и других типов объектов.</p>
        </div>
      ) : (
        <div className="property-form">
          <h2>Карточка объекта</h2>

          <StandNumberField standObjectId={object.id} number={stand.number} dealId={stand.dealId} />


          <label>
            Статус
            <select value={stand.status} onChange={(event) => updateStand(object.id, { status: event.target.value as typeof stand.status })}>
              {standStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Сделка
            <input value={stand.dealId ?? ""} placeholder={crm.dealId ?? "dealId"} onChange={(event) => updateStand(object.id, { dealId: event.target.value || null })} />
          </label>

          {stand.dealId ? <OpenDealButton dealId={stand.dealId} /> : null}

          <label>
            Комментарий
            <textarea value={stand.note} rows={5} onChange={(event) => updateStand(object.id, { note: event.target.value })} />
          </label>

          <dl className="stand-facts">
            <div>
              <dt>Площадь</dt>
              <dd>{area} м²</dd>
            </div>
            <div>
              <dt>Вершины</dt>
              <dd>{getObjectPoints(object).length}</dd>
            </div>
            <div>
              <dt>Текущая сделка</dt>
              <dd>{crm.dealId ?? "нет"}</dd>
            </div>
          </dl>

          <button className="primary-action" onClick={() => openStandPlan(object.id)}>
            <LayoutGrid size={16} aria-hidden />
            Открыть план стенда
          </button>

          {crm.dealId ? (
            <button onClick={() => updateStand(object.id, { dealId: crm.dealId, status: "reserved" })}>
              Забронировать на текущую сделку
            </button>
          ) : null}

          <button className="danger-action" onClick={() => deleteObject(object.id)}>
            <Trash2 size={16} />
            Удалить объект
          </button>
        </div>
      )}

      {/*
        Анкета идёт последней: она про стенд целиком и заполняется один раз,
        а карточка выбранного предмета нужна постоянно и должна быть на виду,
        без прокрутки.
      */}
      {plan?.kind === "stand" && plan.standObjectId ? <PassportForm standObjectId={plan.standObjectId} /> : null}
    </aside>
  );
}
