import { useEffect, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Circle, Group, Image, Layer, Line, Rect, Stage, Text } from "react-konva";
import { getFurnitureImageUrl, getFurnitureItem } from "../../../shared/domain/furniture";
import { getCanvasObject, getFloorPlan, getFloorPlanLayers, getFloorPlanObjects, getObjectFurnitureMeta, getObjectPoints, getObjectStandMeta, isWallObject, splitFriezeLabel, stripKindOf, friezeMaxChars, type StripKind } from "../../../shared/domain/project";
import { currentDealColor, statusColors } from "../../../shared/domain/status";
import type { CanvasObject, Point } from "../../../shared/domain/types";
import { flattenPoints, polygonArea, polygonCentroid, snapPoint } from "../../../shared/geometry/polygon";
import { maxScale, minScale, useEditorStore } from "../store/editorStore";
import { useFriezeDefaultLabel } from "../hooks/useFriezeDefaultLabel";
import { useStandCompanies } from "../hooks/useStandCompanies";
import { carpetFill } from "../../../shared/domain/standBase";
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
  /** Выделенная группа, которую сейчас тянут: где стоял каждый узел в начале. */
  const groupDrag = useRef<{ draggedId: string; starts: Map<string, { node: Konva.Node; x: number; y: number }> } | null>(null);
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
  const updateFrieze = useEditorStore((state) => state.updateFrieze);
  const friezeDefaultLabel = useFriezeDefaultLabel();
  const updateStand = useEditorStore((state) => state.updateStand);
  const moveFurniture = useEditorStore((state) => state.moveFurniture);
  const moveObjects = useEditorStore((state) => state.moveObjects);
  const rotateFurniture = useEditorStore((state) => state.rotateFurniture);
  const openStandPlan = useEditorStore((state) => state.openStandPlan);
  const setViewport = useEditorStore((state) => state.setViewport);
  const undoAction = useEditorStore((state) => state.undo);
  const redoAction = useEditorStore((state) => state.redo);
  const floorPlan = useMemo(() => getFloorPlan(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const layers = useMemo(() => getFloorPlanLayers(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const objects = useMemo(() => getFloorPlanObjects(project, activeFloorPlanId), [activeFloorPlanId, project]);
  const standCompanies = useStandCompanies(objects.filter((object) => object.kind === "stand"));
  const selectedObject = useMemo(() => getCanvasObject(project, selectedObjectId), [project, selectedObjectId]);
  const planStand = floorPlan?.standObjectId ? getCanvasObject(project, floorPlan.standObjectId) : null;
  const standCarpet = planStand ? getObjectStandMeta(planStand)?.passport?.carpetColor : undefined;
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
  const knownLayerIds = new Set(layers.map((layer) => layer.id));
  // Прячем только объекты явно скрытого слоя. Объект с неизвестным слоем рисуем:
  // иначе он есть, считается и сохраняется, но на плане его не видно.
  const visibleObjects = objects.filter((object) => visibleLayerIds.has(object.layerId) || !knownLayerIds.has(object.layerId));
  const standObjects = visibleObjects.filter((object) => object.kind === "stand");
  // Порядок рисования: стены, фриз и оклейка снизу, мебель над ними, свет на самом верху —
  // споты крепят на стены и фриз, и они должны ложиться поверх, а не прятаться под панелью.
  const furnitureObjects = visibleObjects
    .filter((object) => object.kind === "equipment")
    .map((object, index) => ({ object, index, layer: drawLayer(object) }))
    .sort((a, b) => a.layer - b.layer || a.index - b.index)
    .map((entry) => entry.object);
  const gridOffset: Point = { x: floorPlan.grid.offsetX ?? 0, y: floorPlan.grid.offsetY ?? 0 };
  // Длина фриза цепляется к полуметру: стенды и стены меряют в тех же шагах.
  const friezeStepPx = (floorPlan.grid.cellSizePx / floorPlan.grid.metersPerCell) * 0.5;
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

  /**
   * Перетаскивание выделенной группы. Тянут один объект, остальные выделенные
   * едут следом на то же смещение; на отпускании всё записывается одним шагом
   * истории. Привязку к сетке задаёт объект, за который тянут.
   */
  const handleDragStart = (object: CanvasObject, event: Konva.KonvaEventObject<DragEvent>) => {
    // Ручку длины фриза тянут внутри панели — это не перетаскивание объекта.
    if (event.target !== event.currentTarget) return;
    groupDrag.current = null;
    if (!selectedObjectIds.includes(object.id) || selectedObjectIds.length < 2) return;

    const stage = event.target.getStage();
    if (!stage) return;
    const starts = new Map<string, { node: Konva.Node; x: number; y: number }>();
    for (const id of selectedObjectIds) {
      const node = id === object.id ? event.target : stage.findOne(`#${id}`);
      if (node) starts.set(id, { node, x: node.x(), y: node.y() });
    }
    groupDrag.current = { draggedId: object.id, starts };
  };

  const handleDragMove = (object: CanvasObject, event: Konva.KonvaEventObject<DragEvent>) => {
    const group = groupDrag.current;
    const start = group?.draggedId === object.id ? group.starts.get(object.id) : undefined;
    if (!group || !start) return;

    const dx = event.target.x() - start.x;
    const dy = event.target.y() - start.y;
    group.starts.forEach((item, id) => {
      if (id !== object.id) item.node.position({ x: item.x + dx, y: item.y + dy });
    });
  };

  /** Завершает перетаскивание группы; false — тянули одиночный объект. */
  const finishGroupDrag = (object: CanvasObject, snappedPosition: Point): boolean => {
    const group = groupDrag.current;
    const start = group?.draggedId === object.id ? group.starts.get(object.id) : undefined;
    groupDrag.current = null;
    if (!group || !start) return false;

    // Узлы возвращаем на места: новые позиции нарисует обновлённый проект.
    group.starts.forEach((item) => item.node.position({ x: item.x, y: item.y }));
    moveObjects([...group.starts.keys()], { x: snappedPosition.x - start.x, y: snappedPosition.y - start.y });
    return true;
  };

  const handleObjectDragEnd = (object: CanvasObject, event: Konva.KonvaEventObject<DragEvent>) => {
    const snapped = floorPlan.grid.snap
      ? snapPoint({ x: event.target.x(), y: event.target.y() }, floorPlan.grid.cellSizePx, gridOffset)
      : { x: event.target.x(), y: event.target.y() };
    if (finishGroupDrag(object, snapped)) return;

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
    const origin = floorPlan.grid.snap && isWallObject(object) ? snapWallEdges(object, raw, floorPlan.grid.cellSizePx, gridOffset) : raw;
    if (finishGroupDrag(object, origin)) return;
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
          {/* Площадка стенда закрашена цветом ковра из анкеты, по умолчанию серым. */}
          <Rect width={floorPlan.width} height={floorPlan.height} fill={floorPlan.kind === "stand" ? carpetFill(standCarpet) : "#f8fafb"} stroke="#c8ced6" strokeWidth={2} />
          {visibleLayerIds.has(`${floorPlan.id}-background`) && backgroundImage ? (
            <Image image={backgroundImage} width={floorPlan.width} height={floorPlan.height} opacity={0.78} />
          ) : null}
          {gridLines.map((line) => (
            <Line key={line.key} points={line.points} stroke={line.major ? "#aab3bf" : "#d8dde4"} strokeWidth={line.major ? 1 : 0.5} />
          ))}
        </Layer>

        {/*
          Пока рисуют новый стенд, стенды и предметы щелчков не ловят: иначе
          щелчок по соседнему стенду или стене выделял его или начинал перетаскивание,
          и вершину на его границе было не поставить.
        */}
        <Layer listening={tool !== "polygon"}>
          {standObjects.map((object) => (
            <StandShape
              key={object.id}
              object={object}
              company={standCompanies[object.id]}
              selected={selectedObjectIds.includes(object.id)}
              currentDeal={Boolean(crm.dealId && getObjectStandMeta(object)?.dealId === crm.dealId)}
              cellSizePx={floorPlan.grid.cellSizePx}
              metersPerCell={floorPlan.grid.metersPerCell}
              draggable={mode === "admin"}
              onSelect={(additive) => selectObject(object.id, additive)}
              onOpen={() => openStandPlan(object.id)}
              onDragStart={(event) => handleDragStart(object, event)}
              onDragMove={(event) => handleDragMove(object, event)}
              onDragEnd={(event) => handleObjectDragEnd(object, event)}
            />
          ))}

          {furnitureObjects.map((object) =>
            stripKindOf(object) ? (
              <FriezeShape
                key={object.id}
                object={object}
                kind={stripKindOf(object) ?? "frieze"}
                selected={selectedObjectIds.includes(object.id)}
                defaultLabel={stripKindOf(object) === "film" ? "ОКЛЕЙКА" : friezeDefaultLabel || "ФРИЗ"}
                lengthStepPx={friezeStepPx}
                onSelect={(additive) => selectObject(object.id, additive)}
                onDragStart={(event) => handleDragStart(object, event)}
                onDragMove={(event) => handleDragMove(object, event)}
                onDragEnd={(event) => handleFurnitureDragEnd(object, event)}
                onResize={(lengthPx) => updateFrieze(object.id, { lengthPx })}
              />
            ) : (
              <FurnitureShape
                key={object.id}
                object={object}
                selected={selectedObjectIds.includes(object.id)}
                onSelect={(additive) => selectObject(object.id, additive)}
                onDragStart={(event) => handleDragStart(object, event)}
                onDragMove={(event) => handleDragMove(object, event)}
                onDragEnd={(event) => handleFurnitureDragEnd(object, event)}
              />
            ),
          )}

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
  /** Короткое название компании из сделки; пусто — стенд без сделки. */
  company?: string;
  selected: boolean;
  currentDeal: boolean;
  draggable: boolean;
  cellSizePx: number;
  metersPerCell: number;
  onSelect: (additive: boolean) => void;
  onOpen: () => void;
} & DragHandlers;

/** Перетаскивание объекта; начало и ход нужны, чтобы вместе с ним ехала выделенная группа. */
type DragHandlers = {
  onDragStart: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
};

function StandShape({ object, company, selected, currentDeal, draggable, cellSizePx, metersPerCell, onSelect, onOpen, onDragStart, onDragMove, onDragEnd }: StandShapeProps) {
  const points = getObjectPoints(object);
  const center = polygonCentroid(points);
  const standMeta = getObjectStandMeta(object);
  const area = polygonArea(points, metersPerCell, cellSizePx);
  const fill = currentDeal ? currentDealColor : statusColors[standMeta?.status ?? "available"];

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const boxWidth = Math.max(...xs) - Math.min(...xs);
  const boxHeight = Math.max(...ys) - Math.min(...ys);
  const labelBox = { x: Math.min(...xs) + 2, width: Math.max(boxWidth - 4, 10) };
  const lines = [
    { text: standMeta?.number ?? object.name, bold: true },
    ...(company ? [{ text: company, bold: false }] : []),
    { text: `${area} м²`, bold: false },
  ];
  // Шрифт по ширине и высоте стенда, не крупнее прежних 18.
  // Стенд 2 x 3 м на карте ЦБСС — около 55 x 83 пикселей: номер влезает и восемнадцатым.
  const fontSize = Math.max(6, Math.min(18, boxWidth / 3, (boxHeight * 0.9) / (lines.length * 1.15)));
  const lineHeight = fontSize * 1.15;

  return (
    <Group
      id={object.id}
      draggable={draggable}
      onClick={(event) => onSelect(event.evt.ctrlKey || event.evt.metaKey)}
      onTap={() => onSelect(false)}
      onDblClick={onOpen}
      onDblTap={onOpen}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <Line
        points={flattenPoints(points)}
        closed
        fill={fill}
        // Непрозрачно: сквозь полупрозрачный стенд просвечивали линии и надписи подложки,
        // и подпись стенда читалась плохо.
        opacity={1}
        stroke={selected ? "#0b57d0" : "#253141"}
        strokeWidth={selected ? 4 : 2}
        lineJoin="round"
        shadowColor={selected ? "#1a73e8" : undefined}
        shadowBlur={selected ? 8 : 0}
      />
      {/*
        Подпись по ширине стенда: номер, компания, площадь. Длинное название
        обрезается многоточием, а шрифт мельчает на узком стенде — иначе
        подписи соседних стендов наезжали бы друг на друга.
      */}
      <Group x={labelBox.x} y={center.y - (lineHeight * lines.length) / 2} listening={false}>
        {lines.map((line, index) => (
          <Text
            key={index}
            y={index * lineHeight}
            width={labelBox.width}
            align="center"
            text={line.text}
            fill="#101820"
            fontStyle={line.bold ? "bold" : "normal"}
            fontSize={line.bold ? fontSize : fontSize * 0.85}
            wrap="none"
            ellipsis
          />
        ))}
      </Group>
    </Group>
  );
}

type FurnitureShapeProps = {
  object: CanvasObject;
  selected: boolean;
  onSelect: (additive: boolean) => void;
} & DragHandlers;

function FurnitureShape({ object, selected, onSelect, onDragStart, onDragMove, onDragEnd }: FurnitureShapeProps) {
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
  const look = plainWallIds.has(meta.itemId) ? "wall" : meta.itemId === "dver-razdvizhnaya" ? "sliding-door" : "picture";
  const frameless = framelessIds.has(meta.itemId);

  if (look !== "picture") {
    // Стены и раздвижная дверь — условные обозначения, как на строительном плане:
    // стена — сплошная чёрная полоса по периметру, дверь — чёрный зигзаг.
    // Рисуются вдоль панели, поэтому поворачиваются вместе с ней.
    const color = selected ? "#0b57d0" : "#111827";
    const teeth = Math.max(4, Math.round(width / Math.max(height, 1)));
    const zigzag = Array.from({ length: teeth + 1 }, (_, index) => [(width * index) / teeth, index % 2 === 0 ? height * 0.1 : height * 0.9]).flat();

    return (
      <Group
        id={object.id}
        x={origin.x}
        y={origin.y}
        draggable
        onClick={(event) => onSelect(event.evt.ctrlKey || event.evt.metaKey)}
        onTap={() => onSelect(false)}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
      >
        {/* Прозрачная подложка ловит щелчок по всей рамке, а не только по линиям зигзага. */}
        <Rect width={boxWidth} height={boxHeight} fill={look === "wall" ? color : "rgba(0,0,0,0.001)"} stroke={selected && look !== "wall" ? "#0b57d0" : undefined} strokeWidth={1} />
        {look === "sliding-door" ? (
          <Group x={shift.x} y={shift.y} rotation={meta.rotation} listening={false}>
            <Line points={zigzag} stroke={color} strokeWidth={Math.max(1.5, height * 0.18)} lineJoin="miter" lineCap="square" />
          </Group>
        ) : null}
      </Group>
    );
  }

  return (
    <Group
      id={object.id}
      x={origin.x}
      y={origin.y}
      draggable
      onClick={(event) => onSelect(event.evt.ctrlKey || event.evt.metaKey)}
      onTap={() => onSelect(false)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      {/* Условные значки (вешалка, корзина) — без белой рамки: рамка появляется только у выделенного. */}
      <Rect
        width={boxWidth}
        height={boxHeight}
        fill={frameless ? "rgba(0,0,0,0.001)" : selected ? "#e8f0fe" : "#ffffff"}
        stroke={selected ? "#0b57d0" : frameless ? undefined : "#5b6674"}
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

/** Как выглядят полосы: фриз голубой, оклейка янтарная — чтобы не путать на плане. */
const stripStyle: Record<
  StripKind,
  { fill: string; selectedFill: string; stroke: string; text: string; limit: number | null; /** Высота букв от толщины полосы. */ fontScale: number }
> = {
  frieze: { fill: "#dceaf6", selectedFill: "#d2e3fc", stroke: "#5b6674", text: "#253141", limit: friezeMaxChars, fontScale: 0.62 },
  // У оклейки надпись — пометка вроде цвета плёнки, а не текст на панели: мельче.
  film: { fill: "#fdecc8", selectedFill: "#fbd99a", stroke: "#b06000", text: "#7a4100", limit: null, fontScale: 0.38 },
};

type FriezeShapeProps = {
  object: CanvasObject;
  kind: StripKind;
  selected: boolean;
  /** Надпись, если в панели своя не задана, — из названия сделки. */
  defaultLabel: string;
  /** Шаг, к которому цепляется длина при растягивании, в пикселях плана. */
  lengthStepPx: number;
  onSelect: (additive: boolean) => void;
  onResize: (lengthPx: number) => void;
} & DragHandlers;

/**
 * Фризовая панель: растягивается в длину, а надпись остаётся прежнего размера.
 *
 * Картинку каталога для фриза использовать нельзя — при растягивании
 * растянулись бы и буквы. Поэтому панель рисуется прямоугольником, а надпись —
 * отдельным текстом, высота которого зависит только от толщины панели.
 *
 * Всё рисуется в группе, повёрнутой вместе с панелью, поэтому ручка длины
 * у повёрнутой панели сама оказывается на её конце.
 */
function FriezeShape({ object, kind, selected, defaultLabel, lengthStepPx, onSelect, onDragStart, onDragMove, onDragEnd, onResize }: FriezeShapeProps) {
  const meta = getObjectFurnitureMeta(object);
  if (object.shape.kind !== "rectangle" || !meta) return null;

  const style = stripStyle[kind];
  const { origin, width: length, height: depth } = object.shape;
  const shift = imageShift(meta.rotation, length, depth);
  const label = meta.label ?? defaultLabel;
  // Перевёрнутая надпись не читается — у панели, развёрнутой на 180 и 270
  // градусов, текст разворачиваем обратно.
  const flipText = meta.rotation === 180 || meta.rotation === 270;
  // Ручка меньше толщины панели: крупная закрывала надпись и соседние стены.
  const handleRadius = Math.max(3, depth * 0.22);

  return (
    <Group
      id={object.id}
      x={origin.x}
      y={origin.y}
      draggable
      onClick={(event) => onSelect(event.evt.ctrlKey || event.evt.metaKey)}
      onTap={() => onSelect(false)}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
    >
      <Group x={shift.x} y={shift.y} rotation={meta.rotation}>
        <Rect
          width={length}
          height={depth}
          fill={selected ? style.selectedFill : style.fill}
          stroke={selected ? "#0b57d0" : style.stroke}
          strokeWidth={selected ? 2.5 : 1.5}
        />
        <FriezeLabel label={label} length={length} depth={depth} flip={flipText} color={style.text} limit={style.limit} fontScale={style.fontScale} />

        {selected ? (
          <Circle
            x={length}
            y={depth / 2}
            radius={handleRadius}
            fill="#ffffff"
            stroke="#0b57d0"
            strokeWidth={1.5}
            // Ловит мышь чуть шире, чем нарисована: маленькую ручку легко промахнуться.
            hitStrokeWidth={8}
            draggable
            onMouseDown={(event) => {
              // Иначе нажатие на ручку потащило бы всю панель.
              event.cancelBubble = true;
            }}
            onDragMove={(event) => {
              event.cancelBubble = true;
              // Ручка ходит только вдоль панели.
              event.target.y(depth / 2);
              event.target.x(Math.max(lengthStepPx, event.target.x()));
            }}
            onDragEnd={(event) => {
              event.cancelBubble = true;
              const raw = Math.max(lengthStepPx, event.target.x());
              const snapped = Math.max(lengthStepPx, Math.round(raw / lengthStepPx) * lengthStepPx);
              // Возвращаем ручку на место: новую длину нарисует уже обновлённая панель.
              event.target.position({ x: length, y: depth / 2 });
              onResize(snapped);
            }}
          />
        ) : null}
      </Group>
    </Group>
  );
}

/**
 * Надпись фриза: первые 15 знаков тёмным, лишние — красным.
 *
 * Konva не красит часть строки другим цветом, поэтому надпись рисуется двумя
 * кусками, а ширина каждого измеряется, чтобы вместе они стояли по центру.
 * Если надпись длиннее панели, шрифт уменьшается — буквы не растягиваются
 * и не вылезают за край.
 */
function FriezeLabel({
  label,
  length,
  depth,
  flip,
  color,
  limit,
  fontScale,
}: {
  label: string;
  length: number;
  depth: number;
  flip: boolean;
  color: string;
  /** Сколько знаков помещается; лишние красным. У оклейки ограничения нет. */
  limit: number | null;
  fontScale: number;
}) {
  const { fits, extra } = limit === null ? { fits: label, extra: "" } : splitFriezeLabel(label);
  const baseSize = depth * fontScale;

  const measure = (text: string, size: number) =>
    text ? new Konva.Text({ text, fontSize: size, fontStyle: "bold" }).getTextWidth() : 0;

  const naturalWidth = measure(fits, baseSize) + measure(extra, baseSize);
  const available = length * 0.92;
  const fontSize = naturalWidth > available ? baseSize * (available / naturalWidth) : baseSize;

  const fitsWidth = measure(fits, fontSize);
  const total = fitsWidth + measure(extra, fontSize);

  return (
    // Центр группы — центр панели: так надпись переворачивается на месте.
    <Group x={length / 2} y={depth / 2} rotation={flip ? 180 : 0} listening={false}>
      <Text x={-total / 2} y={-fontSize / 2} text={fits} fontSize={fontSize} fontStyle="bold" fill={color} />
      {extra ? <Text x={-total / 2 + fitsWidth} y={-fontSize / 2} text={extra} fontSize={fontSize} fontStyle="bold" fill="#d93025" /> : null}
    </Group>
  );
}

/** Глухие стеновые панели — рисуются сплошной чёрной полосой. Стена с занавеской и стеклом — картинкой. */
const plainWallIds = new Set(["wall_1", "wall_05", "stena-10", "stena-05"]);

/** Предметы-значки, которые рисуются без белой рамки вокруг картинки. */
const framelessIds = new Set(["veshalka-nastennaya", "korzina", "plazma-50"]);

/** Слой рисования предмета: 0 — стены и полосы, 1 — мебель, 2 — свет. */
function drawLayer(object: CanvasObject): number {
  const meta = getObjectFurnitureMeta(object);
  const category = meta ? getFurnitureItem(meta.itemId)?.category : undefined;
  if (category === "lighting") return 2;
  return category === "walls" ? 0 : 1;
}

/**
 * Привязка стены, фриза или оклейки к линиям сетки — ближайшим краем.
 *
 * Раньше к линии цеплялся только левый верхний угол. Панель толщиной
 * в треть клетки, поставленная снаружи вплотную к стенду, прыгала
 * внутрь: её угол ближе к линии границы, чем к следующей. Теперь по каждой
 * оси к линии прижимается тот край, который к ней ближе, — и снаружи,
 * и изнутри панель встаёт вплотную к границе.
 */
function snapWallEdges(object: CanvasObject, raw: Point, gridSize: number, offset: Point): Point {
  if (object.shape.kind !== "rectangle") return snapPoint(raw, gridSize, offset);

  const rotation = getObjectFurnitureMeta(object)?.rotation ?? 0;
  const turned = rotation === 90 || rotation === 270;
  // Размер на плане: у повёрнутой панели длина и толщина меняются местами.
  const sizeX = turned ? object.shape.height : object.shape.width;
  const sizeY = turned ? object.shape.width : object.shape.height;

  const snapAxis = (start: number, size: number, axisOffset: number) => {
    const line = (value: number) => Math.round((value - axisOffset) / gridSize) * gridSize + axisOffset;
    const byStart = line(start);
    const byEnd = line(start + size) - size;
    return Math.abs(byStart - start) <= Math.abs(byEnd - start) ? byStart : byEnd;
  };

  return { x: snapAxis(raw.x, sizeX, offset.x), y: snapAxis(raw.y, sizeY, offset.y) };
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
