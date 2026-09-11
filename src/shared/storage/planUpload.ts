import { portalAuth } from "../crm/bitrixApi";

/**
 * Загрузка плана выставки на хостинг, чтобы подложку видели все.
 *
 * Картинка слишком тяжёлая для настроек портала, поэтому раньше оставалась
 * в браузере того, кто её загрузил. Теперь файл уходит на хостинг рядом
 * с приложением, а в карте выставки хранится только ссылка на него.
 *
 * Сервер принимает файл лишь от сотрудника портала: вместе с картинкой
 * отправляется токен входа, и сервер сверяет его с Битрикс24.
 */

/** Приёмник лежит рядом с приложением: так запрос идёт на тот же домен. */
const uploadUrl = "./upload.php";

export async function uploadPlanImage(imageDataUrl: string, fileName: string): Promise<string> {
  const auth = portalAuth();
  if (!auth) {
    throw new Error("Сохранить план для всех можно, только открыв приложение из портала.");
  }

  const image = await (await fetch(imageDataUrl)).blob();

  const form = new FormData();
  form.append("plan", image, fileName);
  form.append("domain", auth.domain);
  form.append("auth", auth.token);

  let response: Response;
  try {
    response = await fetch(uploadUrl, { method: "POST", body: form });
  } catch {
    throw new Error("Хостинг не ответил — план сохранён только в этом браузере.");
  }

  const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? `Хостинг не принял план (код ${response.status}).`);
  }

  return payload.url;
}
