import { passportSlots } from "../../../shared/crm/passportFields";
import { getCanvasObject, getObjectStandMeta } from "../../../shared/domain/project";
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
const friezeLimit = 15;

export function PassportForm({ standObjectId }: { standObjectId: string }) {
  const project = useEditorStore((state) => state.project);
  const updateStand = useEditorStore((state) => state.updateStand);

  const stand = getCanvasObject(project, standObjectId);
  const meta = stand ? getObjectStandMeta(stand) : null;
  const answers = meta?.passport ?? {};

  const change = (slotId: string, value: string) => {
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
              <input value={value} onChange={(event) => change(slot.id, event.target.value)} />
            )}

            {isFrieze && value ? (
              <span className={value.length > friezeLimit ? "passport-form__over" : "passport-form__count"}>
                Знаков: {value.length} из {friezeLimit}
                {value.length > friezeLimit ? " — больше, чем помещается на панели" : ""}
              </span>
            ) : null}
          </label>
        );
      })}

      <p className="passport-form__hint">Заполненное попадает в паспорт стенда и видно всем, кто откроет эту сделку.</p>
    </div>
  );
}
