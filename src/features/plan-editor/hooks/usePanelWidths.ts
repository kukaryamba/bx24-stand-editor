import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ширина боковых панелей, которую можно тянуть мышью.
 *
 * Раньше она была задана в вёрстке жёстко, и на ноутбучном экране холсту
 * оставалась узкая полоса: панели забирали 620 пикселей из 1366. Настройка
 * держится в браузере — это вид рабочего места, а не данные проекта.
 */

export type PanelSide = "left" | "right";

export type PanelWidths = {
  left: number;
  right: number;
};

const storageKey = "bitrix24-expo-plan-panels";
const defaults: PanelWidths = { left: 280, right: 340 };
const minWidth = 180;
const maxWidth = 560;

export function usePanelWidths() {
  const [widths, setWidths] = useState<PanelWidths>(readStored);
  const drag = useRef<{ side: PanelSide; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(widths));
    } catch {
      // Приватный режим или переполненное хранилище: ширина панелей не та
      // потеря, из-за которой стоит показывать ошибку.
    }
  }, [widths]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const current = drag.current;
      if (!current) return;

      // Правая панель растёт влево, поэтому знак смещения у неё обратный.
      const delta = current.side === "left" ? event.clientX - current.startX : current.startX - event.clientX;
      const next = clamp(current.startWidth + delta);

      setWidths((previous) => (previous[current.side] === next ? previous : { ...previous, [current.side]: next }));
    };

    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.classList.remove("is-resizing");
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const startResize = useCallback(
    (side: PanelSide) => (event: React.PointerEvent) => {
      event.preventDefault();
      drag.current = { side, startX: event.clientX, startWidth: widths[side] };
      // Пока тянем, курсор не должен превращаться в текстовый над панелями.
      document.body.classList.add("is-resizing");
    },
    [widths],
  );

  const resetPanel = useCallback((side: PanelSide) => {
    setWidths((previous) => ({ ...previous, [side]: defaults[side] }));
  }, []);

  return { widths, startResize, resetPanel };
}

function clamp(value: number): number {
  return Math.min(Math.max(Math.round(value), minWidth), maxWidth);
}

function readStored(): PanelWidths {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<PanelWidths>;
    return {
      left: clamp(Number(parsed.left) || defaults.left),
      right: clamp(Number(parsed.right) || defaults.right),
    };
  } catch {
    return defaults;
  }
}
