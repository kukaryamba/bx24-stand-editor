import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Grid2x2, Hand, ImageUp, MousePointer2, PenTool, Redo2, Save, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { DealSyncPanel } from "../features/plan-editor/components/DealSyncPanel";
import { FurniturePalette } from "../features/plan-editor/components/FurniturePalette";
import { InstallScreen } from "../features/plan-editor/components/InstallScreen";
import { PlanCanvas } from "../features/plan-editor/components/PlanCanvas";
import { PropertiesPanel } from "../features/plan-editor/components/PropertiesPanel";
import { SpecificationDialog } from "../features/plan-editor/components/SpecificationDialog";
import { StandNavigator } from "../features/plan-editor/components/StandNavigator";
import { exportPlanToPng } from "../features/plan-editor/exportPlanImage";
import { Toolbar } from "../features/plan-editor/components/Toolbar";
import { useCategoryAccess } from "../features/plan-editor/hooks/useCategoryAccess";
import { useEditorStore } from "../features/plan-editor/store/editorStore";
import { defaultStandSizeM, formatMeters, getFloorPlan, getFloorPlanKind, getFloorPlanLayers, getStandSizeMeters } from "../shared/domain/project";
import { detectGridStep } from "../shared/geometry/detectGrid";
import { standTemplates } from "../shared/domain/standTemplates";
import { dealTabPlacement } from "../shared/crm/bitrixApi";
import { bitrixCrmProvider } from "../shared/crm/bitrixCrmProvider";
import type { EditorScreen } from "../shared/domain/types";
import { localPlanRepository } from "../shared/storage/localPlanRepository";

export function App() {
  const [startupError, setStartupError] = useState<string | null>(null);
  const [showSpecification, setShowSpecification] = useState(false);
  const [skipInstall, setSkipInstall] = useState(false);
  const [gridNotice, setGridNotice] = useState<string | null>(null);
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
  const showFloorPlanKind = useEditorStore((state) => state.showFloorPlanKind);
  const resizeStandPlan = useEditorStore((state) => state.resizeStandPlan);
  const applyStandTemplate = useEditorStore((state) => state.applyStandTemplate);
  const setFloorPlanBackground = useEditorStore((state) => state.setFloorPlanBackground);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const project = useEditorStore((state) => state.project);
  const crm = useEditorStore((state) => state.crm);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const isDirty = useEditorStore((state) => state.isDirty);
  const historyPastLength = useEditorStore((state) => state.historyPast.length);
  const historyFutureLength = useEditorStore((state) => state.historyFuture.length);
  const categoryAccess = useCategoryAccess(crm.provider === "bitrix24" && crm.placement === dealTabPlacement, crm.dealId);
  const activePlan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const planLayers = useMemo(() => getFloorPlanLayers(project, activeFloorPlanId), [activeFloorPlanId, project]);
  // Экран не хранится отдельно: он определяется тем, какой план открыт.
  // Иначе переход в стенд с карты не переключал бы панели.
  const screen: EditorScreen = getFloorPlanKind(activePlan);
  const standSize = useMemo(
    () => (activePlan && screen === "stand" ? getStandSizeMeters(activePlan) : defaultStandSizeM),
    [activePlan, screen],
  );

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

  const openScreen = (next: EditorScreen) => {
    showFloorPlanKind(next);
    fitToScreen();
  };

  const handleExportPng = () => {
    if (!activePlan) return;

    try {
      exportPlanToPng(activePlan);
      setStartupError(null);
    } catch (error) {
      setStartupError(error instanceof Error ? error.message : "Не удалось сохранить картинку плана.");
    }
  };

  const handleSave = async () => {
    const snapshot = useEditorStore.getState().createSnapshot();
    await localPlanRepository.save(snapshot);
    saveWorkspace();
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activePlan) return;

    const dataUrl = await readFileAsDataUrl(file);
    const image = await readImage(dataUrl);
    const size = { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };

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

    // Планы чертят по сетке, и её шаг на картинке — это и есть масштаб.
    const detection = detectGridStep(image);
    if (detection) {
      updateFloorPlanGrid(activePlan.id, { cellSizePx: detection.cellSizePx, metersPerCell: 1 });
      setGridNotice(
        `Масштаб определён по сетке чертежа: ${formatMeters(detection.cellSizePx)} пикселя на метр. Проверьте по стенду с известной площадью и поправьте, если клетка чертежа не равна метру.`,
      );
    } else {
      setGridNotice("Сетку на картинке найти не удалось — задайте масштаб вручную.");
    }

    // План только что сменил размер — показываем его целиком, иначе он уезжает за край.
    fitToScreen();
    event.target.value = "";
  };

  // Приложение открыто в портале, но не во вкладке сделки — значит из списка
  // интеграций или при установке. Сначала встраивание, редактор по кнопке.
  if (crm.provider === "bitrix24" && crm.placement !== dealTabPlacement && !skipInstall) {
    return <InstallScreen onContinue={() => setSkipInstall(true)} />;
  }

  if (categoryAccess.kind === "checking") {
    return <div className="empty-state">Проверяю воронку сделки...</div>;
  }

  if (categoryAccess.kind === "blocked") {
    return (
      <div className="install-screen">
        <div className="install-card">
          <h1>Стенды ведутся в другой воронке</h1>
          <p>
            Эта сделка не из воронки «{categoryAccess.allowedName}», а планы стендов ведутся только в ней. Вкладка
            появляется во всех сделках: Битрикс24 не умеет показывать встроенное приложение выборочно.
          </p>
          <p>Если сделка должна вести стенд, перенесите её в нужную воронку.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="left-panel" aria-label="Панель инструментов">
        <div className="brand">
          <span className="brand__kicker">Bitrix24 Local App</span>
          <h1>{screen === "expo" ? "План выставки" : activePlan?.title ?? "План стенда"}</h1>
        </div>

        <div className="mode-switch" role="group" aria-label="Экран">
          <button className={screen === "expo" ? "is-active" : ""} onClick={() => openScreen("expo")}>
            Общий план
          </button>
          <button className={screen === "stand" ? "is-active" : ""} onClick={() => openScreen("stand")}>
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
            { icon: Download, label: "Скачать PNG", onClick: handleExportPng },
            { icon: Save, label: "Сохранить JSON", tone: "primary", onClick: handleSave },
          ]}
        />
        <input ref={backgroundUploadRef} type="file" accept="image/png,image/jpeg" className="visually-hidden" onChange={handleBackgroundUpload} />

        <div className="panel-section">
          <h2>{activePlan?.title ?? "План"}</h2>
          <p>{startupError ?? gridNotice ?? "Сетка обязательна: все вершины стендов привязываются к узлам. Новый стенд создаётся кликами по сетке, замыкается кликом по первой точке."}</p>
        </div>

        {activePlan && screen === "stand" ? (
          <div className="panel-section grid-settings">
            <h2>Размер стенда</h2>
            <div className="stand-size">
              <label>
                Ширина, м
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={0.5}
                  value={standSize.width}
                  onChange={(event) => resizeStandPlan(Number(event.target.value), standSize.depth)}
                />
              </label>
              <label>
                Глубина, м
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={0.5}
                  value={standSize.depth}
                  onChange={(event) => resizeStandPlan(standSize.width, Number(event.target.value))}
                />
              </label>
            </div>

            <div className="stand-presets">
              {standPresets.map((preset) => (
                <button
                  key={`${preset.width}x${preset.depth}`}
                  type="button"
                  className={standSize.width === preset.width && standSize.depth === preset.depth ? "is-active" : ""}
                  onClick={() => resizeStandPlan(preset.width, preset.depth)}
                >
                  {preset.width} x {preset.depth}
                </button>
              ))}
            </div>

            <p>Площадь стенда: {(standSize.width * standSize.depth).toFixed(1).replace(".", ",")} м². Клетка сетки — 1 x 1 м.</p>

            <h2>Схема стенда</h2>
            <div className="stand-templates">
              {standTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyStandTemplate(template.id)}
                  title={template.description}
                >
                  <strong>{template.title}</strong>
                  <span>{template.description}</span>
                </button>
              ))}
            </div>
            <p>Схема расставляет стены по периметру. Мебель остаётся на месте, прежние стены заменяются.</p>
          </div>
        ) : null}

        {activePlan && screen === "expo" ? (
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

        {screen === "stand" ? <StandNavigator /> : null}
        {screen === "stand" ? <FurniturePalette /> : null}

        {screen === "stand" ? (
          <div className="panel-section">
            <button className="primary-action" onClick={() => setShowSpecification(true)}>
              <FileText size={16} aria-hidden />
              Спецификация
            </button>
          </div>
        ) : null}

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

      {showSpecification ? <SpecificationDialog onClose={() => setShowSpecification(false)} /> : null}
    </div>
  );
}

/** Типовые размеры выставочных стендов. */
const standPresets = [
  { width: 3, depth: 3 },
  { width: 4, depth: 3 },
  { width: 6, depth: 3 },
  { width: 6, depth: 4 },
  { width: 9, depth: 6 },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл изображения."));
    reader.readAsDataURL(file);
  });
}

function readImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось прочитать фоновое изображение."));
    image.src = src;
  });
}
