/**
 * Строки анкеты паспорта стенда.
 *
 * Ответы хранятся в самом стенде и уезжают в портал вместе с картой выставки.
 * С полями сделки они пока не связаны: в старом приложении номера полей были
 * вписаны в код, повторять это не хочется, а настраивать соответствие руками
 * оказалось лишним шагом — заполнять удобнее прямо в редакторе.
 *
 * Если данные понадобятся отчётам Битрикс24, соответствие полям добавляется
 * поверх этого: слоты уже названы и опознаются по идентификаторам.
 */

export type PassportSlot = {
  id: string;
  /** Как называется строка в анкете и в паспорте. */
  title: string;
};

export const passportSlots: PassportSlot[] = [
  { id: "friezeText", title: "Надпись на фризе" },
  { id: "friezeColor", title: "Цвет надписи" },
  { id: "carpetColor", title: "Цвет ковра" },
  { id: "selfBuild", title: "Самостоятельная застройка" },
  { id: "diploma", title: "Название для диплома" },
  { id: "heavyTech", title: "Комментарий по тяжёлой технике" },
];

export type PassportValue = {
  slot: PassportSlot;
  value: string;
};

/**
 * Заполненные строки анкеты.
 *
 * Пустые не возвращаются: пустая строка в документе для монтажников читается
 * как «здесь ничего не нужно», а на деле означает «не заполнили».
 */
export function readPassportValues(answers: Record<string, string> | undefined): PassportValue[] {
  if (!answers) return [];

  return passportSlots
    .map((slot) => {
      const value = answers[slot.id]?.trim();
      return value ? { slot, value } : null;
    })
    .filter((item): item is PassportValue => item !== null);
}
