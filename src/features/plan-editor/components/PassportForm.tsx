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
      {fromDeal ? ". Пока взято из названия сделки" : ""}
      . Эта же надпись — на фризе стенда.
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
    // Надпись на фризе общая с панелями на площадке — меняется вместе с ними.
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
        const value = answers[slot.id] ?? "";
        const isFrieze = slot.id === "friezeText";
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
                placeholder={isFrieze ? frieze.fromDeal : slot.id === "carpetColor" ? baseCarpetColor : undefined}
                onChange={(event) => change(slot.id, event.target.value)}
              />
            )}

            {isFrieze && (value || frieze.fromDeal) ? (
              <FriezeCount text={value || frieze.fromDeal} fromDeal={!value} />
            ) : null}
          </label>
        );
      })}

      <p className="passport-form__hint">Заполненное попадает в паспорт стенда и видно всем, кто откроет эту сделку.</p>
    </div>
  );
}
