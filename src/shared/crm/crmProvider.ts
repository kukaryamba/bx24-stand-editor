import type { CrmContext, ExhibitionProject } from "../domain/types";

export interface CrmProvider {
  init(): Promise<CrmContext>;
  saveWorkspace(workspace: ExhibitionProject): Promise<void>;
  bindStandToDeal(standId: string, dealId: string): Promise<void>;
}
