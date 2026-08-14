/**
 * Тонкая обёртка над JS SDK Битрикс24.
 *
 * SDK доступен только когда приложение открыто внутри портала (в iframe карточки
 * сделки). При локальной разработке window.BX24 отсутствует — тогда все вызовы
 * возвращают понятную ошибку, а приложение продолжает работать с localStorage.
 */

type Bx24CallResult<T> = {
  data(): T;
  error(): { getError?: () => { error_description?: string } } | string | null;
};

type Bx24 = {
  init(callback: () => void): void;
  placement?: {
    info(): { placement?: string; options?: Record<string, unknown> };
  };
  callMethod(method: string, params: Record<string, unknown>, callback: (result: Bx24CallResult<unknown>) => void): void;
  /** Сообщает порталу, что установка завершена. Без этого приложение остаётся неустановленным. */
  installFinish?(): void;
};

declare global {
  interface Window {
    BX24?: Bx24;
  }
}

/** Код пользовательского поля сделки, в котором лежит план стенда. */
export const standPlanFieldCode = "UF_CRM_STAND_PLAN";

/**
 * XML_ID поля — по нему приложение находит своё поле, даже если код в портале
 * оказался другим (Битрикс24 иногда выдаёт поля вида UF_CRM_1712345678).
 */
export const standPlanFieldXmlId = "BX24_EXPO_STAND_PLAN";

const sdkUrl = "https://api.bitrix24.com/api/v1/";
let sdkPromise: Promise<void> | null = null;

/**
 * Похоже ли окружение на портал Битрикс24.
 *
 * Приложение всегда открывается в iframe и получает параметры портала в адресе.
 * Проверка нужна до загрузки SDK: вне портала он падает с ошибкой инициализации,
 * поэтому подключать его там незачем.
 */
export function isBitrixEnvironment(): boolean {
  if (typeof window === "undefined") return false;
  if (window.BX24) return true;

  const params = new URLSearchParams(window.location.search);
  // APP_SID портал подставляет всегда, остальные — не в каждом встраивании.
  const hasPortalParams = ["DOMAIN", "AUTH_ID", "PROTOCOL", "APP_SID", "member_id"].some((name) => params.has(name));
  const inIframe = window.self !== window.top;

  return inIframe && hasPortalParams;
}

export function isInsideBitrix(): boolean {
  return typeof window !== "undefined" && Boolean(window.BX24);
}

/** Подгружает SDK по требованию — только внутри портала. */
export function ensureBitrixSdk(): Promise<void> {
  if (window.BX24) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = sdkUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Не удалось загрузить библиотеку Битрикс24."));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export async function bitrixInit(): Promise<void> {
  await ensureBitrixSdk();

  const bx24 = window.BX24;
  if (!bx24) throw new Error("Библиотека Битрикс24 загрузилась, но недоступна.");

  await new Promise<void>((resolve) => bx24.init(() => resolve()));
}

export function callMethod<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const bx24 = window.BX24;
  if (!bx24) {
    return Promise.reject(new Error("Приложение открыто вне Битрикс24, сохранение в сделку недоступно."));
  }

  return new Promise<T>((resolve, reject) => {
    bx24.callMethod(method, params, (result) => {
      const error = result.error();
      if (error) {
        reject(new Error(describeError(error, method)));
        return;
      }
      resolve(result.data() as T);
    });
  });
}

/**
 * Ищет поле сделки для плана: сначала по XML_ID, затем по коду.
 * Возвращает реальный FIELD_NAME или null, если поле ещё не создано.
 */
export async function findStandPlanField(): Promise<string | null> {
  const fields = await callMethod<Array<Record<string, string>>>("crm.deal.userfield.list", {
    filter: {},
  });

  const byXmlId = fields.find((field) => field.XML_ID === standPlanFieldXmlId);
  if (byXmlId?.FIELD_NAME) return byXmlId.FIELD_NAME;

  const byCode = fields.find((field) => field.FIELD_NAME === standPlanFieldCode);
  return byCode?.FIELD_NAME ?? null;
}

/**
 * Создаёт поле для плана стенда. Требует прав администратора портала.
 * Тип «строка» с многострочным вводом — план весит несколько десятков килобайт.
 */
export async function createStandPlanField(): Promise<string> {
  await callMethod("crm.deal.userfield.add", {
    fields: {
      FIELD_NAME: standPlanFieldCode,
      USER_TYPE_ID: "string",
      XML_ID: standPlanFieldXmlId,
      EDIT_FORM_LABEL: { ru: "План стенда (служебное)", en: "Stand plan (service)" },
      LIST_COLUMN_LABEL: { ru: "План стенда", en: "Stand plan" },
      SETTINGS: { ROWS: 5 },
      SHOW_IN_LIST: "N",
    },
  });

  const created = await findStandPlanField();
  if (!created) throw new Error("Поле создано, но не найдено в списке. Проверьте права администратора.");
  return created;
}

/** Место в карточке сделки, куда встраивается приложение. */
export const dealTabPlacement = "CRM_DEAL_DETAIL_TAB";

/** Значение placement на странице установки приложения. */
export const installPlacement = "DEFAULT";

/**
 * Адрес самого приложения — его портал будет открывать во вкладке сделки.
 * Берётся из адресной строки без параметров: их портал подставит свои.
 */
export function appHandlerUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Какие места уже привязаны. Пустой список — приложение ещё не встроено. */
export async function listBoundPlacements(): Promise<string[]> {
  const bound = await callMethod<unknown>("placement.get");
  if (!Array.isArray(bound)) return [];

  return bound
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "placement" in item) return String((item as { placement: unknown }).placement);
      if (item && typeof item === "object" && "PLACEMENT" in item) return String((item as { PLACEMENT: unknown }).PLACEMENT);
      return "";
    })
    .filter(Boolean);
}

/**
 * Встраивает приложение вкладкой в карточку сделки.
 * Повторная привязка порталом не разрешена, поэтому сначала смотрим список.
 */
export async function bindDealTab(title: string): Promise<"bound" | "already"> {
  const bound = await listBoundPlacements();
  if (bound.includes(dealTabPlacement)) return "already";

  await callMethod("placement.bind", {
    PLACEMENT: dealTabPlacement,
    HANDLER: appHandlerUrl(),
    TITLE: title,
  });

  return "bound";
}

export function finishInstall(): void {
  window.BX24?.installFinish?.();
}

function describeError(error: unknown, method: string): string {
  if (typeof error === "string") return `${method}: ${error}`;

  if (error && typeof error === "object" && "getError" in error) {
    const detail = (error as { getError?: () => { error_description?: string } }).getError?.();
    if (detail?.error_description) return `${method}: ${detail.error_description}`;
  }

  return `Ошибка вызова ${method}.`;
}
