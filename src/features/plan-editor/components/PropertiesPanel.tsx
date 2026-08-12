import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getObjectFurnitureMeta, getObjectPoints, getObjectStandMeta } from "../../../shared/domain/project";
import { statusLabels } from "../../../shared/domain/status";
import { polygonArea } from "../../../shared/geometry/polygon";
import { standStatuses, useEditorStore } from "../store/editorStore";

export function PropertiesPanel() {
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const crm = useEditorStore((state) => state.crm);
  const validationMessage = useEditorStore((state) => state.validationMessage);
  const isDirty = useEditorStore((state) => state.isDirty);
  const updateStand = useEditorStore((state) => state.updateStand);
  const deleteObject = useEditorStore((state) => state.deleteObject);
  const rotateFurniture = useEditorStore((state) => state.rotateFurniture);
  const plan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const object = useMemo(() => getCanvasObject(project, selectedObjectId), [project, selectedObjectId]);
  const stand = object && object.kind === "stand" ? getObjectStandMeta(object) : null;
  const furniture = object ? getObjectFurnitureMeta(object) : null;
  const furnitureItem = furniture ? getFurnitureItem(furniture.itemId) : undefined;

  const area = stand && plan && object ? polygonArea(getObjectPoints(object), plan.grid.metersPerCell, plan.grid.cellSizePx) : 0;

  return (
    <aside className="right-panel" aria-label="Панель свойств">
      <div className="panel-heading">
        <span>{isDirty ? "Есть несохранённые изменения" : "JSON синхронизирован"}</span>
        <strong>{crm.provider === "bitrix24" ? "Bitrix24" : "Local"}</strong>
      </div>

      {validationMessage ? <div className="validation-message">{validationMessage}</div> : null}

      {object && furniture && furnitureItem ? (
        <div className="property-form">
          <h2>Предмет</h2>

          <dl className="stand-facts">
            <div>
              <dt>Название</dt>
              <dd>{furnitureItem.title}</dd>
            </div>
            <div>
              <dt>Размер</dt>
              <dd>
                {String(furnitureItem.widthM).replace(".", ",")} x {String(furnitureItem.depthM).replace(".", ",")} м
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
      ) : !stand || !object ? (
        <div className="empty-panel">
          <h2>Объект не выбран</h2>
          <p>Выберите объект на плане или создайте новый стенд. Архитектура уже готова для колонн, проходов и других типов объектов.</p>
        </div>
      ) : (
        <div className="property-form">
          <h2>Карточка объекта</h2>

          <label>
            Номер
            <input value={stand.number} onChange={(event) => updateStand(object.id, { number: event.target.value })} />
          </label>

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

          {crm.dealId ? (
            <button className="primary-action" onClick={() => updateStand(object.id, { dealId: crm.dealId, status: "reserved" })}>
              Забронировать на текущую сделку
            </button>
          ) : null}

          <button className="danger-action" onClick={() => deleteObject(object.id)}>
            <Trash2 size={16} />
            Удалить объект
          </button>
        </div>
      )}
    </aside>
  );
}
