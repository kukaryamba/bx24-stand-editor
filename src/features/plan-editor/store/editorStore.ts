import { create } from "zustand";
import { getFurnitureItem } from "../../../shared/domain/furniture";
import { buildBaseObjects } from "../../../shared/domain/standBase";
import { buildTemplateWalls, rotateTemplate, standTemplates, templateVariants, type StandTemplateId } from "../../../shared/domain/standTemplates";
import {
  createStandFloorPlan,
  defaultStandSizeM,
  findFloorPlanByKind,
  findStandByDeal,
  findStandPlan,
  formatMeters,
  getCanvasObject,
  getFloorPlan,
  getFloorPlanKind,
  getFloorPlanObjects,
  getObjectFurnitureMeta,
  getObjectPoints,
  getObjectStandMeta,
  getStandAreaM2,
  getStandOutline,
  getStandPlans,
  getStandSizeMeters,
  standPlanTitle,
  withPolygonPoints,
} from "../../../shared/domain/project";
import type {
  CanvasObject,
  CrmContext,
  EditorTool,
  ExhibitionProject,
  FloorPlan,
  FloorPlanKind,
  FurnitureObjectMeta,
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
/** Насколько ужимать площадку стенда против точного вписывания. */
const standFitZoom = 0.8;

type EditorState = {
  project: ExhibitionProject | null;
  /** Последняя применённая схема стенда — чтобы повторное нажатие поворачивало её. */
  lastTemplate: { floorPlanId: string; templateId: StandTemplateId; turns: number } | null;
  activeFloorPlanId: string | null;
  /** Стенд, площадка которого сейчас открыта. */
  activeStandObjectId: string | null;
  /** Объект, чья карточка открыта справа. Пусто, если выбрано несколько. */
  selectedObjectId: string | null;
  /** Всё выделенное: по нему работают групповые действия. */
  selectedObjectIds: string[];
  draftPoints: Point[];
  tool: EditorTool;
  viewport: Viewport;
  stageSize: StageSize;
  crm: CrmContext;
  validationMessage: string | null;
  isDirty: boolean;
  historyPast: ExhibitionProject[];
  historyFuture: ExhibitionProject[];
  loadProject: (project: ExhibitionProject) => void;
  applyPortalProject: (project: ExhibitionProject) => void;
  replacePlanObjects: (floorPlanId: string | null, objects: CanvasObject[]) => void;
  createSnapshot: () => ExhibitionProject;
  saveWorkspace: () => void;
  setCrmContext: (crm: CrmContext) => void;
  setTool: (tool: EditorTool) => void;
  selectObject: (objectId: string | null, additive?: boolean) => void;
  /** Выделяет сразу несколько — например, обведённых рамкой. */
  selectObjects: (objectIds: string[]) => void;
  /** Удаляет всё выделенное одним действием, чтобы отмена вернула разом. */
  deleteObjects: (objectIds: string[]) => void;
  addDraftPoint: (point: Point) => void;
  clearDraft: () => void;
  createStandFromDraft: () => void;
  updateStand: (
    objectId: string,
    patch: {
      number?: string;
      status?: StandStatus;
      dealId?: string | null;
      note?: string;
      points?: Point[];
      /** Ответы анкеты паспорта — дописываются к прежним, а не заменяют их. */
      passport?: Record<string, string>;
    },
  ) => void;
  updateFloorPlanGrid: (floorPlanId: string, patch: Partial<FloorPlan["grid"]>) => void;
  /**
   * Меняет подложку плана. Сетку можно передать сразу: тогда картинка
   * и масштаб меняются одним шагом истории и откатываются одним Ctrl+Z.
   */
  setFloorPlanBackground: (
    floorPlanId: string,
    background: FloorPlan["background"],
    size?: Pick<FloorPlan, "width" | "height">,
    grid?: Partial<FloorPlan["grid"]>,
  ) => void;
  deleteObject: (objectId: string) => void;
  /** count штук — плотным квадратом от точки, все выделены. */
  addFurniture: (itemId: string, position: Point, count?: number) => void;
  /**
   * Расставляет выбранные предметы равномерно по площадке стенда: сетка
   * по пропорциям площадки, каждый в центре своей клетки. Одним шагом истории.
   */
  distributeObjects: (objectIds: string[]) => void;
  /**
   * Расставляет выбранные предметы рядами, как стулья в зале: поровну
   * по обе стороны прохода посередине, с отступами от боковых стен
   * и промежутком между рядами. Блок рядов — по центру площадки по глубине.
   * Возвращает, сколько не поместилось (0 — поместились все).
   */
  arrangeRows: (objectIds: string[], options: { aisleM: number; sideM: number; rowGapM: number; faceBack: boolean }) => number;
  moveFurniture: (objectId: string, origin: Point) => void;
  /**
   * Кладёт предметы (например, из счёта) рядом с площадкой, под её нижним краем,
   * рядами — оттуда их растаскивают по местам. Одним шагом истории; все
   * добавленные выделяются, чтобы их можно было сразу перетащить группой.
   */
  addFurnitureBatch: (itemIds: string[]) => void;
  /**
   * Копирует предметы открытой площадки: копии чуть сдвинуты, выделены
   * и ложатся поверх. Стенды не копируются — у стенда своя сделка и площадка.
   */
  duplicateObjects: (objectIds: string[]) => void;
  /** Сдвигает несколько объектов разом на одно смещение — одним шагом истории. */
  moveObjects: (objectIds: string[], delta: Point) => void;
  rotateFurniture: (objectId: string) => void;
  /**
   * Меняет надпись и длину фризовой панели. Длина — в пикселях плана,
   * вдоль панели; при повороте она остаётся длиной, а не шириной рамки.
   */
  /** label: null — у панели нет своей надписи, берётся общая надпись стенда. Пустая строка — своя, пустая. */
  updateFrieze: (objectId: string, patch: { label?: string | null; lengthPx?: number }) => void;
  /**
   * Надпись на фризе стенда — одна на стенд: и в анкете паспорта, и на панелях.
   * Панели стенда сбрасывают свои прежние надписи, чтобы не расходиться
   * с анкетой. Всё одним шагом истории.
   */
  setStandFriezeText: (standObjectId: string, text: string | null) => void;
  /**
   * Номера стендов из названий их сделок. Мимо истории: это не правка
   * пользователя, а сверка с порталом, и Ctrl+Z не должен её отменять.
   */
  syncStandNumbers: (numbers: Record<string, string>) => void;
  /** Переключает редактор между картой павильона и площадкой стенда. */
  showFloorPlanKind: (kind: FloorPlanKind) => void;
  /** Открывает площадку выбранного стенда, при необходимости заводит её. */
  openStandPlan: (standObjectId: string) => void;
  /** Возвращает на карту выставки. */
  backToExpoPlan: () => void;
  /** Переименовывает выставку — название печатается в паспорте стенда. */
  renameExhibition: (title: string) => void;
  /** Меняет габариты площадки стенда в метрах. */
  resizeStandPlan: (widthM: number, depthM: number) => void;
  /** Расставляет стены по типовой схеме, заменяя прежние. */
  /** fresh — поставить схему в исходном повороте, даже если она уже стоит (например, из счёта). */
  applyStandTemplate: (templateId: StandTemplateId, fresh?: boolean) => void;
  /** Заменяет всё на площадке базовой комплектацией по площади. Одним шагом истории. Без id — открытая площадка. */
  applyBaseKit: (floorPlanId?: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  setViewport: (viewport: Partial<Viewport>) => void;
  /** Запоминает то, что сейчас видно на экране, как вид открытия плана — для всех. */
  saveStartView: () => void;
  /** Забывает вид открытия: план снова вписывается целиком. */
  clearStartView: () => void;
  setStageSize: (size: StageSize) => void;
  undo: () => void;
  redo: () => void;
};

const defaultCrm: CrmContext = { provider: "mock", dealId: null, userId: null, placement: null };
const defaultViewport: Viewport = { scale: 0.45, x: 24, y: 24 };
const defaultStageSize: StageSize = { width: 1100, height: 760 };

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  lastTemplate: null,
  activeFloorPlanId: null,
  activeStandObjectId: null,
  selectedObjectId: null,
  selectedObjectIds: [],
  draftPoints: [],
  tool: "select",
  viewport: defaultViewport,
  stageSize: defaultStageSize,
  crm: defaultCrm,
  validationMessage: null,
  isDirty: false,
  historyPast: [] as ExhibitionProject[],
  historyFuture: [] as ExhibitionProject[],

  loadProject: (project) => set({ project, activeFloorPlanId: project.floorPlans[0]?.id ?? null, historyPast: [], historyFuture: [], isDirty: false }),
  /**
   * Принимает карту выставки из портала, не сбрасывая навигацию.
   *
   * loadProject для этого не годится: она открывает первый план проекта,
   * то есть выбрасывает с площадки стенда на общий план, если данные пришли
   * уже после того, как пользователь начал работать.
   */
  applyPortalProject: (project) => {
    const open = keepOpenPlan(project, get());
    set({
      project,
      ...open,
      // Карта пришла из портала вместе с видом открытия — показываем его.
      viewport: fitViewport(project, open.activeFloorPlanId, get().stageSize),
      selectedObjectId: null,
      selectedObjectIds: [],
      draftPoints: [],
      historyPast: [],
      historyFuture: [],
      isDirty: false,
    });
  },
  /**
   * Заменяет предметы одного плана — например, загруженные из сделки.
   *
   * Отдельно от loadProject: та переключает редактор на первый план проекта,
   * то есть на общий план выставки, и загрузка в открытый стенд выбрасывала
   * пользователя на другой экран.
   */
  replacePlanObjects: (floorPlanId, objects) => {
    const project = get().project;
    if (!project) return;

    const untouched = project.objects.filter((object) => object.kind !== "equipment" || object.floorPlanId !== floorPlanId);
    // Слой тоже перепривязываем: план в сделке мог быть сохранён с другой площадки
    // (сделку перевязали на другой стенд), и предметы со слоем чужой площадки
    // лежали на этой, но не рисовались — площадка выглядела пустой.
    const plan = getFloorPlan(project, floorPlanId);
    const restored = objects.map((object) =>
      withCatalogSize(floorPlanId ? { ...object, floorPlanId, layerId: getLayerId(project, floorPlanId, "stands") } : object, plan),
    );

    commitProject(set, get, { ...project, objects: [...untouched, ...restored] });
    set({ selectedObjectId: null, selectedObjectIds: [], draftPoints: [], validationMessage: null });
  },
  createSnapshot: () => {
    const project = get().project;
    if (!project) throw new Error("Нет данных для сохранения.");
    return project;
  },
  saveWorkspace: () => set({ isDirty: false }),
  setCrmContext: (crm) => set({ crm }),
  setTool: (tool) => set({ tool, draftPoints: [], validationMessage: null }),
  /**
   * Обычный клик выбирает один объект, клик с Ctrl добавляет или убирает
   * из выделения. Карточка справа показывается, когда выбран ровно один:
   * у нескольких объектов общих свойств нет.
   */
  selectObject: (objectId, additive = false) => {
    if (!objectId) {
      set({ selectedObjectId: null, selectedObjectIds: [], tool: "select", draftPoints: [] });
      return;
    }

    if (!additive) {
      set({ selectedObjectId: objectId, selectedObjectIds: [objectId], tool: "select", draftPoints: [] });
      return;
    }

    const current = get().selectedObjectIds;
    const next = current.includes(objectId) ? current.filter((id) => id !== objectId) : [...current, objectId];

    set({
      selectedObjectId: next.length === 1 ? next[0] : null,
      selectedObjectIds: next,
      tool: "select",
      draftPoints: [],
    });
  },
  selectObjects: (objectIds) => {
    set({
      selectedObjectId: objectIds.length === 1 ? objectIds[0] : null,
      selectedObjectIds: objectIds,
      tool: "select",
      draftPoints: [],
    });
  },
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

    // Рисуют из сделки, у которой ещё нет стенда, — стенд её: сразу привязываем,
    // и номер придёт из названия сделки. Иначе стенд свободный, номер временный.
    const dealId = state.crm.dealId && !findStandByDeal(project, state.crm.dealId) ? state.crm.dealId : null;
    const standCount = project.objects.filter((item) => item.kind === "stand").length + 1;

    const objectId = createId("object");
    const object: CanvasObject = {
      id: objectId,
      floorPlanId: floorPlan.id,
      layerId: getStandLayerId(project, floorPlan.id),
      kind: "stand",
      name: `Стенд ${standCount}`,
      shape: { kind: "polygon", points },
      meta: {
        stand: {
          number: `Новый-${standCount}`,
          status: dealId ? "reserved" : "available",
          dealId,
          note: "",
        },
      },
    };

    commitProject(set, get, {
      ...project,
      objects: [...project.objects, object],
    });
    set({ selectedObjectId: objectId, selectedObjectIds: [objectId], draftPoints: [], tool: "select", validationMessage: null });
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
              passport: patch.passport ? { ...standMeta.passport, ...patch.passport } : standMeta.passport,
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
  setFloorPlanBackground: (floorPlanId, background, size, grid) => {
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
              grid: grid ? { ...plan.grid, ...grid } : plan.grid,
            }
          : plan,
      ),
    });
    set({ draftPoints: [], validationMessage: null });
  },
  deleteObject: (objectId) => {
    get().deleteObjects([objectId]);
  },
  deleteObjects: (objectIds) => {
    const project = get().project;
    if (!project || objectIds.length === 0) return;

    const removed = new Set(objectIds);

    // Одним коммитом: иначе отмена возвращала бы предметы по одному.
    commitProject(set, get, {
      ...project,
      objects: project.objects.filter((item) => !removed.has(item.id)),
    });
    set({ selectedObjectId: null, selectedObjectIds: [] });
  },
  addFurniture: (itemId, position, count = 1) => {
    const state = get();
    const project = state.project;
    const floorPlan = getFloorPlan(project, state.activeFloorPlanId);
    const item = getFurnitureItem(itemId);
    if (!project || !floorPlan || !item) return;

    // Габариты в метрах переводим в пиксели плана через масштаб сетки.
    const pxPerMeter = floorPlan.grid.cellSizePx / floorPlan.grid.metersPerCell;
    const width = item.widthM * pxPerMeter;
    const height = item.depthM * pxPerMeter;
    const gap = 0.1 * pxPerMeter;

    // Несколько штук — плотным квадратом от точки: дальше их расставляют
    // «Распределить по площадке» или перетаскивают группой.
    const safeCount = Math.max(1, Math.min(500, Math.round(count)));
    const columns = Math.ceil(Math.sqrt(safeCount));
    const added: CanvasObject[] = Array.from({ length: safeCount }, (_, index) => ({
      id: createId("furniture"),
      floorPlanId: floorPlan.id,
      layerId: getLayerId(project, floorPlan.id, "stands"),
      kind: "equipment",
      name: item.title,
      shape: {
        kind: "rectangle",
        origin: {
          x: position.x + (index % columns) * (width + gap),
          y: position.y + Math.floor(index / columns) * (height + gap),
        },
        width,
        height,
      },
      meta: {
        furniture: { itemId: item.id, rotation: 0 },
      },
    }));

    commitProject(set, get, { ...project, objects: [...project.objects, ...added] });
    const ids = added.map((object) => object.id);
    set({ selectedObjectId: ids.length === 1 ? ids[0] : null, selectedObjectIds: ids, tool: "select" });
  },
  arrangeRows: (objectIds, { aisleM, sideM, rowGapM, faceBack }) => {
    const state = get();
    const project = state.project;
    const plan = getFloorPlan(project, state.activeFloorPlanId);
    if (!project || !plan || plan.kind !== "stand") return 0;

    const ids = new Set(objectIds);
    const items = project.objects.filter((object) => ids.has(object.id) && object.kind === "equipment" && object.shape.kind === "rectangle");
    if (items.length === 0) return 0;

    const px = plan.grid.cellSizePx / plan.grid.metersPerCell;
    const wall = 0.1 * px;
    // Место под один предмет — по самому крупному из выбранных, в развороте к ряду.
    const seatWidth = Math.max(...items.map((object) => (object.shape.kind === "rectangle" ? object.shape.width : 0)));
    const seatDepth = Math.max(...items.map((object) => (object.shape.kind === "rectangle" ? object.shape.height : 0)));

    const aisle = Math.max(0, aisleM) * px;
    const side = Math.max(0, sideM) * px;
    const rowGap = Math.max(0, rowGapM) * px;
    const halfWidth = (plan.width - 2 * wall - 2 * side - aisle) / 2;
    const perSide = Math.max(0, Math.floor((halfWidth + 0.01) / seatWidth));
    if (perSide === 0) {
      set({ validationMessage: "Ряд не помещается: уменьшите проход или отступы от стен." });
      return items.length;
    }

    const perRow = perSide * 2;
    const rowsFit = Math.max(1, Math.floor((plan.height - 2 * wall + rowGap) / (seatDepth + rowGap)));
    const rows = Math.min(Math.ceil(items.length / perRow), rowsFit);
    const placed = Math.min(items.length, rows * perRow);
    const blockHeight = rows * seatDepth + (rows - 1) * rowGap;
    const top = Math.max(wall, (plan.height - blockHeight) / 2);
    // Половинки ряда прижаты к проходу: так проход ровно посередине, а лишнее место — у стен.
    const aisleLeft = plan.width / 2 - aisle / 2;
    const aisleRight = plan.width / 2 + aisle / 2;

    const positions = new Map<string, Point>();
    items.slice(0, placed).forEach((object, index) => {
      const row = Math.floor(index / perRow);
      const inRow = index % perRow;
      const leftHalf = inRow < perSide;
      const k = leftHalf ? perSide - 1 - inRow : inRow - perSide;
      const x = leftHalf ? aisleLeft - (k + 1) * seatWidth : aisleRight + k * seatWidth;
      positions.set(object.id, { x, y: top + row * (seatDepth + rowGap) });
    });

    // Спинка у значка стула сверху: лицом к задней стене — разворот на 180°.
    const rotation = faceBack ? 180 : 0;
    commitProject(set, get, {
      ...project,
      objects: project.objects.map((object) => {
        const origin = positions.get(object.id);
        const meta = getObjectFurnitureMeta(object);
        if (!origin || object.shape.kind !== "rectangle" || !meta) return object;
        return { ...object, shape: { ...object.shape, origin }, meta: { ...object.meta, furniture: { ...meta, rotation } } };
      }),
    });
    set({ validationMessage: null });
    return items.length - placed;
  },
  distributeObjects: (objectIds) => {
    const state = get();
    const project = state.project;
    const plan = getFloorPlan(project, state.activeFloorPlanId);
    if (!project || !plan || plan.kind !== "stand") return;

    const ids = new Set(objectIds);
    const movable = project.objects.filter((object) => ids.has(object.id) && object.kind === "equipment" && object.shape.kind === "rectangle");
    if (movable.length === 0) return;

    const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;
    // Отступ от края — толщина стены, чтобы предметы не ложились на панели.
    const inset = 0.1 * pxPerMeter;
    const areaWidth = Math.max(plan.width - inset * 2, 1);
    const areaHeight = Math.max(plan.height - inset * 2, 1);

    // Сетка по пропорциям площадки: на вытянутом стенде рядов меньше, мест в ряду больше.
    const count = movable.length;
    const columns = Math.max(1, Math.min(count, Math.round(Math.sqrt((count * areaWidth) / areaHeight))));
    const rows = Math.ceil(count / columns);
    const cellWidth = areaWidth / columns;
    const cellHeight = areaHeight / rows;

    const positions = new Map<string, Point>();
    movable.forEach((object, index) => {
      if (object.shape.kind !== "rectangle") return;
      const rotation = getObjectFurnitureMeta(object)?.rotation ?? 0;
      const turned = rotation === 90 || rotation === 270;
      const boxWidth = turned ? object.shape.height : object.shape.width;
      const boxHeight = turned ? object.shape.width : object.shape.height;
      const column = index % columns;
      const row = Math.floor(index / columns);
      positions.set(object.id, {
        x: inset + cellWidth * (column + 0.5) - boxWidth / 2,
        y: inset + cellHeight * (row + 0.5) - boxHeight / 2,
      });
    });

    commitProject(set, get, {
      ...project,
      objects: project.objects.map((object) => {
        const origin = positions.get(object.id);
        return origin && object.shape.kind === "rectangle" ? { ...object, shape: { ...object.shape, origin } } : object;
      }),
    });
    set({ validationMessage: null });
  },
  addFurnitureBatch: (itemIds) => {
    const state = get();
    const project = state.project;
    const floorPlan = getFloorPlan(project, state.activeFloorPlanId);
    if (!project || !floorPlan || itemIds.length === 0) return;

    const pxPerMeter = floorPlan.grid.cellSizePx / floorPlan.grid.metersPerCell;
    const gap = 0.2 * pxPerMeter;
    const rowWidth = Math.max(floorPlan.width, 3 * pxPerMeter);
    let x = 0;
    let y = floorPlan.height + 0.5 * pxPerMeter;
    let rowHeight = 0;

    const added: CanvasObject[] = [];
    for (const itemId of itemIds) {
      const item = getFurnitureItem(itemId);
      if (!item) continue;
      const width = item.widthM * pxPerMeter;
      const height = item.depthM * pxPerMeter;
      if (x > 0 && x + width > rowWidth) {
        x = 0;
        y += rowHeight + gap;
        rowHeight = 0;
      }

      added.push({
        id: createId("furniture"),
        floorPlanId: floorPlan.id,
        layerId: getLayerId(project, floorPlan.id, "stands"),
        kind: "equipment",
        name: item.title,
        shape: { kind: "rectangle", origin: { x, y }, width, height },
        meta: { furniture: { itemId: item.id, rotation: 0 } },
      });
      x += width + gap;
      rowHeight = Math.max(rowHeight, height);
    }

    commitProject(set, get, { ...project, objects: [...project.objects, ...added] });
    const ids = added.map((object) => object.id);
    set({ selectedObjectId: ids.length === 1 ? ids[0] : null, selectedObjectIds: ids, tool: "select", validationMessage: null });
  },
  duplicateObjects: (objectIds) => {
    const project = get().project;
    if (!project) return;
    const ids = new Set(objectIds);

    const copies: CanvasObject[] = project.objects
      .filter((object) => ids.has(object.id) && object.kind === "equipment" && object.shape.kind === "rectangle")
      .map((object) => {
        const plan = getFloorPlan(project, object.floorPlanId);
        const offset = copyOffsetM * (plan ? plan.grid.cellSizePx / plan.grid.metersPerCell : 1);
        const shape = object.shape.kind === "rectangle"
          ? { ...object.shape, origin: { x: object.shape.origin.x + offset, y: object.shape.origin.y + offset } }
          : object.shape;
        return { ...object, id: createId("furniture"), shape, // Глубокая копия через JSON: structuredClone нет в старом браузере приложения Битрикс24.
          meta: JSON.parse(JSON.stringify(object.meta)) as CanvasObject["meta"] };
      });
    if (copies.length === 0) return;

    commitProject(set, get, { ...project, objects: [...project.objects, ...copies] });
    const copyIds = copies.map((object) => object.id);
    set({ selectedObjectId: copyIds.length === 1 ? copyIds[0] : null, selectedObjectIds: copyIds, tool: "select" });
  },
  moveObjects: (objectIds, delta) => {
    const project = get().project;
    if (!project || (delta.x === 0 && delta.y === 0)) return;
    const ids = new Set(objectIds);

    let validationMessage: string | null = null;
    const objects = project.objects.map((object) => {
      if (!ids.has(object.id)) return object;
      if (object.shape.kind === "rectangle") {
        const { origin } = object.shape;
        return { ...object, shape: { ...object.shape, origin: { x: origin.x + delta.x, y: origin.y + delta.y } } };
      }

      const points = getObjectPoints(object).map((point) => ({ x: point.x + delta.x, y: point.y + delta.y }));
      const floorPlan = getFloorPlan(project, object.floorPlanId);
      if (object.kind === "stand" && floorPlan) {
        validationMessage ??= validateStandPolygon(points, floorPlan, [], object.id);
      }
      return withPolygonPoints(object, points);
    });

    // Стенд вышел за план — не двигаем ничего: группа должна ехать целиком.
    if (validationMessage) {
      set({ validationMessage });
      return;
    }

    commitProject(set, get, { ...project, objects });
    set({ validationMessage: null });
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
  updateFrieze: (objectId, patch) => {
    const project = get().project;
    const object = getCanvasObject(project, objectId);
    const meta = object ? getObjectFurnitureMeta(object) : null;
    if (!project || !object || !meta || object.shape.kind !== "rectangle") return;

    const nextObject: CanvasObject = {
      ...object,
      shape: patch.lengthPx === undefined ? object.shape : { ...object.shape, width: Math.max(1, patch.lengthPx) },
      meta: {
        ...object.meta,
        furniture: patch.label === undefined ? meta : withLabel(meta, patch.label),
      },
    };

    commitProject(set, get, {
      ...project,
      objects: project.objects.map((item) => (item.id === objectId ? nextObject : item)),
    });
  },
  syncStandNumbers: (numbers) => {
    const apply = (project: ExhibitionProject): ExhibitionProject => {
      let changed = false;
      const objects = project.objects.map((item) => {
        const number = numbers[item.id];
        const meta = getObjectStandMeta(item);
        if (!number || !meta || meta.number === number) return item;
        changed = true;
        return { ...item, name: number, meta: { ...item.meta, stand: { ...meta, number } } };
      });
      // Заголовок площадки хранит номер — иначе там так и осталось бы «Новый-43».
      const floorPlans = project.floorPlans.map((plan) => {
        const number = plan.standObjectId ? numbers[plan.standObjectId] : undefined;
        if (!number) return plan;
        const size = getStandSizeMeters(plan);
        const title = standPlanTitle(number, size.width, size.depth);
        if (plan.title === title) return plan;
        changed = true;
        return { ...plan, title };
      });
      return changed ? { ...project, objects, floorPlans } : project;
    };

    const project = get().project;
    if (!project) return;
    const next = apply(project);
    if (next === project) return;

    // Снимки истории тоже поправляем — иначе отмена любой правки вернула бы старый номер.
    set((state) => ({
      project: next,
      historyPast: state.historyPast.map(apply),
      historyFuture: state.historyFuture.map(apply),
    }));
  },
  setStandFriezeText: (standObjectId, text) => {
    const project = get().project;
    const stand = getCanvasObject(project, standObjectId);
    const standMeta = stand ? getObjectStandMeta(stand) : null;
    if (!project || !stand || !standMeta) return;

    // null — вернуть надпись из сделки: убираем ответ из анкеты совсем.
    // Панели со своей надписью не трогаем: у фризов стенда надписи бывают разные.
    const { friezeText: _previous, ...rest } = standMeta.passport ?? {};
    const passport = text === null ? rest : { ...rest, friezeText: text };

    commitProject(set, get, {
      ...project,
      objects: project.objects.map((item) =>
        item.id === standObjectId ? { ...item, meta: { ...item.meta, stand: { ...standMeta, passport } } } : item,
      ),
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
        set({
          activeFloorPlanId: expoPlan.id,
          selectedObjectId: null,
      selectedObjectIds: [],
          draftPoints: [],
          validationMessage: null,
          viewport: fitViewport(project, expoPlan.id, state.stageSize),
        });
      }
      return;
    }

    // Приложение открыто из карточки сделки, значит показываем стенд этой
    // сделки. Подставлять вместо него чужой нельзя: это ввело бы в заблуждение.
    const standOfDeal = findStandByDeal(project, state.crm.dealId);
    if (state.crm.dealId && !standOfDeal) {
      set({
        validationMessage:
          "К этой сделке ещё не привязан стенд. Выберите его на карте выставки и нажмите «Забронировать на текущую сделку».",
      });
      return;
    }

    // Без сделки — последний открытый стенд, иначе первый заведённый,
    // иначе первый стенд на карте выставки.
    const plans = getStandPlans(project);
    const target =
      standOfDeal?.id ??
      state.activeStandObjectId ??
      plans[0]?.standObjectId ??
      getFloorPlanObjects(project, findFloorPlanByKind(project, "expo")?.id ?? null).find((object) => object.kind === "stand")?.id;

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
      selectedObjectIds: [],
        draftPoints: [],
        validationMessage: null,
        viewport: fitViewport(project, existing.id, get().stageSize),
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

    // Новая площадка сразу с базовой комплектацией по площади — допы добавят руками.
    // Если в сделке уже лежит план стенда, он при открытии заменит базу.
    // Цвет ковра в анкету не вписываем: пустое поле и есть ковёр по умолчанию.
    const base = buildBaseObjects(plan, `${plan.id}-stands`, createId, getStandAreaM2(project, plan), getStandOutline(project, plan));

    commitProject(set, get, {
      ...project,
      floorPlans: [...project.floorPlans, plan],
      layers: [...project.layers, ...layers],
      objects: [...project.objects, ...base],
    });
    set({
      activeFloorPlanId: plan.id,
      activeStandObjectId: standObjectId,
      selectedObjectId: null,
      selectedObjectIds: [],
      draftPoints: [],
      validationMessage: null,
      viewport: fitViewport(get().project, plan.id, get().stageSize),
    });
  },
  backToExpoPlan: () => {
    const project = get().project;
    const expoPlan = findFloorPlanByKind(project, "expo");
    if (!expoPlan) return;

    set({
      activeFloorPlanId: expoPlan.id,
      selectedObjectId: null,
      selectedObjectIds: [],
      draftPoints: [],
      validationMessage: null,
      viewport: fitViewport(project, expoPlan.id, get().stageSize),
    });
  },
  renameExhibition: (title) => {
    const project = get().project;
    const exhibition = project?.exhibitions[0];
    if (!project || !exhibition) return;

    commitProject(set, get, {
      ...project,
      title,
      exhibitions: [{ ...exhibition, title }, ...project.exhibitions.slice(1)],
    });
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
      title: standPlanTitle(standNumber, safeWidth, safeDepth),
      width: safeWidth * pxPerMeter,
      height: safeDepth * pxPerMeter,
    };

    commitProject(set, get, {
      ...project,
      floorPlans: project.floorPlans.map((item) => (item.id === plan.id ? nextPlan : item)),
    });
  },
  applyBaseKit: (floorPlanId) => {
    const state = get();
    const project = state.project;
    const plan = getFloorPlan(project, floorPlanId ?? state.activeFloorPlanId);
    if (!project || !plan || plan.kind !== "stand") return;

    const base = buildBaseObjects(plan, getLayerId(project, plan.id, "stands"), createId, getStandAreaM2(project, plan), getStandOutline(project, plan));
    const kept = project.objects.filter((object) => object.floorPlanId !== plan.id || object.kind !== "equipment");

    commitProject(set, get, { ...project, objects: [...kept, ...base] });
    set({ selectedObjectId: null, selectedObjectIds: [], validationMessage: null, lastTemplate: null });
  },
  applyStandTemplate: (templateId, fresh = false) => {
    const state = get();
    const project = state.project;
    const plan = getFloorPlan(project, state.activeFloorPlanId);
    const template = standTemplates.find((item) => item.id === templateId);
    if (!project || !plan || plan.kind !== "stand" || !template) return;

    // Повторное нажатие той же схемы на той же площадке — следующий поворот.
    const last = state.lastTemplate;
    const turns =
      !fresh && last && last.floorPlanId === plan.id && last.templateId === templateId ? (last.turns + 1) % templateVariants(template) : 0;

    const layerId = getLayerId(project, plan.id, "stands");
    const walls = buildTemplateWalls(rotateTemplate(template, turns), plan, layerId, createId, getStandOutline(project, plan));

    // Заменяются только глухие стеновые панели. Фриз, оклейка, двери и стены
    // с занавеской лежат в том же разделе «Стены и двери», но их расставляли
    // руками — раньше смена схемы стирала и их.
    const kept = project.objects.filter((object) => {
      if (object.floorPlanId !== plan.id) return true;
      const meta = getObjectFurnitureMeta(object);
      return !meta || !plainWallItemIds.has(meta.itemId);
    });

    commitProject(set, get, { ...project, objects: [...kept, ...walls] });
    set({
      selectedObjectId: null,
      selectedObjectIds: [],
      validationMessage: null,
      lastTemplate: { floorPlanId: plan.id, templateId, turns },
    });
  },
  zoomIn: () => set(({ viewport }) => ({ viewport: { ...viewport, scale: Math.min(viewport.scale + 0.1, maxScale) } })),
  zoomOut: () => set(({ viewport }) => ({ viewport: { ...viewport, scale: Math.max(viewport.scale - 0.1, minScale) } })),
  /** Вписывает план целиком в холст и ставит по центру. */
  fitToScreen: () => {
    const { project, activeFloorPlanId, stageSize } = get();
    set({ viewport: fitViewport(project, activeFloorPlanId, stageSize) });
  },
  saveStartView: () => {
    const { project, activeFloorPlanId, viewport, stageSize } = get();
    const plan = getFloorPlan(project, activeFloorPlanId);
    if (!project || !plan) return;

    const startView = {
      x: -viewport.x / viewport.scale,
      y: -viewport.y / viewport.scale,
      width: stageSize.width / viewport.scale,
      height: stageSize.height / viewport.scale,
    };
    commitProject(set, get, { ...project, floorPlans: project.floorPlans.map((item) => (item.id === plan.id ? { ...item, startView } : item)) });
  },
  clearStartView: () => {
    const { project, activeFloorPlanId, stageSize } = get();
    const plan = getFloorPlan(project, activeFloorPlanId);
    if (!project || !plan?.startView) return;

    const next = { ...project, floorPlans: project.floorPlans.map((item) => (item.id === plan.id ? { ...item, startView: undefined } : item)) };
    commitProject(set, get, next);
    set({ viewport: fitViewport(next, plan.id, stageSize) });
  },
  setViewport: (viewport) => set((state) => ({ viewport: { ...state.viewport, ...viewport } })),
  setStageSize: (size) =>
    set((state) => {
      // Первый замер холста — только теперь известно, во что вписывать план.
      // До него вид стоял на заготовке, и план открывался как попало.
      const firstMeasure = state.stageSize === defaultStageSize;
      return firstMeasure ? { stageSize: size, viewport: fitViewport(state.project, state.activeFloorPlanId, size) } : { stageSize: size };
    }),
  undo: () => {
    const { historyPast, historyFuture, project, draftPoints } = get();

    // Пока стенд рисуется, отмена снимает последнюю поставленную точку.
    // Откатывать весь предыдущий шаг здесь неожиданно: с точки зрения
    // пользователя он ещё не закончил текущее действие.
    if (draftPoints.length > 0) {
      set({ draftPoints: draftPoints.slice(0, -1), validationMessage: null });
      return;
    }

    if (!project || historyPast.length === 0) return;

    const previous = historyPast[historyPast.length - 1];
    set({
      project: previous,
      ...keepOpenPlan(previous, get()),
      historyPast: historyPast.slice(0, -1),
      historyFuture: [project, ...historyFuture],
      isDirty: true,
      validationMessage: null,
      draftPoints: [],
      selectedObjectId: null,
      selectedObjectIds: [],
    });
  },
  redo: () => {
    const { historyPast, historyFuture, project } = get();
    if (!project || historyFuture.length === 0) return;

    const [next, ...rest] = historyFuture;
    set({
      project: next,
      ...keepOpenPlan(next, get()),
      historyPast: [...historyPast, project],
      historyFuture: rest,
      isDirty: true,
      validationMessage: null,
      draftPoints: [],
      selectedObjectId: null,
      selectedObjectIds: [],
    });
  },
}));

export const standStatuses: StandStatus[] = ["available", "reserved", "sold", "construction", "unavailable"];

type EditorStateSetter = (partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>)) => void;

/**
 * Что открыто после подмены проекта: отмены, повтора, приёма карты из портала.
 *
 * Раньше в этих случаях открывался первый план проекта, то есть карта
 * выставки. Отмена действия на стенде выбрасывала на общий план, и со стороны
 * выглядела как неработающая кнопка.
 */
function keepOpenPlan(
  project: ExhibitionProject,
  state: EditorState,
): Pick<EditorState, "activeFloorPlanId" | "activeStandObjectId" | "viewport"> {
  const stillThere = project.floorPlans.some((plan) => plan.id === state.activeFloorPlanId);
  if (stillThere) {
    return {
      activeFloorPlanId: state.activeFloorPlanId,
      activeStandObjectId: state.activeStandObjectId,
      viewport: state.viewport,
    };
  }

  const fallbackId = project.floorPlans[0]?.id ?? null;
  return {
    activeFloorPlanId: fallbackId,
    activeStandObjectId: null,
    viewport: fitViewport(project, fallbackId, state.stageSize),
  };
}

/**
 * Масштаб и сдвиг, при которых план целиком помещается в холст.
 *
 * Нужен не только кнопке «Fit»: карта выставки и площадка стенда отличаются
 * по размеру в десятки раз, и при переходе между ними чужой масштаб уводит
 * план за край экрана.
 */
function fitViewport(project: ExhibitionProject | null, floorPlanId: string | null, stageSize: StageSize): Viewport {
  const plan = getFloorPlan(project, floorPlanId);
  if (!plan || plan.width <= 0 || plan.height <= 0 || stageSize.width <= 0 || stageSize.height <= 0) {
    return defaultViewport;
  }

  const available = {
    width: Math.max(stageSize.width - fitPadding * 2, 1),
    height: Math.max(stageSize.height - fitPadding * 2, 1),
  };

  // Площадку стенда показываем с запасом: в портале фрейм невысокий, и план
  // впритык упирается в края — некуда вытащить предмет и не видно габаритов.
  // Запомненный вид вписываем без полей: его и выбирали по краям экрана.
  const view = plan.startView;
  if (view && view.width > 0 && view.height > 0) {
    const scale = Math.min(Math.max(Math.min(stageSize.width / view.width, stageSize.height / view.height), minScale), maxScale);
    return {
      scale,
      x: stageSize.width / 2 - (view.x + view.width / 2) * scale,
      y: stageSize.height / 2 - (view.y + view.height / 2) * scale,
    };
  }

  const zoom = getFloorPlanKind(plan) === "stand" ? standFitZoom : 1;
  const exact = Math.min(available.width / plan.width, available.height / plan.height) * zoom;
  const scale = Math.min(Math.max(exact, minScale), maxScale);

  return {
    scale,
    x: (stageSize.width - plan.width * scale) / 2,
    y: (stageSize.height - plan.height * scale) / 2,
  };
}

/**
 * Размер предмета — по каталогу. Габарит записан в каждом поставленном
 * предмете, и после того как позицию в каталоге переделали (стойка под
 * панель стала узкой), старые предметы рисовались новой картинкой,
 * растянутой на прежний квадрат. Растягиваемые полосы — фриз, оклейка —
 * и стены своей длины не трогаем: их длину задают на плане.
 */
function withCatalogSize(object: CanvasObject, plan: FloorPlan | null): CanvasObject {
  const meta = getObjectFurnitureMeta(object);
  const item = meta ? getFurnitureItem(meta.itemId) : undefined;
  if (!plan || !item || item.frieze || item.film || item.category === "walls" || object.shape.kind !== "rectangle") return object;

  const pxPerMeter = plan.grid.cellSizePx / plan.grid.metersPerCell;
  const width = item.widthM * pxPerMeter;
  const height = item.depthM * pxPerMeter;
  if (Math.abs(object.shape.width - width) < 0.5 && Math.abs(object.shape.height - height) < 0.5) return object;
  return { ...object, shape: { ...object.shape, width, height } };
}

/** Глухие стеновые панели — их ставит и заменяет схема стенда. */
const plainWallItemIds = new Set(["wall_1", "wall_05", "stena-10", "stena-05"]);

/** Смещение копии от оригинала, метры: чтобы копия была видна, а не легла точно поверх. */
const copyOffsetM = 0.2;

/** Своя надпись панели; null — своей нет, ключ убирается, чтобы не храниться пустым. */
function withLabel(meta: FurnitureObjectMeta, label: string | null): FurnitureObjectMeta {
  const { label: _previous, ...rest } = meta;
  return label === null ? rest : { ...rest, label };
}

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
