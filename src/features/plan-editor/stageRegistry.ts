import type Konva from "konva";

/**
 * Ссылка на холст Konva.
 *
 * Нужна, чтобы кнопки в панели инструментов могли сохранить картинку плана.
 * Хранить объект Konva в общем состоянии нельзя — это не данные, а живой узел
 * дерева отрисовки, поэтому ссылка лежит отдельно.
 */

let stage: Konva.Stage | null = null;

export function registerStage(next: Konva.Stage | null): void {
  stage = next;
}

export function getStage(): Konva.Stage | null {
  return stage;
}
