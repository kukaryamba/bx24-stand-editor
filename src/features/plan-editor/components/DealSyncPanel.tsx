import { useState } from "react";
import { isBitrixEnvironment } from "../../../shared/crm/bitrixApi";
import { buildStandPlanPayload, loadStandPlan, payloadSizeKb, saveStandPlan } from "../../../shared/crm/standPlanRepository";
import { useEditorStore } from "../store/editorStore";

type SyncState =
  | { kind: "idle" }
  | { kind: "busy"; text: string }
  | { kind: "done"; text: string }
  | { kind: "error"; text: string };

/**
 * Обмен планом стенда с карточкой сделки.
 *
 * Вне Битрикс24 панель показывает, почему сохранение недоступно, — так видно
 * разницу между «не настроено» и «сломалось».
 */
export function DealSyncPanel() {
  const [state, setState] = useState<SyncState>({ kind: "idle" });
  const project = useEditorStore((s) => s.project);
  const activeFloorPlanId = useEditorStore((s) => s.activeFloorPlanId);
  const crm = useEditorStore((s) => s.crm);
  const loadProject = useEditorStore((s) => s.loadProject);

  const insideBitrix = isBitrixEnvironment();
  const canSync = insideBitrix && Boolean(crm.dealId);

  const handleSave = async () => {
    if (!project || !crm.dealId) return;

    const payload = buildStandPlanPayload(project, activeFloorPlanId);
    setState({ kind: "busy", text: "Сохраняю в сделку..." });

    try {
      await saveStandPlan(crm.dealId, payload);
      setState({
        kind: "done",
        text: `Сохранено: ${payload.objects.length} предм. (${payloadSizeKb(payload)} КБ)`,
      });
    } catch (error) {
      setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось сохранить план." });
    }
  };

  const handleLoad = async () => {
    if (!project || !crm.dealId) return;
    setState({ kind: "busy", text: "Загружаю из сделки..." });

    try {
      const payload = await loadStandPlan(crm.dealId);
      if (!payload) {
        setState({ kind: "done", text: "В сделке пока нет сохранённого плана." });
        return;
      }

      // Предметы из сделки заменяют текущие, стенды общего плана не трогаем.
      const withoutFurniture = project.objects.filter((object) => object.kind !== "equipment");
      loadProject({ ...project, objects: [...withoutFurniture, ...payload.objects] });
      setState({ kind: "done", text: `Загружено предметов: ${payload.objects.length}` });
    } catch (error) {
      setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось загрузить план." });
    }
  };

  return (
    <div className="panel-section deal-sync">
      <h2>Сделка</h2>

      <dl className="stand-facts">
        <div>
          <dt>Источник</dt>
          <dd>{insideBitrix ? "Битрикс24" : "локальный режим"}</dd>
        </div>
        <div>
          <dt>Номер сделки</dt>
          <dd>{crm.dealId ?? "не определён"}</dd>
        </div>
      </dl>

      <button className="primary-action" onClick={handleSave} disabled={!canSync || state.kind === "busy"}>
        Сохранить в сделку
      </button>

      <button onClick={handleLoad} disabled={!canSync || state.kind === "busy"}>
        Загрузить из сделки
      </button>

      {state.kind !== "idle" ? (
        <p className={state.kind === "error" ? "deal-sync__status is-error" : "deal-sync__status"}>{state.text}</p>
      ) : null}

      {!insideBitrix ? (
        <p className="deal-sync__hint">
          Приложение открыто напрямую, а не из карточки сделки, поэтому портал недоступен. План сохраняется только в этом браузере.
        </p>
      ) : null}

      {insideBitrix && !crm.dealId ? (
        <p className="deal-sync__hint">Не удалось определить сделку. Откройте приложение из карточки сделки.</p>
      ) : null}
    </div>
  );
}
