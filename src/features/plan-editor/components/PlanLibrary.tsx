import { useEffect, useState } from "react";
import { loadPlanLibrary, savePlanLibrary, type SavedPlan } from "../../../shared/crm/planLibrary";
import { bundledPlans, type BundledPlan } from "../../../shared/domain/bundledPlans";
import type { FloorPlan } from "../../../shared/domain/types";
import { useEditorStore } from "../store/editorStore";

/**
 * Список планов выставок: готовые из состава приложения и сохранённые.
 *
 * Сохранить можно план, который лежит на хостинге, — тогда его картинку
 * увидят все. План, оставшийся только в браузере, в общий список не годится:
 * у коллег на его месте была бы пустота.
 */

type Props = {
  plan: FloorPlan;
  /** Подложку сменили — прежние подсказки про масштаб уже не про неё. */
  onApplied: () => void;
};

export function PlanLibrary({ plan, onApplied }: Props) {
  const crm = useEditorStore((state) => state.crm);
  const project = useEditorStore((state) => state.project);
  const setFloorPlanBackground = useEditorStore((state) => state.setFloorPlanBackground);
  const fitToScreen = useEditorStore((state) => state.fitToScreen);

  const [saved, setSaved] = useState<SavedPlan[]>([]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  /** Какой план ждёт второго щелчка — для замены подложки или удаления из списка. */
  const [armed, setArmed] = useState<{ id: string; action: "apply" | "remove" } | null>(null);

  const inPortal = crm.provider === "bitrix24";

  useEffect(() => {
    if (!inPortal) return;

    let cancelled = false;
    void loadPlanLibrary()
      .then((plans) => {
        if (!cancelled) setSaved(plans);
      })
      .catch((error: unknown) => console.warn("Не удалось загрузить список планов.", error));

    return () => {
      cancelled = true;
    };
  }, [inPortal]);

  const imageUrl = plan.background?.imageUrl ?? "";
  const isLocalOnly = imageUrl.startsWith("data:");
  const alreadyListed = [...bundledPlans, ...saved].some((item) => item.background.imageUrl === imageUrl);

  const saveBlocker = !inPortal
    ? "Сохранять в общий список можно только из портала: откройте приложение из карточки сделки."
    : !plan.background
      ? "Сначала загрузите план кнопкой «Загрузить план» на панели инструментов."
      : alreadyListed
        ? "Текущий план уже есть в списке."
        : isLocalOnly
          ? "Этот план не удалось сохранить на хостинг, он остался только в вашем браузере. Загрузите его заново. Если не выходит — проверьте, что в настройках приложения в портале указан адрес https://alitinform.ru/stand-editor/."
          : null;

  const apply = (item: BundledPlan) => {
    const current = imageUrl === item.background.imageUrl;
    if (current) return;

    // Одним щелчком подложка менялась молча. Если своя уже стоит, первый
    // щелчок только спрашивает, второй — заменяет.
    if (plan.background && !(armed?.id === item.id && armed.action === "apply")) {
      setArmed({ id: item.id, action: "apply" });
      return;
    }

    setArmed(null);
    setFloorPlanBackground(plan.id, item.background, { width: item.background.width, height: item.background.height }, item.grid);
    onApplied();
    fitToScreen();
  };

  const saveCurrent = async () => {
    if (!plan.background) return;

    const name = title.trim() || project?.exhibitions[0]?.title || plan.background.name;
    const entry: SavedPlan = {
      id: `saved-${Date.now()}`,
      title: name,
      description: `Сохранён ${new Date().toLocaleDateString("ru-RU")}. Клетка ${String(plan.grid.cellSizePx).replace(".", ",")} px.`,
      background: plan.background,
      grid: {
        cellSizePx: plan.grid.cellSizePx,
        metersPerCell: plan.grid.metersPerCell,
        offsetX: plan.grid.offsetX ?? 0,
        offsetY: plan.grid.offsetY ?? 0,
      },
      savedAt: new Date().toISOString(),
    };

    const next = [...saved, entry];
    setStatus("Сохраняю в список...");
    try {
      await savePlanLibrary(next);
      setSaved(next);
      setTitle("");
      setStatus(`«${name}» в списке планов — коллеги увидят его, открыв приложение.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить план в список.");
    }
  };

  const remove = async (item: SavedPlan) => {
    if (!(armed?.id === item.id && armed.action === "remove")) {
      setArmed({ id: item.id, action: "remove" });
      return;
    }

    setArmed(null);
    const next = saved.filter((entry) => entry.id !== item.id);
    try {
      await savePlanLibrary(next);
      setSaved(next);
      setStatus(`«${item.title}» убран из списка. Подложка на карте осталась прежней.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось убрать план из списка.");
    }
  };

  return (
    <>
      <h2>Планы выставок</h2>
      <div className="stand-templates">
        {[...bundledPlans, ...saved].map((item) => {
          const current = imageUrl === item.background.imageUrl;
          const confirmApply = armed?.id === item.id && armed.action === "apply";
          const confirmRemove = armed?.id === item.id && armed.action === "remove";
          const removable = saved.some((entry) => entry.id === item.id);

          return (
            <div key={item.id} className="plan-library__row">
              <button
                type="button"
                className={confirmApply ? "is-danger" : current ? "is-active" : ""}
                onClick={() => apply(item)}
                onBlur={() => setArmed((value) => (value?.id === item.id && value.action === "apply" ? null : value))}
                title={item.description}
              >
                <strong>{current ? `${item.title} — уже стоит` : item.title}</strong>
                <span>{confirmApply ? "Нажмите ещё раз, чтобы заменить текущий план. Отменить можно через Ctrl+Z." : item.description}</span>
              </button>

              {removable ? (
                <button
                  type="button"
                  className={confirmRemove ? "plan-library__remove is-danger" : "plan-library__remove"}
                  onClick={() => void remove(item as SavedPlan)}
                  onBlur={() => setArmed((value) => (value?.id === item.id && value.action === "remove" ? null : value))}
                  title="Убрать из списка"
                >
                  {confirmRemove ? "Убрать?" : "×"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/*
        Блок сохранения виден всегда. Раньше он появлялся только при нескольких
        условиях сразу и молча прятался, если хоть одно не выполнено, — кнопку
        просто не находили. Теперь, если сохранить нельзя, сказано почему.
      */}
      <div className="plan-library__save">
        <h3>Сохранить текущий план в список</h3>
        <input
          value={title}
          placeholder="Название, например ЦБСС 2027"
          disabled={Boolean(saveBlocker)}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="button" className="primary-action" disabled={Boolean(saveBlocker)} onClick={() => void saveCurrent()}>
          Сохранить в список
        </button>
        {saveBlocker ? <p className="stand-hint">{saveBlocker}</p> : null}
      </div>

      {status ? <p>{status}</p> : null}
    </>
  );
}
