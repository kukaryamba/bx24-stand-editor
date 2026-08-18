import { useEffect, useRef, useState } from "react";
import { buildStandPlanPayload, loadStandPlan, saveStandPlan } from "../../../shared/crm/standPlanRepository";
import { getCanvasObject, getObjectStandMeta } from "../../../shared/domain/project";
import type { FloorPlan } from "../../../shared/domain/types";
import { useEditorStore } from "../store/editorStore";

/**
 * Обмен планом стенда со сделкой без ручных кнопок.
 *
 * Площадка стенда хранится в поле его сделки, а не в браузере. Пока обмен
 * шёл только по кнопкам, коллега в другом аккаунте открывал пустой стенд:
 * у него в браузере ничего не было, а из сделки никто не загружал.
 *
 * Поэтому при открытии площадки её содержимое подтягивается из сделки,
 * а изменения уезжают обратно с задержкой в две секунды.
 */
export function useStandPlanSync(plan: FloorPlan | null, enabled: boolean): string | null {
  const [error, setError] = useState<string | null>(null);
  const project = useEditorStore((state) => state.project);
  const crm = useEditorStore((state) => state.crm);
  const replacePlanObjects = useEditorStore((state) => state.replacePlanObjects);

  /** Площадки, которые уже подтянули: повторно перечитывать нельзя, затрёт правки. */
  const loaded = useRef(new Set<string>());
  /** Что уже лежит в сделке — чтобы не слать одно и то же. */
  const saved = useRef(new Map<string, string>());

  const stand = plan?.standObjectId ? getCanvasObject(project, plan.standObjectId) : null;
  const dealId = (stand ? getObjectStandMeta(stand)?.dealId : null) ?? crm.dealId;
  const active = enabled && plan?.kind === "stand" && Boolean(dealId);
  const planId = plan?.id ?? null;

  useEffect(() => {
    if (!active || !planId || !dealId || loaded.current.has(planId)) return;

    let cancelled = false;
    loaded.current.add(planId);

    void loadStandPlan(dealId)
      .then((payload) => {
        if (cancelled || !payload) return;
        replacePlanObjects(planId, payload.objects);
        saved.current.set(planId, JSON.stringify(payload.objects));
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        loaded.current.delete(planId);
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить план стенда из сделки.");
      });

    return () => {
      cancelled = true;
    };
  }, [active, dealId, planId, replacePlanObjects]);

  useEffect(() => {
    if (!active || !planId || !dealId || !project) return;
    // Пока содержимое сделки не прочитано, сохранять нечего: затрём чужое.
    if (!loaded.current.has(planId)) return;

    const payload = buildStandPlanPayload(project, planId);
    const snapshot = JSON.stringify(payload.objects);
    if (saved.current.get(planId) === snapshot) return;

    const timer = window.setTimeout(() => {
      void saveStandPlan(dealId, payload)
        .then(() => {
          saved.current.set(planId, snapshot);
          setError(null);
        })
        .catch((saveError: unknown) => {
          setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить план стенда в сделку.");
        });
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [active, dealId, planId, project]);

  return error;
}
