import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Image, Layer, Line, Rect, Stage, Text } from "react-konva";
import { getFurnitureImageUrl, getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getFloorPlanLayers, getFloorPlanObjects, getObjectFurnitureMeta, getObjectPoints, getObjectStandMeta, isWallObject } from "../../../shared/domain/project";
import { currentDealColor, statusColors } from "../../../shared/domain/status";
import type { CanvasObject, Point } from "../../../shared/domain/types";
import { flattenPoints, polygonArea, polygonCentroid, snapPoint } from "../../../shared/geometry/polygon";
import { maxScale, minScale, useEditorStore } from "../store/editorStore";
import { useImage } from "../hooks/useImage";
import { registerStage } from "../stageRegistry";

const closeDistance = 10;
const keyboardPanStep = 42;
/** Средняя кнопка мыши — колёсико. */
const middleMouseButton = 1;

export function PlanCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [middleButtonPanning, setMiddleButtonPanning] = useState(false);
  const [marquee, setMarquee] = useState<{ start: Point; end: Point } | null>(null);
  /** Тянули ли мышь: без этого одиночный клик сойдёт за пустую рамку. */
  const marqueeMoved = useRef(false);
  // Размер холста живёт в store: по нему считается вписывание плана в экран.
  const stageSize = useEditorStore((state) => state.stageSize);
  const setStageSize = useEditorStore((state) => state.setStageSize);
  const project = useEditorStore((state) => state.project);
  const activeFloorPlanId = useEditorStore((state) => state.activeFloorPlanId);
  const selectedObjectId = useEditorStore((state) => state.selectedObjectId);
  const draftPoints = useEditorStore((state) => state.draftPoints);
  const mode = useEditorStore((state) => state.mode);
  const tool = useEditorStore((state) => state.tool);
  const viewport = useEditorStore((state) => state.viewport);
  const crm = useEditorStore((state) => state.crm);
  const addDraftPoint = useEditorStore((state) => state.addDraftPoint);
  const createStandFromDraft = useEditorStore((state) => state.createStandFromDraft);
  const selectObject = useEditorStore((state) => state.selectObject);
  const selectObjects = useEditorStore((state) => state.selectObjects);
  const deleteObjects = useEditorStore((state) => state.deleteObjects);
  const selectedObjectIds = useEditorStore((state) => state.selectedObjectIds);
  const updateStand = useEditorStore((state) => state.updateStand);
  const moveFurniture = useEditorStore((state) => state.moveFurniture);
  const rotateFurniture = useEditorStore((state) => state.rotateFurniture);
  const openStandPlan = useEditorStore((state) => state.openStandPlan);
  const setViewport = useEditorStore((state) => state.setViewport);
  const undoAction = useEditorStore((state) => state.undo);
  const redoAction = useEditorStore((state) => state.redo);
  const floorPlan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const layers = useMemo(() => getFloorPlanLayers(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const objects = useMemo(() => getFloorPlanObjects(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const selectedObject = useMemo(() => getCanvasObject(project, selectedObjectId), [project, selectedObjectId]);
  const backgroundImage = useImage(floorPlan?.background?.imageUrl ?? "");

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [setStageSize]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

      // Отмена и повтор по-русски набираются другими буквами, поэтому смотрим
      // на физическую клавишу, а не на введённый символ.
      if (event.ctrlKey || event.metaKey) {
        const redo = event.code === "KeyY" || (event.code === "KeyZ" && event.shiftKey);
        const undo = event.code === "KeyZ" && !event.shiftKey;
        if (!redo && !undo) return;

        event.preventDefault();
        if (redo) redoAction();
        else undoAction();
        return;
      }

      // Поворот выбранного предмета: R или русская К на том же месте клавиатуры.
      if (selectedObjectId && ["r", "к"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        rotateFurniture(selectedObjectId);
        return;
      }

      if (["Delete", "Backspace"].includes(event.key) && selectedObjectIds.length > 0) {
        event.preventDefault();
        deleteObjects(selectedObjectIds);
        return;
      }

      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;

      event.preventDefault();
      const directions: Record<string, Point> = {
        ArrowUp: { x: 0, y: keyboardPanStep },
        ArrowDown: { x: 0, y: -keyboardPanStep },
        ArrowLeft: { x: keyboardPanStep, y: 0 },
        ArrowRight: { x: -keyboardPanStep, y: 0 },
      };
      const direction = directions[event.key];
      if (!direction) return;

      setViewport({ x: viewport.x + direction.x, y: viewport.y + direction.y });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteObjects, redoAction, rotateFurniture, selectedObjectId, selectedObjectIds, setViewport, undoAction, viewport.x, viewport.y]);

  useEffect(() => {
    if (!middleButtonPanning) return;

    // Кнопку могли отпустить за пределами холста — иначе панорама залипнет.
    const stopPanning = (event: MouseEvent) => {
      if (event.button !== middleMouseButton) return;

      const stage = stageRef.current;
      if (stage) {
        stage.stopDrag();
        setViewport({ x: stage.x(), y: stage.y() });
      }
      setMiddleButtonPanning(false);
    };

    window.addEventListener("mouseup", stopPanning);
    return () => window.removeEventListener("mouseup", stopPanning);
  }, [middleButtonPanning, setViewport]);

  if (!floorPlan) {
    return <div className="empty-state">Загрузка плана...</div>;
  }

  const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
  const visibleObjects = objects.filter((object) => visibleLayerIds.has(object.layerId));
  const standObjects = visibleObjects.filter((object) => object.kind === "stand");
  const furnitureObjects = visibleObjects.filter((object) => object.kind === "equipment");
  const gridOffset: Point = { x: floorPlan.grid.offsetX ?? 0, y: floorPlan.grid.offsetY ?? 0 };
  const gridLines = floorPlan.grid.enabled ? createGridLines(floorPlan.width, floorPlan.height, floorPlan.grid.cellSizePx, gridOffset) : [];

  /** Точка под курсором в координатах плана, без привязки к сетке. */
  const planPoint = (stage: Konva.Stage): Point | null => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;

    return { x: (pointer.x - viewport.x) / viewport.scale, y: (pointer.y - viewport.y) / viewport.scale };
  };

  const getPointer = (stage: Konva.Stage): Point | null => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const rawPoint = { x: (pointer.x - viewport.x) / viewport.scale, y: (pointer.y - viewport.y) / viewport.scale };
    return floorPlan.grid.snap ? snapPoint(rawPoint, floorPlan.grid.cellSizePx, gridOffset) : rawPoint;
  };

  const handleStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    // Средней и правой кнопкой вершины не ставим.
    if (event.evt.button !== 0) return;

    // Клик по пустому месту снимает выделение — но только если это клик,
    // а не окончание рамки: иначе рамка сама себя и сбросит.
    if (tool === "select" && event.target === event.target.getStage() && !marqueeMoved.current) {
      selectObject(null);
      return;
    }

    if (tool !== "polygon") return;
    const stage = event.target.getStage();
    if (!stage) return;
    const point = getPointer(stage);
    if (!point) return;

    const firstPoint = draftPoints[0];
    if (draftPoints.length >= 3 && firstPoint && distance(point, firstPoint) <= closeDistance) {
      createStandFromDraft();
      return;
    }

    addDraftPoint(point);
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const zoomIntensity = 0.0015;
    const nextScale = Math.min(Math.max(viewport.scale * Math.exp(-event.evt.deltaY * zoomIntensity), minScale), maxScale);
    const planPointUnderCursor = {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale,
    };

    setViewport({
      scale: nextScale,
      x: pointer.x - planPointUnderCursor.x * nextScale,
      y: pointer.y - planPointUnderCursor.y * nextScale,
    });
  };

  const handleObjectDragEnd = (object: CanvasObject, event: Konva.KonvaEventObject<DragEvent>) => {
    const delta = floorPlan.grid.snap
      ? snapPoint({ x: event.target.x(), y: event.target.y() }, floorPlan.grid.cellSizePx, gridOffset)
      : { x: event.target.x(), y: event.target.y() };
    event.target.position({ x: 0, y: 0 });
    updateStand(object.id, {
      points: getObjectPoints(object).map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
    });
  };

  const handleFurnitureDragEnd = (object: CanvasObject, event: Konva.KonvaEventObject<DragEvent>) => {
    const raw = { x: event.target.x(), y: event.target.y() };
    // К сетке цепляются только стены: по ним считают погонные метры панелей.
    // Мебель ставится свободно, ей середина клетки не мешает.
    const origin = floorPlan.grid.snap && isWallObject(object) ? snapPoint(raw, floorPlan.grid.cellSizePx, gridOffset) : raw;
    event.target.position(origin);
    moveFurniture(object.id, origin);
  };

  /**
   * Панорама средней кнопкой мыши — как в графических редакторах.
   * Работает при любом выбранном инструменте, не сбивая текущий режим.
   */
  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    // Рамка выделения: тянем инструментом «Выбор» по пустому месту.
    if (event.evt.button === 0 && tool === "select" && event.target === event.target.getStage()) {
      const stage = event.target.getStage();
      const start = stage ? planPoint(stage) : null;
      if (start) {
        marqueeMoved.current = false;
        setMarquee({ start, end: start });
      }
    }

    if (event.evt.button !== middleMouseButton) return;

    // Иначе браузер включит свой режим автопрокрутки.
    event.evt.preventDefault();

    const stage = event.target.getStage();
    if (!stage) return;

    setMiddleButtonPanning(true);
    stage.startDrag();
  };

  const handleStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (!marquee) return;

    const stage = event.target.getStage();
    const point = stage ? planPoint(stage) : null;
    if (!point) return;

    marqueeMoved.current = true;
    setMarquee({ start: marquee.start, end: point });
  };

  const handleStageMouseUp = (event: Konva.KonvaEventObject<MouseEvent>) => {
    if (marquee) {
      const box = marqueeBox(marquee);
      // Совсем маленькая рамка — это промах мышью, а не выделение.
      if (marqueeMoved.current && box.width > 3 && box.height > 3) {
        selectObjects(visibleObjects.filter((object) => intersectsBox(object, box)).map((object) => object.id));
      }
      setMarquee(null);
    }

    if (event.evt.button !== middleMouseButton || !middleButtonPanning) return;

    const stage = event.target.getStage();
    stage?.stopDrag();
    setMiddleButtonPanning(false);
  };

  const handleVertexDragEnd = (object: CanvasObject, pointIndex: number, event: Konva.KonvaEventObject<DragEvent>) => {
    const nextPoint = floorPlan.grid.snap
      ? snapPoint({ x: event.target.x(), y: event.target.y() }, floorPlan.grid.cellSizePx, gridOffset)
      : { x: event.target.x(), y: event.target.y() };

    const nextPoints = getObjectPoints(object).map((point, index) => (index === pointIndex ? nextPoint : point));
    updateStand(object.id, { points: nextPoints });
  };

  return (
    <div
      className="canvas-wrap"
      ref={containerRef}
      style={{ cursor: middleButtonPanning ? "grabbing" : tool === "pan" ? "grab" : undefined }}
    >
      <Stage
        ref={(node) => {
          stageRef.current = node;
          registerStage(node);
        }}
        width={stageSize.width}
        height={stageSize.height}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        onClick={handleStageClick}
        onWheel={handleWheel}
        draggable={tool === "pan" || middleButtonPanning}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDragEnd={(event) => {
          // Событие всплывает от перетащенного стенда или предмета, поэтому
          // сдвигаем вид только если тянули сам холст, а не то, что на нём лежит.
          if (event.target !== event.target.getStage()) return;
          setViewport({ x: event.target.x(), y: event.target.y() });
        }}
      >
        <Layer listening={false}>
          <Rect width={floorPlan.width} height={floorPlan.height} fill="#f8fafb" stroke="#c8ced6" strokeWidth={2} />
          {visibleLayerIds.has(`${floorPlan.id}-background`) && backgroundImage ? (
            <Image image={backgroundImage} width={floorPlan.width} height={floorPlan.height} opacity={0.78} />
          ) : null}
          {gridLines.map((line) => (
            <Line key={line.key} points={line.points} stroke={line.major ? "#aab3bf" : "#d8dde4"} strokeWidth={line.major ? 1 : 0.5} />
          ))}
        </Layer>

        <Layer>
          {standObjects.map((object) => (
            <StandShape
              key={object.id}
              object={object}
              selected={selectedObjectIds.includes(object.id)}
              currentDeal={Boolean(crm.dealId && getObjectStandMeta(object)?.dealId === crm.dealId)}
              cellSizePx={floorPlan.grid.cellSizePx}
              metersPerCell={floorPlan.grid.metersPerCell}
              draggable={mode === "admin"}
              onSelect={(additive) => selectObject(object.id, additive)}
              onOpen={() => openStandPlan(object.id)}
              onDragEnd={(event) => handleObjectDragEnd(object, event)}
            />
          ))}

          {furnitureObjects.map((object) => (
            <FurnitureShape
              key={object.id}
              object={object}
              selected={selectedObjectIds.includes(object.id)}
              onSelect={(additive) => selectObject(object.id, additive)}
              onDragEnd={(event) => handleFurnitureDragEnd(object, event)}
            />
          ))}

          {selectedObject && selectedObject.kind === "stand" && mode === "admin"
            ? getObjectPoints(selectedObject).map((point, index) => (
                <Circle
                  key={`${selectedObject.id}-vertex-${index}`}
                  x={point.x}
                  y={point.y}
                  radius={7}
                  fill="#ffffff"
                  stroke="#0b57d0"
                  strokeWidth={3}
                  draggable
                  onDragEnd={(event) => handleVertexDragEnd(selectedObject, index, event)}
                />
              ))
            : null}

          {marquee ? (
            <Rect
              {...marqueeBox(marquee)}
              fill="rgba(26, 115, 232, 0.12)"
              stroke="#1a73e8"
              strokeWidth={1 / viewport.scale}
              listening={false}
            />
          ) : null}

          {draftPoints.length > 0 ? (
            <Group listening={false}>
              <Line points={flattenPoints(draftPoints)} stroke="#1a73e8" strokeWidth={3} lineCap="round" lineJoin="round" />
              {draftPoints.map((point, index) => (
                <Circle key={`${point.x}-${point.y}-${index}`} x={point.x} y={point.y} radius={6} fill={index === 0 ? "#1a73e8" : "#ffffff"} stroke="#1a73e8" strokeWidth={3} />
              ))}
            </Group>
          ) : null}
        </Layer>
      </Stage>
    </div>
  );
}

type StandShapeProps = {
  object: CanvasObject;
  selected: boolean;
  currentDeal: boolean;
  draggable: boolean;
  cellSizePx: number;
  metersPerCell: number;
  onSelect: (additive: boolean) => void;
  onOpen: () => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
};

function StandShape({ object, selected, currentDeal, draggable, cellSizePx, metersPerCell, onSelect, onOpen, onDragEnd }: StandShapeProps) {
  const points = getObjectPoints(object);
  const center = polygonCentroid(points);
  const standMeta = getObjectStandMeta(object);
  const area = polygonArea(points, metersPerCell, cellSizePx);
  const fill = currentDeal ? currentDealColor : statusColors[standMeta?.status ?? "available"];

  return (
    <Group
      draggable={draggable}
      onClick={(event) => onSelect(event.evt.ctrlKey || event.evt.metaKey)}
      onTap={() => onSelect(false)}
      onDblClick={onOpen}
      onDblTap={onOpen}
      onDragEnd={onDragEnd}
    >
      <Line
        points={flattenPoints(points)}
        closed
        fill={fill}
        opacity={0.78}
        stroke={selected ? "#0b57d0" : "#253141"}
        strokeWidth={selected ? 4 : 2}
        lineJoin="round"
        shadowColor={selected ? "#1a73e8" : undefined}
        shadowBlur={selected ? 8 : 0}
      />
      <Text
        x={center.x - 45}
        y={center.y - 14}
        width={90}
        align="center"
        text={`${standMeta?.number ?? object.name}\n${area} м²`}
        fill="#101820"
        fontStyle="bold"
        fontSize={18}
        listening={false}
      />
    </Group>
  );
}

type FurnitureShapeProps = {
  object: CanvasObject;
  selected: boolean;
  onSelect: (additive: boolean) => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
};

function FurnitureShape({ object, selected, onSelect, onDragEnd }: FurnitureShapeProps) {
  const meta = getObjectFurnitureMeta(object);
  const item = meta ? getFurnitureItem(meta.itemId) : undefined;
  const image = useImage(item ? getFurnitureImageUrl(item) : "");

  if (object.shape.kind !== "rectangle" || !meta) return null;

  const { origin, width, height } = object.shape;
  const rotated = meta.rotation === 90 || meta.rotation === 270;
  // При повороте на четверть оборота местами меняются ширина и глубина.
  const boxWidth = rotated ? height : width;
  const boxHeight = rotated ? width : height;
  // Konva вращает вокруг левого верхнего угла, поэтому картинку возвращаем в рамку сдвигом.
  const shift = imageShift(meta.rotation, width, height);

  return (
    <Group
      x={origin.x}
      y={origin.y}
      draggable
      onClick={(event) => onSelect(event.evt.ctrlKey || event.evt.metaKey)}
      onTap={() => onSelect(false)}
      onDragEnd={onDragEnd}
    >
      <Rect
        width={boxWidth}
        height={boxHeight}
        fill={selected ? "#e8f0fe" : "#ffffff"}
        stroke={selected ? "#0b57d0" : "#5b6674"}
        strokeWidth={selected ? 2.5 : 1}
        cornerRadius={2}
      />
      {image ? (
        <Image
          image={image}
          x={shift.x}
          y={shift.y}
          width={width}
          height={height}
          rotation={meta.rotation}
          listening={false}
        />
      ) : null}
    </Group>
  );
}

/**
 * Смещение картинки после поворота вокруг левого верхнего угла,
 * чтобы она снова оказалась внутри рамки предмета.
 */
function imageShift(rotation: number, width: number, height: number): Point {
  switch (rotation) {
    case 90:
      return { x: height, y: 0 };
    case 180:
      return { x: width, y: height };
    case 270:
      return { x: 0, y: width };
    default:
      return { x: 0, y: 0 };
  }
}

/** Прямоугольник рамки: тянуть можно в любую сторону, ширина не бывает отрицательной. */
function marqueeBox(marquee: { start: Point; end: Point }) {
  return {
    x: Math.min(marquee.start.x, marquee.end.x),
    y: Math.min(marquee.start.y, marquee.end.y),
    width: Math.abs(marquee.end.x - marquee.start.x),
    height: Math.abs(marquee.end.y - marquee.start.y),
  };
}

/** Попал ли объект в рамку — достаточно пересечения, целиком накрывать не нужно. */
function intersectsBox(object: CanvasObject, box: { x: number; y: number; width: number; height: number }): boolean {
  const points = getObjectPoints(object);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return (
    Math.min(...xs) <= box.x + box.width &&
    Math.max(...xs) >= box.x &&
    Math.min(...ys) <= box.y + box.height &&
    Math.max(...ys) >= box.y
  );
}

function createGridLines(width: number, height: number, gridSize: number, offset: Point) {
  const lines: Array<{ key: string; points: number[]; major: boolean }> = [];

  // Сетка может начинаться не с угла картинки, поэтому идём от первой линии,
  // попадающей на план, а не от нуля.
  const startX = offset.x - Math.ceil(offset.x / gridSize) * gridSize;
  const startY = offset.y - Math.ceil(offset.y / gridSize) * gridSize;

  for (let x = startX, index = 0; x <= width; x += gridSize, index += 1) {
    if (x >= 0) lines.push({ key: `v-${index}`, points: [x, 0, x, height], major: index % 5 === 0 });
  }
  for (let y = startY, index = 0; y <= height; y += gridSize, index += 1) {
    if (y >= 0) lines.push({ key: `h-${index}`, points: [0, y, width, y], major: index % 5 === 0 });
  }

  return lines;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
