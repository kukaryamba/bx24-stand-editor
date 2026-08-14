import { useEffect, useState } from "react";
import { appHandlerUrl, bindDealTab, finishInstall } from "../../../shared/crm/bitrixApi";

/**
 * Установка приложения в портал.
 *
 * В форме локального приложения место встраивания не выбирается — его
 * регистрирует само приложение. Портал один раз открывает эту страницу
 * (placement DEFAULT), здесь мы просим вкладку в карточке сделки и говорим
 * порталу, что установка закончена.
 */

type InstallState =
  | { kind: "working" }
  | { kind: "done"; alreadyBound: boolean }
  | { kind: "error"; text: string };

export function InstallScreen() {
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
        setState({ kind: "done", alreadyBound: result === "already" });
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
            <p className="install-card__ok">
              {state.alreadyBound
                ? "Приложение уже встроено в карточку сделки."
                : "Готово: приложение встроено в карточку сделки."}
            </p>
            <p>Откройте любую сделку — там появится вкладка «План стенда».</p>
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
          </>
        ) : null}

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
