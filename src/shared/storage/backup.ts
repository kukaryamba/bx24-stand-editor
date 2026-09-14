import { freshPortalAuth, portalAuth } from "../crm/bitrixApi";
import { getAllowedCategory, setAllowedCategory, type DealCategory } from "../crm/dealCategory";
import { saveExpoPlan, stripForPortal } from "../crm/expoPlanRepository";
import { loadPlanLibrary, savePlanLibrary, type SavedPlan } from "../crm/planLibrary";
import { loadStandPlan, saveStandPlan, type StandPlanPayload } from "../crm/standPlanRepository";
import { getObjectStandMeta } from "../domain/project";
import type { ExhibitionProject } from "../domain/types";
import { uploadPlanImage } from "./planUpload";

/**
 * Резервные копии всех данных приложения.
 *
 * Данные живут в трёх местах, и у каждого своя угроза. Карта выставки, список
 * планов и воронка — в настройках приложения на портале: исчезнут, если
 * приложение удалят или создадут заново. Предметы на стендах — в полях сделок.
 * Картинки планов — на хостинге. Снимок собирает всё это в один файл.
 *
 * Снимки уходят на хостинг автоматически, а полную копию с картинками можно
 * скачать на компьютер: она страхует и от потери самого хостинга.
 */

export type BackupReason = "auto" | "manual" | "before-restore" | "download";

export type BackupSnapshot = {
  format: "stand-editor-backup";
  version: 1;
  createdAt: string;
  reason: BackupReason;
  portal: string | null;
  /** Карта выставки: стенды, планы, сетка, анкеты паспортов. Без предметов — они в standPlans. */
  project: ExhibitionProject;
  /** Предметы площадок по номерам сделок. */
  standPlans: Record<string, StandPlanPayload>;
  planLibrary: SavedPlan[];
  allowedCategory: DealCategory | null;
  /** Картинки планов по их адресам — только в скачанной копии. */
  images?: Record<string, string>;
};

export type BackupListItem = {
  name: string;
  size: number;
  savedAt: string;
  reason: BackupReason | null;
};

const backupUrl = "./backup.php";

/** Собирает снимок. С картинками — для файла на компьютер. */
export async function buildSnapshot(
  project: ExhibitionProject,
  reason: BackupReason,
  withImages = false,
): Promise<BackupSnapshot> {
  const dealIds = Array.from(
    new Set(
      project.objects
        .filter((object) => object.kind === "stand")
        .map((object) => getObjectStandMeta(object)?.dealId)
        .filter((dealId): dealId is string => Boolean(dealId)),
    ),
  );

  // Предметы берём из сделок, а не из редактора: в редакторе только те
  // площадки, что открывали в этот раз, а в сделках — все.
  const standPlans: Record<string, StandPlanPayload> = {};
  for (const dealId of dealIds) {
    try {
      const plan = await loadStandPlan(dealId);
      if (plan) standPlans[dealId] = plan;
    } catch (error) {
      console.warn(`Не удалось взять план стенда из сделки ${dealId} для копии.`, error);
    }
  }

  const [planLibrary, allowedCategory] = await Promise.all([
    loadPlanLibrary().catch(() => [] as SavedPlan[]),
    getAllowedCategory().catch(() => null),
  ]);

  const stripped = stripForPortal(project);
  const snapshot: BackupSnapshot = {
    format: "stand-editor-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    reason,
    portal: portalAuth()?.domain ?? null,
    project: stripped,
    standPlans,
    planLibrary,
    allowedCategory,
  };

  if (withImages) {
    snapshot.images = await collectImages(stripped, planLibrary);
  }

  return snapshot;
}

/** Картинки планов в виде текста — чтобы файл копии был самодостаточным. */
async function collectImages(project: ExhibitionProject, library: SavedPlan[]): Promise<Record<string, string>> {
  const urls = new Set<string>();
  for (const plan of project.floorPlans) if (plan.background?.imageUrl) urls.add(plan.background.imageUrl);
  for (const plan of library) if (plan.background.imageUrl) urls.add(plan.background.imageUrl);

  const images: Record<string, string> = {};
  for (const url of urls) {
    if (url.startsWith("data:")) continue;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      images[url] = await blobToDataUrl(await response.blob());
    } catch (error) {
      console.warn(`Не удалось добавить в копию картинку ${url}.`, error);
    }
  }
  return images;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать картинку."));
    reader.readAsDataURL(blob);
  });
}

async function callBackup(fields: Record<string, string>): Promise<Response> {
  const auth = await freshPortalAuth();
  if (!auth) throw new Error("Резервные копии на хостинге доступны только из портала.");

  const form = new FormData();
  form.append("domain", auth.domain);
  form.append("auth", auth.token);
  for (const [key, value] of Object.entries(fields)) form.append(key, value);

  let response: Response;
  try {
    response = await fetch(backupUrl, { method: "POST", body: form });
  } catch {
    throw new Error("Хостинг не ответил.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Хостинг ответил ошибкой ${response.status}.`);
  }
  return response;
}

export async function uploadSnapshot(snapshot: BackupSnapshot): Promise<string> {
  const response = await callBackup({ action: "save", snapshot: JSON.stringify(snapshot) });
  const payload = (await response.json()) as { name: string };
  return payload.name;
}

export async function listSnapshots(): Promise<BackupListItem[]> {
  const response = await callBackup({ action: "list" });
  const payload = (await response.json()) as { items?: BackupListItem[] };
  return payload.items ?? [];
}

export async function fetchSnapshot(name: string): Promise<BackupSnapshot> {
  const response = await callBackup({ action: "get", name });
  return parseSnapshot(await response.text());
}

export function parseSnapshot(text: string): BackupSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Файл повреждён или это не резервная копия.");
  }

  const snapshot = parsed as Partial<BackupSnapshot>;
  if (snapshot.format !== "stand-editor-backup" || !snapshot.project || !Array.isArray(snapshot.project.floorPlans)) {
    throw new Error("Это не резервная копия редактора стендов.");
  }
  return snapshot as BackupSnapshot;
}

/** Скачивает копию файлом на компьютер. */
export function downloadSnapshot(snapshot: BackupSnapshot): void {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = snapshot.createdAt.slice(0, 16).replace(/[-:T]/g, "");

  const link = document.createElement("a");
  link.href = url;
  link.download = `стенды-копия-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type RestoreProgress = (message: string) => void;

/**
 * Возвращает данные из снимка.
 *
 * Перед этим текущее состояние само уходит в копию «перед восстановлением»:
 * если выбрали не тот снимок, откатиться можно тем же способом. Без этой
 * страховки восстановление не начинается.
 */
export async function restoreSnapshot(
  snapshot: BackupSnapshot,
  current: ExhibitionProject,
  progress: RestoreProgress,
): Promise<void> {
  progress("Сохраняю текущее состояние на случай, если выбран не тот снимок...");
  await uploadSnapshot(await buildSnapshot(current, "before-restore"));

  let project = snapshot.project;
  let library = snapshot.planLibrary ?? [];

  // Картинки из скачанной копии нужны, только если на хостинге их больше нет.
  if (snapshot.images) {
    const replaced = new Map<string, string>();
    for (const [url, dataUrl] of Object.entries(snapshot.images)) {
      const alive = await fetch(url, { method: "HEAD" }).then((response) => response.ok).catch(() => false);
      if (alive) continue;

      progress("Возвращаю на хостинг картинку плана...");
      replaced.set(url, await uploadPlanImage(dataUrl, url.split("/").pop() || "plan.jpg"));
    }

    if (replaced.size > 0) {
      const swap = (url: string) => replaced.get(url) ?? url;
      project = {
        ...project,
        floorPlans: project.floorPlans.map((plan) =>
          plan.background ? { ...plan, background: { ...plan.background, imageUrl: swap(plan.background.imageUrl) } } : plan,
        ),
      };
      library = library.map((plan) => ({ ...plan, background: { ...plan.background, imageUrl: swap(plan.background.imageUrl) } }));
    }
  }

  progress("Восстанавливаю карту выставки...");
  await saveExpoPlan(project);

  progress("Восстанавливаю список планов и воронку...");
  await savePlanLibrary(library);
  await setAllowedCategory(snapshot.allowedCategory ?? null);

  const deals = Object.entries(snapshot.standPlans ?? {});
  for (const [index, [dealId, plan]] of deals.entries()) {
    progress(`Возвращаю предметы на стенды: ${index + 1} из ${deals.length}...`);
    await saveStandPlan(dealId, plan);
  }
}
