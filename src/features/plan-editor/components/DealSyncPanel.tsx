import { isBitrixEnvironment } from "../../../shared/crm/bitrixApi";
import { getCanvasObject, getObjectStandMeta } from "../../../shared/domain/project";
import { useEditorStore } from "../store/editorStore";

/**
 * Сделка площадки стенда и состояние обмена с ней.
 *
 * Кнопок «Сохранить в сделку» и «Загрузить из сделки» больше нет: план
 * подтягивается из сделки при открытии и уходит обратно сам через пару секунд
 * после правки. Кнопки остались от времени без автосохранения и только
 * сбивали с толку — нажимать ли их. Здесь видно, куда сохраняется план,
 * и понятная ошибка, если сохранить не удалось.
 */
export function DealSyncPanel({ error }: { error: string | null }) {
  const project = useEditorStore((s) => s.project);
  const activeStandObjectId = useEditorStore((s) => s.activeStandObjectId);
  const crm = useEditorStore((s) => s.crm);

  // План сохраняется только в сделку своего стенда. Сделку, из которой открыто
  // приложение, не подставляем: так план чужого стенда уезжал в неё.
  const stand = activeStandObjectId ? getCanvasObject(project, activeStandObjectId) : null;
  const dealId = stand ? (getObjectStandMeta(stand)?.dealId ?? null) : crm.dealId;
  const insideBitrix = isBitrixEnvironment();

  return (
    <div className="panel-section deal-sync">
      <h2>Сделка</h2>

      <dl className="stand-facts">
        <div>
          <dt>Номер сделки</dt>
          <dd>{dealId ?? "не привязана"}</dd>
        </div>
      </dl>

      {error ? <p className="deal-sync__status is-error">{error}</p> : null}

      {insideBitrix && dealId && !error ? (
        <p className="deal-sync__hint">План стенда сохраняется в эту сделку сам, через пару секунд после каждой правки.</p>
      ) : null}

      {insideBitrix && !dealId ? (
        <p className="deal-sync__status is-error">
          Стенд не привязан к сделке — план этой площадки хранится только в этом браузере, коллеги его не увидят. Привяжите
          сделку на общем плане.
        </p>
      ) : null}

      {!insideBitrix ? (
        <p className="deal-sync__hint">
          Приложение открыто напрямую, а не из портала, поэтому план сохраняется только в этом браузере.
        </p>
      ) : null}
    </div>
  );
}
