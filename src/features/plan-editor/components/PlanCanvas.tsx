import { useEffect, useMemo, useRef, useState } from "react";
import type Konva from "konva";
import { Circle, Group, Image, Layer, Line, Rect, Stage, Text } from "react-konva";
import { getFurnitureImageUrl, getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getFloorPlanLayers, getFloorPlanObjects, getObjectFurnitureMeta, getObjectPoints, getObjectStandMeta } from "../../../shared/domain/project";
import { currentDealColor, statusColors } from "../../../shared/domain/status";
import type { CanvasObject, Point } from "../../../shared/domain/types";
import { flattenPoints, polygonArea, polygonCentroid, snapPoint } from "../../../shared/geometry/polygon";
import { useEditorStore } from "../store/editorStore";
import { useImage } from "../hooks/useImage";
import { registerStage } from "../stageRegistry";

const closeDistance = 10;
const keyboardPanStep = 42;

export function PlanCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [stageSize, setStageSize] = useState({ width: 1100, height: 760 });
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
  const updateStand = useEditorStore((state) => state.updateStand);
  const moveFurniture = useEditorStore((state) => state.moveFurniture);
  const rotateFurniture = useEditorStore((state) => state.rotateFurniture);
  const openStandPlan = useEditorStore((state) => state.openStandPlan);
  const setViewport = useEditorStore((state) => state.setViewport);
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
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;

      // Поворот выбранного предмета: R или русская К на том же месте клавиатуры.
      if (selectedObjectId && ["r", "к"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        rotateFurniture(selectedObjectId);
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
  }, [rotateFurniture, selectedObjectId, setViewport, viewport.x, viewport.y]);

  if (!floorPlan) {
    return <div className="empty-state">Загрузка плана...</div>;
  }

  const visibleLayerIds = new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
  const visibleObjects = objects.filter((object) => visibleLayerIds.has(object.layerId));
  const standObjects = visibleObjects.filter((object) => object.kind === "stand");
  const furnitureObjects = visibleObjects.filter((object) => object.kind === "equipment");
  const gridLines = floorPlan.grid.enabled ? createGridLines(floorPlan.width, floorPlan.height, floorPlan.grid.cellSizePx) : [];

  const getPointer = (stage: Konva.Stage): Point | null => {
    const pointer = stage.getPointerPosition();
    if (!pointer) return null;
    const rawPoint = { x: (pointer.x - viewport.x) / viewport.scale, y: (pointer.y - viewport.y) / viewport.scale };
    return floorPlan.grid.snap ? snapPoint(rawPoint, floorPlan.grid.cellSizePx) : rawPoint;
  };

  const handleStageClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
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
    const nextScale = Math.min(Math.max(viewport.scale * Math.exp(-event.evt.deltaY * zoomIntensity), 0.15), 3);
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
      ? snapPoint({ x: event.target.x(), y: event.target.y() }, floorPlan.grid.cellSizePx)
      : { x: event.target.x(), y: event.target.y() };
    event.target.position({ x: 0, y: 0 });
    updateStand(object.id, {
      points: getObjectPoints(object).map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
    });
  };

  const handleFurnitureDragEnd = (object: CanvasObject, event: Konva.KonvaEventObject<DragEvent>) => {
    const raw = { x: event.target.x(), y: event.target.y() };
    const origin = floorPlan.grid.snap ? snapPoint(raw, floorPlan.grid.cellSizePx) : raw;
    event.target.position(origin);
    moveFurniture(object.id, origin);
  };

  const handleVertexDragEnd = (object: CanvasObject, pointIndex: number, event: Konva.KonvaEventObject<DragEvent>) => {
    const nextPoint = floorPlan.grid.snap
      ? snapPoint({ x: event.target.x(), y: event.target.y() }, floorPlan.grid.cellSizePx)
      : { x: event.target.x(), y: event.target.y() };

    const nextPoints = getObjectPoints(object).map((point, index) => (index === pointIndex ? nextPoint : point));
    updateStand(object.id, { points: nextPoints });
  };

  return (
    <div className="canvas-wrap" ref={containerRef}>
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
        draggable={tool === "pan"}
        onDragEnd={(event) => setViewport({ x: event.target.x(), y: event.target.y() })}
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
              selected={object.id === selectedObjectId}
              currentDeal={Boolean(crm.dealId && getObjectStandMeta(object)?.dealId === crm.dealId)}
              cellSizePx={floorPlan.grid.cellSizePx}
              metersPerCell={floorPlan.grid.metersPerCell}
              draggable={mode === "admin"}
              onSelect={() => selectObject(object.id)}
              onOpen={() => openStandPlan(object.id)}
              onDragEnd={(event) => handleObjectDragEnd(object, event)}
            />
          ))}

          {furnitureObjects.map((object) => (
            <FurnitureShape
              key={object.id}
              object={object}
              selected={object.id === selectedObjectId}
              onSelect={() => selectObject(object.id)}
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
  onSelect: () => void;
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
    <Group draggable={draggable} onClick={onSelect} onTap={onSelect} onDblClick={onOpen} onDblTap={onOpen} onDragEnd={onDragEnd}>
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
  onSelect: () => void;
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
    <Group x={origin.x} y={origin.y} draggable onClick={onSelect} onTap={onSelect} onDragEnd={onDragEnd}>
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

function createGridLines(width: number, height: number, gridSize: number) {
  const lines: Array<{ key: string; points: number[]; major: boolean }> = [];
  for (let x = 0; x <= width; x += gridSize) lines.push({ key: `v-${x}`, points: [x, 0, x, height], major: x % (gridSize * 5) === 0 });
  for (let y = 0; y <= height; y += gridSize) lines.push({ key: `h-${y}`, points: [0, y, width, y], major: y % (gridSize * 5) === 0 });
  return lines;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
