import { useEffect, useMemo, useRef, useState } from "react";
import { Grid2x2, Hand, ImageUp, MousePointer2, PenTool, Redo2, Save, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { DealSyncPanel } from "../features/plan-editor/components/DealSyncPanel";
import { FurniturePalette } from "../features/plan-editor/components/FurniturePalette";
import { PlanCanvas } from "../features/plan-editor/components/PlanCanvas";
import { PropertiesPanel } from "../features/plan-editor/components/PropertiesPanel";
import { Toolbar } from "../features/plan-editor/components/Toolbar";
import { useEditorStore } from "../features/plan-editor/store/editorStore";
import { getFloorPlan, getFloorPlanLayers } from "../shared/domain/project";
import { bitrixCrmProvider } from "../shared/crm/bitrixCrmProvider";
import type { EditorScreen } from "../shared/domain/types";
import { localPlanRepository } from "../shared/storage/localPlanRepository";

export function App() {
  const [startupError, setStartupError] = useState<string | null>(null);
  const [screen, setScreen] = useState<EditorScreen>("expo");
  const backgroundUploadRef = useRef<HTMLInputElement | null>(null);
  const mode = useEditorStore((state) => state.mode);
  const tool = useEditorStore((state) => state.tool);
  const loadProject = useEditorStore((state) => state.loadProject);
  const setCrmContext = useEditorStore((state) => state.setCrmContext);
  const saveWorkspace = useEditorStore((state) => state.saveWorkspace);
  const setTool = useEditorStore((state) => state.setTool);
  const setMode = useEditorStore((state) => state.setMode);
  const zoomIn = useEditorStore((state) => state.zoomIn);
  const zoomOut = useEditorStore((state) => state.zoomOut);
  const fitToScreen = useEditorStore((state) => state.fitToScreen);
  const updateFloorPlanGrid = useEditorStore((state) => state.updateFloorPlanGrid);
  const setFloorPlanBackground = useEditorStore((state) => state.setFloorPlanBackground);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const isDirty = useEditorStore((state) => state.isDirty);
  const historyPastLength = useEditorStore((state) => state.historyPast.length);
  const historyFutureLength = useEditorStore((state) => state.historyFuture.length);
  const activePlan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const planLayers = useMemo(() => getFloorPlanLayers(project, activeFloorPlanId), [activeFloorPlanId, project]);

  useEffect(() => {
    void localPlanRepository.load().then(loadProject).catch((error: unknown) => {
      setStartupError(error instanceof Error ? error.message : "Не удалось загрузить данные приложения.");
    });
    void bitrixCrmProvider.init().then(setCrmContext).catch((error: unknown) => {
      console.warn("CRM init failed. Local mode is active.", error);
    });
  }, [loadProject, setCrmContext]);

  useEffect(() => {
    if (!project?.settings.autosave || !isDirty) return;

    const timer = window.setTimeout(() => {
      void localPlanRepository.save(project).then(() => saveWorkspace());
    }, 500);

    return () => window.clearTimeout(timer);
  }, [isDirty, project, saveWorkspace]);

  const handleSave = async () => {
    const snapshot = useEditorStore.getState().createSnapshot();
    await localPlanRepository.save(snapshot);
    saveWorkspace();
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activePlan) return;

    const dataUrl = await readFileAsDataUrl(file);
    const size = await readImageSize(dataUrl);
    setFloorPlanBackground(
      activePlan.id,
      {
        name: file.name,
        imageUrl: dataUrl,
        width: size.width,
        height: size.height,
      },
      size,
    );
    event.target.value = "";
  };

  return (
    <div className="app-shell">
      <aside className="left-panel" aria-label="Панель инструментов">
        <div className="brand">
          <span className="brand__kicker">Bitrix24 Local App</span>
          <h1>{screen === "expo" ? "План выставки" : "План стенда"}</h1>
        </div>

        <div className="mode-switch" role="group" aria-label="Экран">
          <button className={screen === "expo" ? "is-active" : ""} onClick={() => setScreen("expo")}>
            Общий план
          </button>
          <button className={screen === "stand" ? "is-active" : ""} onClick={() => setScreen("stand")}>
            План стенда
          </button>
        </div>

        <div className="mode-switch" role="group" aria-label="Режим работы">
          <button className={mode === "admin" ? "is-active" : ""} onClick={() => setMode("admin")}>
            Администратор
          </button>
          <button className={mode === "manager" ? "is-active" : ""} onClick={() => setMode("manager")}>
            Менеджер
          </button>
        </div>

        <Toolbar
          items={[
            { icon: MousePointer2, label: "Выбор", active: tool === "select", onClick: () => setTool("select") },
            { icon: Hand, label: "Панорама", active: tool === "pan", onClick: () => setTool("pan") },
            { icon: PenTool, label: "Полигон", active: tool === "polygon", onClick: () => setTool("polygon") },
            { icon: ImageUp, label: "Загрузить план", onClick: () => backgroundUploadRef.current?.click() },
            {
              icon: Grid2x2,
              label: activePlan?.grid.enabled ? "Скрыть сетку" : "Показать сетку",
              onClick: () => {
                if (!activePlan) return;
                updateFloorPlanGrid(activePlan.id, { enabled: !activePlan.grid.enabled });
              },
            },
            { icon: Undo2, label: "Undo", onClick: undo, disabled: historyPastLength === 0 },
            { icon: Redo2, label: "Redo", onClick: redo, disabled: historyFutureLength === 0 },
            { icon: ZoomIn, label: "Fit", onClick: fitToScreen },
            { icon: ZoomIn, label: "Увеличить", onClick: zoomIn },
            { icon: ZoomOut, label: "Уменьшить", onClick: zoomOut },
            { icon: Save, label: "Сохранить JSON", tone: "primary", onClick: handleSave },
          ]}
        />
        <input ref={backgroundUploadRef} type="file" accept="image/png,image/jpeg" className="visually-hidden" onChange={handleBackgroundUpload} />

        <div className="panel-section">
          <h2>{activePlan?.title ?? "План"}</h2>
          <p>{startupError ?? "Сетка обязательна: все вершины стендов привязываются к узлам. Новый стенд создаётся кликами по сетке, замыкается кликом по первой точке."}</p>
        </div>

        {activePlan ? (
          <div className="panel-section grid-settings">
            <h2>Масштаб сетки</h2>
            <label>
              1 метр на плане
              <input
                type="number"
                min={4}
                max={240}
                step={1}
                value={activePlan.grid.cellSizePx}
                onChange={(event) => updateFloorPlanGrid(activePlan.id, { cellSizePx: Number(event.target.value) || activePlan.grid.cellSizePx, metersPerCell: 1 })}
              />
            </label>
            <input type="range" min={4} max={120} step={1} value={activePlan.grid.cellSizePx} onChange={(event) => updateFloorPlanGrid(activePlan.id, { cellSizePx: Number(event.target.value), metersPerCell: 1 })} />
            <p>Одна клетка сетки равна 1 x 1 м. Подберите размер клетки в пикселях так, чтобы сетка совпала с масштабом фоновой картинки павильона.</p>
          </div>
        ) : null}

        {screen === "stand" ? <FurniturePalette /> : null}
        {screen === "stand" ? <DealSyncPanel /> : null}

        {planLayers.length > 0 ? (
          <div className="panel-section layer-list">
            <h2>Слои</h2>
            {planLayers.map((layer) => (
              <div key={layer.id} className="layer-list__item">
                <span>{layer.name}</span>
                <span>{layer.visible ? "Виден" : "Скрыт"}</span>
              </div>
            ))}
          </div>
        ) : null}
      </aside>

      <main className="canvas-host">
        <PlanCanvas />
      </main>

      <PropertiesPanel />
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл изображения."));
    reader.readAsDataURL(file);
  });
}

function readImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.width, height: image.height });
    image.onerror = () => reject(new Error("Не удалось определить размер фонового изображения."));
    image.src = src;
  });
}
