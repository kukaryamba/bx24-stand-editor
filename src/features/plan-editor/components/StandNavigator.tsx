import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { getFloorPlanObjects, getObjectStandMeta, findFloorPlanByKind, findStandPlan } from "../../../shared/domain/project";
import { statusLabels } from "../../../shared/domain/status";
import { useEditorStore } from "../store/editorStore";

/**
 * Переход между стендами, не возвращаясь на карту выставки.
 *
 * Показывает все стенды с карты: у которых площадка уже заведена — с пометкой,
 * остальные заводятся при первом открытии.
 */
export function StandNavigator() {
  const project = useEditorStore((state) => state.project);
  const activeStandObjectId = useEditorStore((state) => state.activeStandObjectId);
  const openStandPlan = useEditorStore((state) => state.openStandPlan);
  const backToExpoPlan = useEditorStore((state) => state.backToExpoPlan);

  const stands = useMemo(() => {
    const expoPlan = findFloorPlanByKind(project, "expo");
    return getFloorPlanObjects(project, expoPlan?.id ?? null).filter((object) => object.kind === "stand");
  }, [project]);

  return (
    <div className="panel-section stand-nav">
      <button className="stand-nav__back" onClick={backToExpoPlan}>
        <ArrowLeft size={16} aria-hidden />
        К плану выставки
      </button>

      <h2>Стенды выставки</h2>

      {stands.length === 0 ? (
        <p className="stand-nav__hint">На карте выставки пока нет стендов. Нарисуйте их на общем плане.</p>
      ) : (
        <div className="stand-nav__list">
          {stands.map((stand) => {
            const meta = getObjectStandMeta(stand);
            const hasPlan = Boolean(findStandPlan(project, stand.id));
            const isActive = stand.id === activeStandObjectId;

            return (
              <button
                key={stand.id}
                type="button"
                className={isActive ? "is-active" : ""}
                onClick={() => openStandPlan(stand.id)}
                title={hasPlan ? "План стенда уже заведён" : "План будет создан при открытии"}
              >
                <strong>{meta?.number ?? stand.name}</strong>
                <span>
                  {meta ? statusLabels[meta.status] : "—"}
                  {hasPlan ? " · план есть" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
