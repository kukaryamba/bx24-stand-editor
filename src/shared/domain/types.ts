export type AppMode = "admin" | "manager";
export type EditorTool = "select" | "polygon" | "pan";

/** Общий план выставки или план отдельного стенда. */
export type EditorScreen = "expo" | "stand";

export type FurnitureCategory =
  | "seating"
  | "tables"
  | "storage"
  | "walls"
  | "lighting"
  | "power"
  | "equipment"
  | "other";

/** Позиция каталога: что можно поставить на план стенда. */
export type FurnitureItem = {
  id: string;
  /** Идентификатор в каталоге CRM, по нему считается спецификация. Пустой — позиции нет в смете. */
  catalogId: string;
  title: string;
  category: FurnitureCategory;
  widthM: number;
  depthM: number;
  image: string;
  round?: boolean;
};

export type StandStatus = "available" | "reserved" | "sold" | "construction" | "unavailable";
export type CanvasObjectKind = "stand" | "column" | "passage" | "wall" | "equipment";
export type ShapeKind = "rectangle" | "polygon";
export type LayerKind = "background" | "passages" | "columns" | "walls" | "stands" | "selection";

export type Point = {
  x: number;
  y: number;
};

export type Exhibition = {
  id: string;
  title: string;
  date: string;
  description: string;
};

export type BackgroundImage = {
  name: string;
  imageUrl: string;
  width: number;
  height: number;
};

export type GridSettings = {
  enabled: boolean;
  snap: boolean;
  cellSizePx: number;
  metersPerCell: number;
};

/**
 * Что за план: карта павильона со стендами или площадка одного стенда.
 * Поле необязательное — планы, сохранённые до его появления, считаются планом выставки.
 */
export type FloorPlanKind = "expo" | "stand";

export type FloorPlan = {
  id: string;
  exhibitionId: string;
  title: string;
  kind?: FloorPlanKind;
  width: number;
  height: number;
  background: BackgroundImage | null;
  grid: GridSettings;
};

export type ProjectLayer = {
  id: string;
  floorPlanId: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
};

export type RectangleShape = {
  kind: "rectangle";
  origin: Point;
  width: number;
  height: number;
};

export type PolygonShape = {
  kind: "polygon";
  points: Point[];
};

export type Shape = RectangleShape | PolygonShape;

export type StandObjectMeta = {
  number: string;
  status: StandStatus;
  dealId: string | null;
  note: string;
};

/** Предмет, поставленный на план стенда. */
export type FurnitureObjectMeta = {
  /** Ссылка на позицию каталога (furnitureCatalog). */
  itemId: string;
  /** Поворот в градусах: 0, 90, 180 или 270 — как в старом приложении. */
  rotation: number;
};

export type ObjectMeta = {
  stand?: StandObjectMeta;
  furniture?: FurnitureObjectMeta;
};

export type CanvasObject = {
  id: string;
  floorPlanId: string;
  layerId: string;
  kind: CanvasObjectKind;
  name: string;
  shape: Shape;
  meta: ObjectMeta;
};

export type ProjectSettings = {
  autosave: boolean;
};

export type ExhibitionProject = {
  id: string;
  title: string;
  exhibitions: Exhibition[];
  floorPlans: FloorPlan[];
  layers: ProjectLayer[];
  objects: CanvasObject[];
  settings: ProjectSettings;
};

export type CrmContext = {
  provider: "bitrix24" | "mock";
  dealId: string | null;
  userId: string | null;
};
