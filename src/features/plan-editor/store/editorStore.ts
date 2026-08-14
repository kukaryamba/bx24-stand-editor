import { create } from "zustand";
import { getFurnitureItem } from "../../../shared/domain/furniture";
import { buildTemplateWalls, standTemplates, type StandTemplateId } from "../../../shared/domain/standTemplates";
import {
  createStandFloorPlan,
  defaultStandSizeM,
  findFloorPlanByKind,
  findStandPlan,
  formatMeters,
  getCanvasObject,
  getFloorPlan,
  getFloorPlanObjects,
  getObjectFurnitureMeta,
  getObjectPoints,
  getObjectStandMeta,
  getStandPlans,
  withPolygonPoints,
} from "../../../shared/domain/project";
import type {
  AppMode,
  CanvasObject,
  CrmContext,
  EditorTool,
  ExhibitionProject,
  FloorPlan,
  FloorPlanKind,
  LayerKind,
  Point,
  StandStatus,
} from "../../../shared/domain/types";
import { polygonBounds, validateStandPolygon } from "../../../shared/geometry/polygon";

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

/** Размер видимой области холста на экране. Без него план не во что вписывать. */
type StageSize = {
  width: number;
  height: number;
};

/**
 * Пределы масштаба. Нижний специально мелкий: план павильона бывает
 * в несколько тысяч пикселей, а холст зажат между панелями.
 */
export const minScale = 0.05;
export const maxScale = 3;

/** Поля вокруг плана, когда он вписан в холст. */
const fitPadding = 24;

type EditorState = {
  project: ExhibitionProject | null;
  activeFloorPlanId: string | null;
  /** Стенд, площадка которого сейчас открыта. */
  activeStandObjectId: string | null;
  selectedObjectId: string | null;
  draftPoints: Point[];
  mode: AppMode;
  tool: EditorTool;
  viewport: Viewport;
  stageSize: StageSize;
  crm: CrmContext;
  validationMessage: string | null;
  isDirty: boolean;
  historyPast: ExhibitionProject[];
  historyFuture: ExhibitionProject[];
  loadProject: (project: ExhibitionProject) => void;
  createSnapshot: () => ExhibitionProject;
  saveWorkspace: () => void;
  setCrmContext: (crm: CrmContext) => void;
  setMode: (mode: AppMode) => void;
  setTool: (tool: EditorTool) => void;
  selectObject: (objectId: string | null) => void;
  addDraftPoint: (point: Point) => void;
  clearDraft: () => void;
  createStandFromDraft: () => void;
  updateStand: (objectId: string, patch: { number?: string; status?: StandStatus; dealId?: string | null; note?: string; points?: Point[] }) => void;
  updateFloorPlanGrid: (floorPlanId: string, patch: Partial<FloorPlan["grid"]>) => void;
  setFloorPlanBackground: (floorPlanId: string, background: FloorPlan["background"], size?: Pick<FloorPlan, "width" | "height">) => void;
  deleteObject: (objectId: string) => void;
  addFurniture: (itemId: string, position: Point) => void;
  moveFurniture: (objectId: string, origin: Point) => void;
  rotateFurniture: (objectId: string) => void;
  /** Переключает редактор между картой павильона и площадкой стенда. */
  showFloorPlanKind: (kind: FloorPlanKind) => void;
  /** Открывает площадку выбранного стенда, при необходимости заводит её. */
  openStandPlan: (standObjectId: string) => void;
  /** Возвращает на карту выставки. */
  backToExpoPlan: () => void;
  /** Меняет габариты площадки стенда в метрах. */
  resizeStandPlan: (widthM: number, depthM: number) => void;
  /** Расставляет стены по типовой схеме, заменяя прежние. */
  applyStandTemplate: (templateId: StandTemplateId) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  setStageSize: (size: StageSize) => void;
  undo: () => void;
  redo: () => void;
};

const defaultCrm: CrmContext = { provider: "mock", dealId: null, userId: null };
const defaultViewport: Viewport = { scale: 0.45, x: 24, y: 24 };
const defaultStageSize: StageSize = { width: 1100, height: 760 };

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  activeFloorPlanId: null,
  activeStandObjectId: null,
  selectedObjectId: null,
  draftPoints: [],
  mode: "admin",
  tool: "select",
  viewport: defaultViewport,
  stageSize: defaultStageSize,
  crm: defaultCrm,
  validationMessage: null,
  isDirty: false,
  historyPast: [] as ExhibitionProject[],
  historyFuture: [] as ExhibitionProject[],

  loadProject: (project) => set({ project, activeFloorPlanId: project.floorPlans[0]?.id ?? null, historyPast: [], historyFuture: [], isDirty: false }),
  createSnapshot: () => {
    const project = get().project;
    if (!project) throw new Error("Нет данных для сохранения.");
    return project;
  },
  saveWorkspace: () => set({ isDirty: false }),
  setCrmContext: (crm) => set({ crm }),
  setMode: (mode) => set({ mode, selectedObjectId: null, draftPoints: [], tool: mode === "manager" ? "select" : get().tool }),
  setTool: (tool) => set({ tool, draftPoints: [], validationMessage: null }),
  selectObject: (objectId) => set({ selectedObjectId: objectId, tool: "select", draftPoints: [] }),
  addDraftPoint: (point) => {
    const floorPlan = getFloorPlan(get().project, get().activeFloorPlanId);
    if (!floorPlan) return;

    const draftPoints = [...get().draftPoints, point];
    const validationMessage =
      draftPoints.length > 2 ? validateStandPolygon(draftPoints, floorPlan, getFloorPlanObjects(get().project, floorPlan.id).filter((item) => item.kind === "stand")) : null;

    set({ draftPoints, validationMessage });
  },
  clearDraft: () => set({ draftPoints: [], validationMessage: null }),
  createStandFromDraft: () => {
    const state = get();
    const floorPlan = getFloorPlan(state.project, state.activeFloorPlanId);
    const project = state.project;
    if (!floorPlan || !project) return;

    const points = state.draftPoints;
    const validationMessage = validateStandPolygon(points, floorPlan, getFloorPlanObjects(project, floorPlan.id).filter((item) => item.kind === "stand"));
    if (validationMessage) {
      set({ validationMessage });
      return;
    }

    const objectId = createId("object");
    const object: CanvasObject = {
      id: objectId,
      floorPlanId: floorPlan.id,
      layerId: getStandLayerId(project, floorPlan.id),
      kind: "stand",
      name: `Стенд ${project.objects.length + 1}`,
      shape: { kind: "polygon", points },
      meta: {
        stand: {
          number: `Новый-${project.objects.length + 1}`,
          status: "available",
          dealId: null,
          note: "",
        },
      },
    };

    commitProject(set, get, {
      ...project,
      objects: [...project.objects, object],
    });
    set({ selectedObjectId: objectId, draftPoints: [], tool: "select", validationMessage: null });
  },
  updateStand: (objectId, patch) => {
    const state = get();
    const project = state.project;
    const object = getCanvasObject(project, objectId);
    if (!project || !object || object.kind !== "stand") return;

    const floorPlan = getFloorPlan(project, object.floorPlanId);
    if (!floorPlan) return;

    let nextObject = object;
    if (patch.points) {
      const validationMessage = validateStandPolygon(
        patch.points,
        floorPlan,
        getFloorPlanObjects(project, floorPlan.id).filter((item) => item.kind === "stand"),
        objectId,
      );
      if (validationMessage) {
        set({ validationMessage });
        return;
      }

      nextObject = withPolygonPoints(nextObject, patch.points);
    }

    const standMeta = getObjectStandMeta(nextObject);
    nextObject = {
      ...nextObject,
      name: patch.number ?? nextObject.name,
      meta: {
        ...nextObject.meta,
        stand: standMeta
          ? {
              ...standMeta,
              number: patch.number ?? standMeta.number,
              status: patch.status ?? standMeta.status,
              dealId: patch.dealId === undefined ? standMeta.dealId : patch.dealId,
              note: patch.note ?? standMeta.note,
            }
          : undefined,
      },
    };

    commitProject(set, get, {
      ...project,
      objects: project.objects.map((item) => (item.id === objectId ? nextObject : item)),
    });
    set({ validationMessage: null });
  },
  updateFloorPlanGrid: (floorPlanId, patch) => {
    const project = get().project;
    if (!project) return;

    commitProject(set, get, {
      ...project,
      floorPlans: project.floorPlans.map((plan) => (plan.id === floorPlanId ? { ...plan, grid: { ...plan.grid, ...patch } } : plan)),
    });
    set({ draftPoints: [], validationMessage: null });
  },
  setFloorPlanBackground: (floorPlanId, background, size) => {
    const project = get().project;
    if (!project) return;

    commitProject(set, get, {
      ...project,
      floorPlans: project.floorPlans.map((plan) =>
        plan.id === floorPlanId
          ? {
              ...plan,
              background,
              width: size?.width ?? plan.width,
              height: size?.height ?? plan.height,
            }
          : plan,
      ),
    });
  },
  deleteObject: (objectId) => {
    const project = get().project;
    if (!project) return;

    commitProject(set, get, {
      ...project,
      objects: project.objects.filter((item) => item.id !== objectId),
    });
    set({ selectedObjectId: null });
  },
  addFurniture: (itemId, position) => {
    const state = get();
    const project = state.project;
    const floorPlan = getFloorPlan(project, state.activeFloorPlanId);
    const item = getFurnitureItem(itemId);
    if (!project || !floorPlan || !item) return;

    // Габариты в метрах переводим в пиксели плана через масштаб сетки.
    const pxPerMeter = floorPlan.grid.cellSizePx / floorPlan.grid.metersPerCell;
    const objectId = createId("furniture");

    const object: CanvasObject = {
      id: objectId,
      floorPlanId: floorPlan.id,
      layerId: getLayerId(project, floorPlan.id, "stands"),
      kind: "equipment",
      name: item.title,
      shape: {
        kind: "rectangle",
        origin: position,
        width: item.widthM * pxPerMeter,
        height: item.depthM * pxPerMeter,
      },
      meta: {
        furniture: { itemId: item.id, rotation: 0 },
      },
    };

    commitProject(set, get, { ...project, objects: [...project.objects, object] });
    set({ selectedObjectId: objectId, tool: "select" });
  },
  moveFurniture: (objectId, origin) => {
    const project = get().project;
    const object = getCanvasObject(project, objectId);
    if (!project || !object || object.shape.kind !== "rectangle") return;

    const nextObject: CanvasObject = { ...object, shape: { ...object.shape, origin } };
    commitProject(set, get, {
      ...project,
      objects: project.objects.map((item) => (item.id === objectId ? nextObject : item)),
    });
  },
  rotateFurniture: (objectId) => {
    const project = get().project;
    const object = getCanvasObject(project, objectId);
    const meta = object ? getObjectFurnitureMeta(object) : null;
    if (!project || !object || !meta) return;

    const nextObject: CanvasObject = {
      ...object,
      meta: { ...object.meta, furniture: { ...meta, rotation: (meta.rotation + 90) % 360 } },
    };
    commitProject(set, get, {
      ...project,
      objects: project.objects.map((item) => (item.id === objectId ? nextObject : item)),
    });
  },
  showFloorPlanKind: (kind) => {
    const state = get();
    const project = state.project;
    if (!project) return;

    if (kind === "expo") {
      const expoPlan = findFloorPlanByKind(project, "expo");
      if (expoPlan) {
        set({ activeFloorPlanId: expoPlan.id, selectedObjectId: null, draftPoints: [], validationMessage: null });
      }
      return;
    }

    // На экран стенда попадаем через конкретный стенд: последний открытый,
    // иначе первый заведённый, иначе первый стенд на карте выставки.
    const plans = getStandPlans(project);
    const target = state.activeStandObjectId ?? plans[0]?.standObjectId ?? getFloorPlanObjects(project, findFloorPlanByKind(project, "expo")?.id ?? null).find((object) => object.kind === "stand")?.id;

    if (!target) {
      set({ validationMessage: "На карте выставки пока нет ни одного стенда." });
      return;
    }

    get().openStandPlan(target);
  },
  openStandPlan: (standObjectId) => {
    const project = get().project;
    if (!project) return;

    const existing = findStandPlan(project, standObjectId);
    if (existing) {
      set({
        activeFloorPlanId: existing.id,
        activeStandObjectId: standObjectId,
        selectedObjectId: null,
        draftPoints: [],
        validationMessage: null,
      });
      return;
    }

    const stand = getCanvasObject(project, standObjectId);
    if (!stand || stand.kind !== "stand") return;

    // Габариты площадки берём с карты выставки: как стенд нарисован, так и раскрывается.
    const expoPlan = getFloorPlan(project, stand.floorPlanId);
    const bounds = polygonBounds(getObjectPoints(stand));
    const pxPerMeter = expoPlan ? expoPlan.grid.cellSizePx / expoPlan.grid.metersPerCell : 1;
    const widthM = roundHalf(bounds.width / pxPerMeter) || defaultStandSizeM.width;
    const depthM = roundHalf(bounds.height / pxPerMeter) || defaultStandSizeM.depth;

    const exhibitionId = expoPlan?.exhibitionId ?? project.exhibitions[0]?.id ?? "expo-local";
    const { plan, layers } = createStandFloorPlan(
      exhibitionId,
      standObjectId,
      getObjectStandMeta(stand)?.number ?? stand.name,
      widthM,
      depthM,
    );

    commitProject(set, get, {
      ...project,
      floorPlans: [...project.floorPlans, plan],
      layers: [...project.layers, ...layers],
    });
    set({
      activeFloorPlanId: plan.id,
      activeStandObjectId: standObjectId,
      selectedObjectId: null,
      draftPoints: [],
      validationMessage: null,
    });
  },
  backToExpoPlan: () => {
    const project = get().project;
    const expoPlan = findFloorPlanByKind(project, "expo");
    if (!expoPlan) return;

    set({ activeFloorPlanId: expoPlan.id, selectedObjectId: null, draftPoints: [], validationMessage: null });
  },
  resizeStandPlan: (widthM, depthM) => {
    const state = get();
    const project = state.project;
    const plan = getFloorPlan(project, state.activeFloorPlanId);
    if (!project || !plan || plan.kind !== "stand") return;

    const safeWidth = clampMeters(widthM);
    const safeDepth = clampMeters(depthM);
    const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;

    // Номер стенда в заголовке сохраняем — по нему план и узнают.
    const stand = plan.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
    const standNumber = stand ? getObjectStandMeta(stand)?.number ?? stand.name : null;

    const nextPlan: FloorPlan = {
      ...plan,
      title: standNumber
        ? `Стенд ${standNumber} — ${formatMeters(safeWidth)} x ${formatMeters(safeDepth)} м`
        : `Стенд ${formatMeters(safeWidth)} x ${formatMeters(safeDepth)} м`,
      width: safeWidth * pxPerMeter,
      height: safeDepth * pxPerMeter,
    };

    commitProject(set, get, {
      ...project,
      floorPlans: project.floorPlans.map((item) => (item.id === plan.id ? nextPlan : item)),
    });
  },
  applyStandTemplate: (templateId) => {
    const state = get();
    const project = state.project;
    const plan = getFloorPlan(project, state.activeFloorPlanId);
    const template = standTemplates.find((item) => item.id === templateId);
    if (!project || !plan || plan.kind !== "stand" || !template) return;

    const layerId = getLayerId(project, plan.id, "stands");
    const walls = buildTemplateWalls(template, plan, layerId, createId);

    // Прежние стены заменяются, остальная мебель остаётся на месте.
    const kept = project.objects.filter((object) => {
      if (object.floorPlanId !== plan.id) return true;
      const meta = getObjectFurnitureMeta(object);
      if (!meta) return true;
      return getFurnitureItem(meta.itemId)?.category !== "walls";
    });

    commitProject(set, get, { ...project, objects: [...kept, ...walls] });
    set({ selectedObjectId: null, validationMessage: null });
  },
  zoomIn: () => set(({ viewport }) => ({ viewport: { ...viewport, scale: Math.min(viewport.scale + 0.1, maxScale) } })),
  zoomOut: () => set(({ viewport }) => ({ viewport: { ...viewport, scale: Math.max(viewport.scale - 0.1, minScale) } })),
  /** Вписывает план целиком в холст и ставит по центру. */
  fitToScreen: () => {
    const { project, activeFloorPlanId, stageSize } = get();
    const plan = getFloorPlan(project, activeFloorPlanId);
    if (!plan || plan.width <= 0 || plan.height <= 0 || stageSize.width <= 0 || stageSize.height <= 0) {
      set({ viewport: defaultViewport });
      return;
    }

    const available = {
      width: Math.max(stageSize.width - fitPadding * 2, 1),
      height: Math.max(stageSize.height - fitPadding * 2, 1),
    };
    const scale = Math.min(Math.max(Math.min(available.width / plan.width, available.height / plan.height), minScale), maxScale);

    set({
      viewport: {
        scale,
        x: (stageSize.width - plan.width * scale) / 2,
        y: (stageSize.height - plan.height * scale) / 2,
      },
    });
  },
  setViewport: (viewport) => set((state) => ({ viewport: { ...state.viewport, ...viewport } })),
  setStageSize: (size) => set({ stageSize: size }),
  undo: () => {
    const { historyPast, historyFuture, project } = get();
    if (!project || historyPast.length === 0) return;

    const previous = historyPast[historyPast.length - 1];
    set({
      project: previous,
      activeFloorPlanId: previous.floorPlans[0]?.id ?? null,
      historyPast: historyPast.slice(0, -1),
      historyFuture: [project, ...historyFuture],
      isDirty: true,
      validationMessage: null,
      draftPoints: [],
      selectedObjectId: null,
    });
  },
  redo: () => {
    const { historyPast, historyFuture, project } = get();
    if (!project || historyFuture.length === 0) return;

    const [next, ...rest] = historyFuture;
    set({
      project: next,
      activeFloorPlanId: next.floorPlans[0]?.id ?? null,
      historyPast: [...historyPast, project],
      historyFuture: rest,
      isDirty: true,
      validationMessage: null,
      draftPoints: [],
      selectedObjectId: null,
    });
  },
}));

export const standStatuses: StandStatus[] = ["available", "reserved", "sold", "construction", "unavailable"];

type EditorStateSetter = (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void;

function commitProject(setState: EditorStateSetter, getState: () => EditorState, project: ExhibitionProject): void {
  const current = getState().project;
  setState((state) => ({
    project,
    historyPast: current ? [...state.historyPast, current] : state.historyPast,
    historyFuture: [],
    isDirty: true,
  }));
}

function getStandLayerId(project: ExhibitionProject, floorPlanId: string): string {
  return getLayerId(project, floorPlanId, "stands");
}

function getLayerId(project: ExhibitionProject, floorPlanId: string, kind: LayerKind): string {
  return project.layers.find((layer) => layer.floorPlanId === floorPlanId && layer.kind === kind)?.id ?? `${floorPlanId}-${kind}`;
}

/** Округляет до половины метра — шаг, которым обычно задают размеры стендов. */
function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/** Габариты площадки: меньше метра не бывает, больше 50 — это уже не стенд. */
function clampMeters(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  return Math.min(Math.max(value, 1), 50);
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
