import { useEffect, useState } from "react";
import { appHandlerUrl, bindDealTab, finishInstall } from "../../../shared/crm/bitrixApi";
import { getAllowedCategory, listDealCategories, setAllowedCategory, type DealCategory } from "../../../shared/crm/dealCategory";
import {
  getPassportMapping,
  listDealFields,
  passportSlots,
  setPassportMapping,
  type DealField,
  type PassportMapping,
} from "../../../shared/crm/passportFields";

/**
 * Установка приложения в портал.
 *
 * В форме локального приложения место встраивания не выбирается — его
 * регистрирует само приложение. Экран показывается всегда, когда приложение
 * открыто в портале, но не во вкладке сделки: и на странице установки,
 * и при открытии из списка интеграций. Так встраивание можно повторить,
 * не переустанавливая приложение.
 */

type InstallState =
  | { kind: "working" }
  | { kind: "done"; result: "bound" | "rebound" | "already" }
  | { kind: "error"; text: string };

const installMessage: Record<"bound" | "rebound" | "already", string> = {
  bound: "Готово: приложение встроено в карточку сделки.",
  rebound: "Готово: вкладка переключена на новую версию приложения.",
  already: "Приложение уже встроено в карточку сделки.",
};

type InstallScreenProps = {
  /** Открыть редактор, не выходя из портала. */
  onContinue: () => void;
};

export function InstallScreen({ onContinue }: InstallScreenProps) {
  const [state, setState] = useState<InstallState>({ kind: "working" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const install = async () => {
      setState({ kind: "working" });

      try {
        const result = await bindDealTab("План стенда");
        if (cancelled) return;

        finishInstall();
        setState({ kind: "done", result });
      } catch (error) {
        if (cancelled) return;
        setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось встроить приложение." });
      }
    };

    void install();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="install-screen">
      <div className="install-card">
        <h1>Редактор планов стендов</h1>

        {state.kind === "working" ? <p>Встраиваю приложение в карточку сделки...</p> : null}

        {state.kind === "done" ? (
          <>
            <p className="install-card__ok">{installMessage[state.result]}</p>
            <p>Откройте любую сделку — там появится вкладка «План стенда».</p>
            <button className="primary-action" onClick={onContinue}>
              Открыть редактор
            </button>
          </>
        ) : null}

        {state.kind === "error" ? (
          <>
            <p className="install-card__error">{state.text}</p>
            <p>
              Чаще всего причина в правах: встраивание может зарегистрировать только администратор портала. Проверьте
              права и повторите.
            </p>
            <button className="primary-action" onClick={() => setAttempt((value) => value + 1)}>
              Повторить
            </button>
            <button onClick={onContinue}>Открыть редактор без встраивания</button>
          </>
        ) : null}

        {state.kind === "done" ? <CategoryPicker /> : null}
        {state.kind === "done" ? <PassportFieldsPicker /> : null}

        <dl className="install-card__facts">
          <div>
            <dt>Адрес приложения</dt>
            <dd>{appHandlerUrl()}</dd>
          </div>
          <div>
            <dt>Место встраивания</dt>
            <dd>Карточка сделки, вкладка</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

type FieldsState =
  | { kind: "loading" }
  | { kind: "ready"; fields: DealField[]; mapping: PassportMapping; saved: boolean }
  | { kind: "error"; text: string };

/**
 * Какое поле сделки отвечает за какую строку паспорта.
 *
 * В старом приложении номера полей были вписаны в код, и при переезде
 * на другой портал это пришлось бы переписывать. Здесь соответствие
 * выбирается один раз и живёт в настройках приложения.
 */
function PassportFieldsPicker() {
  const [state, setState] = useState<FieldsState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [fields, mapping] = await Promise.all([listDealFields(), getPassportMapping()]);
        if (cancelled) return;
        setState({ kind: "ready", fields, mapping, saved: false });
      } catch (error) {
        if (cancelled) return;
        setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось получить поля сделки." });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const choose = async (slotId: string, code: string) => {
    if (state.kind !== "ready") return;

    const mapping = { ...state.mapping };
    if (code) mapping[slotId] = code;
    else delete mapping[slotId];

    setState({ ...state, mapping, saved: false });

    try {
      await setPassportMapping(mapping);
      setState((current) => (current.kind === "ready" ? { ...current, saved: true } : current));
    } catch (error) {
      setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось сохранить выбор полей." });
    }
  };

  return (
    <div className="install-card__section">
      <h2>Поля паспорта</h2>

      {state.kind === "loading" ? <p>Загружаю поля сделки...</p> : null}
      {state.kind === "error" ? <p className="install-card__error">{state.text}</p> : null}

      {state.kind === "ready" ? (
        <>
          <p>
            Укажите, откуда паспорт берёт данные. Незаполненные строки в паспорт не попадают — пустое место в документе
            для монтажников хуже, чем его отсутствие.
          </p>

          {passportSlots.map((slot) => (
            <label key={slot.id}>
              {slot.title}
              <select value={state.mapping[slot.id] ?? ""} onChange={(event) => void choose(slot.id, event.target.value)}>
                <option value="">Не показывать</option>
                {state.fields.map((field) => (
                  <option key={field.code} value={field.code}>
                    {field.title}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {state.saved ? <p className="install-card__ok">Сохранено.</p> : null}
        </>
      ) : null}
    </div>
  );
}

type PickerState =
  | { kind: "loading" }
  | { kind: "ready"; categories: DealCategory[]; selectedId: string; saved: boolean }
  | { kind: "error"; text: string };

/**
 * Выбор воронки, в которой приложение работает.
 *
 * Вкладку Битрикс24 показывает во всех сделках — ограничить встраивание
 * воронкой нельзя. Поэтому в остальных воронках приложение показывает
 * заглушку, а выбранная воронка хранится в настройках приложения на портале.
 */
function CategoryPicker() {
  const [state, setState] = useState<PickerState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [categories, allowed] = await Promise.all([listDealCategories(), getAllowedCategory()]);
        if (cancelled) return;
        setState({ kind: "ready", categories, selectedId: allowed?.id ?? "", saved: false });
      } catch (error) {
        if (cancelled) return;
        setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось получить список воронок." });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (categoryId: string) => {
    if (state.kind !== "ready") return;

    const category = state.categories.find((item) => item.id === categoryId) ?? null;
    setState({ ...state, selectedId: categoryId, saved: false });

    try {
      await setAllowedCategory(category);
      setState((current) => (current.kind === "ready" ? { ...current, saved: true } : current));
    } catch (error) {
      setState({ kind: "error", text: error instanceof Error ? error.message : "Не удалось сохранить выбор воронки." });
    }
  };

  return (
    <div className="install-card__section">
      <h2>Воронка</h2>

      {state.kind === "loading" ? <p>Загружаю список воронок...</p> : null}
      {state.kind === "error" ? <p className="install-card__error">{state.text}</p> : null}

      {state.kind === "ready" ? (
        <>
          <label>
            Приложение работает в воронке
            <select value={state.selectedId} onChange={(event) => void save(event.target.value)}>
              <option value="">Во всех воронках</option>
              {state.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <p>
            Вкладка появится во всех сделках — Битрикс24 не умеет показывать её выборочно. Но в сделках других воронок
            она сообщит, что стенды ведутся не здесь.
          </p>

          {state.saved ? <p className="install-card__ok">Сохранено.</p> : null}
        </>
      ) : null}
    </div>
  );
}
