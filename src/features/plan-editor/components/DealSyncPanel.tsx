import { useRef, useState } from "react";
import { isBitrixEnvironment } from "../../../shared/crm/bitrixApi";
import { getCanvasObject, getObjectStandMeta } from "../../../shared/domain/project";
import type { CanvasObject } from "../../../shared/domain/types";
import { useEditorStore } from "../store/editorStore";

/**
 * Сделка площадки стенда, состояние обмена с ней и план в файле.
 *
 * Кнопок «Сохранить в сделку» и «Загрузить из сделки» нет: план
 * подтягивается из сделки при открытии и уходит обратно сам. Здесь видно,
 * куда сохраняется план, и понятная ошибка, если сохранить не удалось.
 *
 * План площадки можно сохранить в файл и загрузить из файла — чтобы перенести
 * расстановку на другой стенд или вернуть потерянную.
 */

const fileFormat = "stand-editor-stand-plan";

export function DealSyncPanel({ error }: { error: string | null }) {
  const project = useEditorStore((s) => s.project);
  const activeStandObjectId = useEditorStore((s) => s.activeStandObjectId);
  const activeFloorPlanId = useEditorStore((s) => s.activeFloorPlanId);
  const crm = useEditorStore((s) => s.crm);
  const replacePlanObjects = useEditorStore((s) => s.replacePlanObjects);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  const [armed, setArmed] = useState<CanvasObject[] | null>(null);

  // План сохраняется только в сделку своего стенда. Сделку, из которой открыто
  // приложение, не подставляем: так план чужого стенда уезжал в неё.
  const stand = activeStandObjectId ? getCanvasObject(project, activeStandObjectId) : null;
  const standMeta = stand ? getObjectStandMeta(stand) : null;
  const dealId = stand ? (standMeta?.dealId ?? null) : crm.dealId;
  const insideBitrix = isBitrixEnvironment();
  const planObjects = (project?.objects ?? []).filter((object) => object.floorPlanId === activeFloorPlanId && object.kind === "equipment");

  const saveToFile = () => {
    const payload = { format: fileFormat, version: 1, savedAt: new Date().toISOString(), stand: standMeta?.number ?? null, objects: planObjects };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `план-стенда-${(standMeta?.number ?? "стенд").replace(/[\\/:*?"<>|]/g, "-")}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setStatus({ text: `План сохранён в файл: ${planObjects.length} предм.` });
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; objects?: CanvasObject[] };
      if (parsed.format !== fileFormat || !Array.isArray(parsed.objects)) throw new Error("Это не файл плана площадки.");
      setArmed(parsed.objects.filter((object) => object?.kind === "equipment" && object.shape?.kind === "rectangle"));
      setStatus(null);
    } catch (readError) {
      setStatus({ text: readError instanceof Error ? readError.message : "Не удалось прочитать файл.", error: true });
    }
  };

  const applyFile = () => {
    if (!armed || !activeFloorPlanId) return;
    // Заменяет всё на площадке одним шагом истории — вернуть можно через Undo.
    replacePlanObjects(activeFloorPlanId, armed);
    setStatus({ text: `Загружено предметов: ${armed.length}. Отменить — Undo.` });
    setArmed(null);
  };

  return (
    <div className="panel-section deal-sync">
      <h2>Сделка</h2>

      <dl className="stand-facts">
        <div>
          <dt>Номер сделки</dt>
          <dd>{dealId ?? "не привязана"}</dd>
        </div>
      </dl>

      {error ? <p className="deal-sync__status is-error">{error}</p> : null}

      {insideBitrix && dealId && !error ? (
        <p className="deal-sync__hint">План стенда сохраняется в эту сделку сам, через пару секунд после каждой правки.</p>
      ) : null}

      {insideBitrix && !dealId ? (
        <p className="deal-sync__hint">
          Стенд без сделки — его план сохраняется вместе с картой выставки в портале и виден коллегам.
        </p>
      ) : null}

      {!insideBitrix ? (
        <p className="deal-sync__hint">
          Приложение открыто напрямую, а не из портала, поэтому план сохраняется только в этом браузере.
        </p>
      ) : null}

      <h2>План в файле</h2>
      <button type="button" onClick={saveToFile} disabled={planObjects.length === 0}>
        Сохранить план в файл
      </button>
      <button type="button" onClick={() => fileInput.current?.click()}>
        Загрузить план из файла
      </button>
      <input ref={fileInput} type="file" accept="application/json,.json" className="visually-hidden" onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} />

      {armed ? (
        <>
          <p className="deal-sync__status is-error">
            В файле {armed.length} предм. Они заменят всё, что сейчас стоит на площадке ({planObjects.length} предм.).
          </p>
          <button type="button" className="danger-action" onClick={applyFile}>
            Заменить расстановку
          </button>
          <button type="button" onClick={() => setArmed(null)}>
            Отмена
          </button>
        </>
      ) : null}

      {status ? <p className={status.error ? "deal-sync__status is-error" : "deal-sync__hint"}>{status.text}</p> : null}
    </div>
  );
}
