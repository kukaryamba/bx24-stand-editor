import { passportSlots } from "../../../shared/crm/passportFields";
import { friezeMaxChars, getCanvasObject, getObjectStandMeta } from "../../../shared/domain/project";
import { baseCarpetColor } from "../../../shared/domain/standBase";
import { useFriezeLabels } from "../hooks/useFriezeDefaultLabel";
import { useEditorStore } from "../store/editorStore";

/**
 * Анкета паспорта: фриз, цвета, самозастройка, диплом.
 *
 * Заполняется там же, где идёт работа над стендом, — искать эти поля
 * в карточке сделки неудобно, а без них паспорт неполный.
 *
 * Ответы хранятся в самом стенде и уезжают в портал вместе с картой выставки,
 * поэтому видны всем и переживают смену компьютера. С полями сделки пока
 * не связаны: заполнять оказалось удобнее прямо здесь.
 */

/** Ограничение прайса: не более 15 символов на фризовой панели. */
const friezeLimit = friezeMaxChars;

function FriezeCount({ text, fromDeal }: { text: string; fromDeal: boolean }) {
  const count = Array.from(text).length;
  return (
    <span className={count > friezeLimit ? "passport-form__over" : "passport-form__count"}>
      Знаков: {count} из {friezeLimit}
      {count > friezeLimit ? " — больше, чем помещается на панели" : ""}
      {fromDeal ? ". Название компании из сделки" : ""}
      . Общая для панелей фриза, у которых нет своей надписи.
    </span>
  );
}

export function PassportForm({ standObjectId }: { standObjectId: string }) {
  const project = useEditorStore((state) => state.project);
  const updateStand = useEditorStore((state) => state.updateStand);
  const setStandFriezeText = useEditorStore((state) => state.setStandFriezeText);
  const frieze = useFriezeLabels();

  const stand = getCanvasObject(project, standObjectId);
  const meta = stand ? getObjectStandMeta(stand) : null;
  const answers = meta?.passport ?? {};

  const change = (slotId: string, value: string) => {
    // Надпись на фризе — общая для панелей без своей надписи.
    if (slotId === "friezeText") {
      setStandFriezeText(standObjectId, value);
      return;
    }
    updateStand(standObjectId, { passport: { [slotId]: value } });
  };

  if (!stand || !meta) return null;

  return (
    <div className="property-form passport-form">
      <h2>Паспорт стенда</h2>

      {passportSlots.map((slot) => {
        const isFrieze = slot.id === "friezeText";
        // Надпись на фризе в поле сразу текстом — названием компании из сделки, пока её не правили.
        const value = isFrieze ? frieze.label : (answers[slot.id] ?? "");
        const isFlag = slot.id === "selfBuild";

        return (
          <label key={slot.id}>
            {slot.title}
            {isFlag ? (
              <select value={value} onChange={(event) => change(slot.id, event.target.value)}>
                <option value="">Не указано</option>
                <option value="Да">Да</option>
                <option value="Нет">Нет</option>
              </select>
            ) : (
              <input
                value={value}
                placeholder={isFrieze ? "ФРИЗ" : slot.id === "carpetColor" ? baseCarpetColor : undefined}
                onChange={(event) => change(slot.id, event.target.value)}
              />
            )}

            {isFrieze ? <FriezeCount text={value} fromDeal={frieze.passportText === undefined && Boolean(frieze.fromDeal)} /> : null}
            {isFrieze && frieze.passportText !== undefined && frieze.fromDeal && frieze.passportText !== frieze.fromDeal ? (
              <button type="button" onClick={() => setStandFriezeText(standObjectId, null)}>
                Взять из сделки: {frieze.fromDeal}
              </button>
            ) : null}
          </label>
        );
      })}

      <p className="passport-form__hint">Заполненное попадает в паспорт стенда и видно всем, кто откроет эту сделку.</p>
    </div>
  );
}
