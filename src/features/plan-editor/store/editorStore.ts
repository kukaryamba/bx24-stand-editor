import { create } from "zustand";
import { getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getFloorPlanObjects, getObjectFurnitureMeta, getObjectPoints, getObjectStandMeta, withPolygonPoints } from "../../../shared/domain/project";
import type {
  AppMode,
  CanvasObject,
  CrmContext,
  EditorTool,
  ExhibitionProject,
  FloorPlan,
  LayerKind,
  Point,
  StandStatus,
} from "../../../shared/domain/types";
import { validateStandPolygon } from "../../../shared/geometry/polygon";

type Viewport = {
  scale: number;
  x: number;
  y: number;
};

type EditorState = {
  project: ExhibitionProject | null;
  activeFloorPlanId: string | null;
  selectedObjectId: string | null;
  draftPoints: Point[];
  mode: AppMode;
  tool: EditorTool;
  viewport: Viewport;
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
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  undo: () => void;
  redo: () => void;
};

const defaultCrm: CrmContext = { provider: "mock", dealId: null, userId: null };
const defaultViewport: Viewport = { scale: 0.45, x: 24, y: 24 };

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  activeFloorPlanId: null,
  selectedObjectId: null,
  draftPoints: [],
  mode: "admin",
  tool: "select",
  viewport: defaultViewport,
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
  zoomIn: () => set(({ viewport }) => ({ viewport: { ...viewport, scale: Math.min(viewport.scale + 0.1, 3) } })),
  zoomOut: () => set(({ viewport }) => ({ viewport: { ...viewport, scale: Math.max(viewport.scale - 0.1, 0.15) } })),
  fitToScreen: () => set({ viewport: defaultViewport }),
  setViewport: (viewport) => set((state) => ({ viewport: { ...state.viewport, ...viewport } })),
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

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
