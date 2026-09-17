import { useEffect, useRef, useState } from "react";
import {
  buildSnapshot,
  downloadSnapshot,
  fetchSnapshot,
  listSnapshots,
  parseSnapshot,
  restoreSnapshot,
  uploadSnapshot,
  type BackupListItem,
  type BackupReason,
  type BackupSnapshot,
} from "../../../shared/storage/backup";
import { useEditorStore } from "../store/editorStore";

/**
 * Резервные копии: список снимков на хостинге, копия вручную, файл на компьютер
 * и восстановление.
 *
 * Стоит на экране установки: это действие администратора, в карточке сделки
 * ему не место — там легко нажать случайно.
 */

const reasonTitles: Record<BackupReason, string> = {
  auto: "автоматически",
  manual: "вручную",
  "before-restore": "перед восстановлением",
  download: "скачана",
};

export function BackupPanel() {
  const project = useEditorStore((state) => state.project);

  const [items, setItems] = useState<BackupListItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  /** Какой снимок ждёт второго щелчка: восстановление заменяет всё. */
  const [armed, setArmed] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    try {
      setItems(await listSnapshots());
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Не удалось получить список копий.", error: true });
      setItems([]);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setArmed(null);
    try {
      await task();
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Не получилось.", error: true });
    } finally {
      setBusy(false);
    }
  };

  const backupNow = () =>
    run(async () => {
      if (!project) throw new Error("Карта выставки ещё не загрузилась.");
      setStatus({ text: "Собираю копию — в неё входят предметы всех стендов из сделок..." });
      await uploadSnapshot(await buildSnapshot(project, "manual"));
      setStatus({ text: "Копия сохранена на хостинг." });
      await refresh();
    });

  const downloadFull = () =>
    run(async () => {
      if (!project) throw new Error("Карта выставки ещё не загрузилась.");
      setStatus({ text: "Собираю полную копию вместе с картинками планов..." });
      downloadSnapshot(await buildSnapshot(project, "download", true));
      setStatus({ text: "Файл копии скачан. Сохраните его в надёжное место — не только на этот компьютер." });
    });

  const restore = (load: () => Promise<BackupSnapshot>) =>
    run(async () => {
      if (!project) throw new Error("Карта выставки ещё не загрузилась.");
      const snapshot = await load();
      await restoreSnapshot(snapshot, project, (text) => setStatus({ text }));
      setStatus({ text: "Готово. Перезагружаю приложение, чтобы показать восстановленные данные..." });
      // Проще и надёжнее начать с чистого листа, чем подменять данные на ходу.
      window.setTimeout(() => window.location.reload(), 1500);
    });

  const onRestoreClick = (name: string) => {
    if (armed !== name) {
      setArmed(name);
      return;
    }
    void restore(() => fetchSnapshot(name));
  };

  const onFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const text = await file.text();
    void restore(async () => parseSnapshot(text));
  };

  return (
    <div className="install-card__section">
      <h2>Резервные копии</h2>
      <p>
        Копия сохраняет всё: стенды на карте выставки, предметы на площадках, анкеты паспортов, список планов и воронку.
        Автоматически копия уходит на хостинг, когда карту правили, не чаще раза в полчаса.
      </p>

      <div className="backup-actions">
        <button type="button" className="primary-action" disabled={busy} onClick={() => void backupNow()}>
          Сделать копию сейчас
        </button>
        <button type="button" disabled={busy} onClick={() => void downloadFull()}>
          Скачать полную копию
        </button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>
          Восстановить из файла
        </button>
        <input ref={fileInput} type="file" className="visually-hidden" onChange={(event) => void onFileChosen(event)} />
      </div>
      <p className="stand-hint">
        Скачанная копия включает и картинки планов — она выручит, даже если пропадёт хостинг. Делайте её перед каждой выставкой.
      </p>

      {status ? <p className={status.error ? "install-card__error" : "install-card__ok"}>{status.text}</p> : null}

      <h3 className="backup-list__title">Копии на хостинге</h3>
      {items === null ? <p>Загружаю список...</p> : null}
      {items?.length === 0 ? <p>Копий пока нет.</p> : null}

      {items && items.length > 0 ? (
        <ul className="backup-list">
          {items.slice(0, 30).map((item) => (
            <li key={item.name}>
              <span>
                {new Date(item.savedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}
                <small>
                  {item.reason ? reasonTitles[item.reason] : "копия"} · {Math.max(1, Math.round(item.size / 1024))} КБ
                </small>
              </span>
              <button
                type="button"
                className={armed === item.name ? "is-danger" : ""}
                disabled={busy}
                onClick={() => onRestoreClick(item.name)}
                onBlur={() => setArmed((value) => (value === item.name ? null : value))}
              >
                {armed === item.name ? "Заменить текущие данные?" : "Восстановить"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="stand-hint">
        Восстановление заменяет текущие данные. Перед этим текущее состояние само сохраняется в копию «перед
        восстановлением» — если выбрали не тот снимок, вернуться можно так же.
      </p>
    </div>
  );
}
