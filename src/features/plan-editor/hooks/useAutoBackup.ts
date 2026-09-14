import { useEffect, useRef } from "react";
import { buildSnapshot, uploadSnapshot } from "../../../shared/storage/backup";
import { useEditorStore } from "../store/editorStore";

/**
 * Автоматические снимки на хостинг.
 *
 * Снимок делается, когда карту выставки правили, но не чаще раза в полчаса:
 * снимок тянет предметы всех стендов из сделок, и делать это на каждую правку
 * незачем. Хостинг сам прореживает старые снимки.
 *
 * Пока карта не пришла из портала, ничего не отправляем — иначе в копии
 * оказалась бы пустая стартовая заготовка.
 */

const minIntervalMs = 30 * 60 * 1000;
const debounceMs = 20 * 1000;
const lastBackupKey = "stand-editor-last-auto-backup";

export function useAutoBackup(portalReady: boolean): void {
  const project = useEditorStore((state) => state.project);
  const crm = useEditorStore((state) => state.crm);
  const isDirty = useEditorStore((state) => state.isDirty);

  /** Правили ли что-то в этот раз — без правок снимок не нужен. */
  const edited = useRef(false);
  const running = useRef(false);

  if (isDirty) edited.current = true;

  useEffect(() => {
    if (crm.provider !== "bitrix24" || !portalReady || !project || !edited.current) return;

    const timer = window.setTimeout(() => {
      const last = readLastBackup();
      if (running.current || Date.now() - last < minIntervalMs) return;

      running.current = true;
      void buildSnapshot(project, "auto")
        .then(uploadSnapshot)
        .then(() => writeLastBackup(Date.now()))
        .catch((error: unknown) => console.warn("Автоматическая резервная копия не сохранилась.", error))
        .finally(() => {
          running.current = false;
        });
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [crm.provider, portalReady, project]);
}

function readLastBackup(): number {
  try {
    return Number(window.localStorage.getItem(lastBackupKey)) || 0;
  } catch {
    return 0;
  }
}

function writeLastBackup(value: number): void {
  try {
    window.localStorage.setItem(lastBackupKey, String(value));
  } catch {
    // Не страшно: в худшем случае снимок сделается чуть раньше.
  }
}
