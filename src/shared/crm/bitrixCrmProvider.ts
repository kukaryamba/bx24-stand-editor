import type { CrmProvider } from "./crmProvider";
import type { CrmContext, ExhibitionProject } from "../domain/types";
import { bitrixInit, isBitrixEnvironment } from "./bitrixApi";
import { buildStandPlanPayload, saveStandPlan } from "./standPlanRepository";

export const bitrixCrmProvider: CrmProvider = {
  init: async (): Promise<CrmContext> => {
    if (!isBitrixEnvironment()) {
      // Локальный режим: сделку можно подставить вручную через ?dealId=123
      return { provider: "mock", dealId: getQueryParam("dealId"), userId: null, placement: null };
    }

    await bitrixInit();
    const placement = window.BX24?.placement?.info();
    const options = (placement?.options ?? {}) as { ID?: string | number; dealId?: string | number };
    const rawDealId = options.ID ?? options.dealId ?? getQueryParam("dealId");

    return {
      provider: "bitrix24",
      dealId: rawDealId ? String(rawDealId) : null,
      userId: null,
      placement: placement?.placement ?? null,
    };
  },

  saveWorkspace: async (workspace: ExhibitionProject): Promise<void> => {
    const context = await bitrixCrmProvider.init();
    if (context.provider !== "bitrix24" || !context.dealId) {
      throw new Error("Нет открытой сделки: сохранять план некуда.");
    }

    const payload = buildStandPlanPayload(workspace, workspace.floorPlans[0]?.id ?? null);
    await saveStandPlan(context.dealId, payload);
  },

  bindStandToDeal: async (_standId: string, _dealId: string): Promise<void> => {
    // Привязка стенда с общего плана к сделке появится вместе с сохранением общего плана.
  },
};

function getQueryParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}
