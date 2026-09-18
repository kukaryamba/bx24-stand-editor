<?php
/**
 * Резервные копии данных приложения на хостинге.
 *
 * Карта выставки, список планов и выбранная воронка хранятся в настройках
 * приложения на портале и исчезнут вместе с приложением, если его удалят
 * или создадут заново. Здесь лежат их снимки, из которых всё можно вернуть.
 *
 * Снимки содержат названия компаний и сделок, поэтому лежат вне папки сайта —
 * в домашнем каталоге хостинга, куда из интернета не попасть. Отдаются только
 * сотруднику портала через этот же файл.
 *
 * Действия (POST, поле action):
 *   save — сохранить снимок из поля snapshot;
 *   list — список снимков, новые первыми;
 *   get  — содержимое снимка по имени из поля name.
 */

require __DIR__ . '/portal-auth.php';

/** Домашний каталог: на уровень выше public_html. */
define('BACKUP_DIR', dirname(__DIR__, 2) . '/stand-editor-backups');
const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;
/** Сколько последних снимков хранить подряд. */
const KEEP_RECENT = 50;
/** Сверх них — по одному на день за столько дней. */
const KEEP_DAILY_DAYS = 90;
const NAME_PATTERN = '/^\d{8}-\d{6}-[0-9a-f]{8}\.json$/';

require_portal_user();

header('Content-Type: application/json; charset=utf-8');

$action = (string)($_POST['action'] ?? '');

if ($action === 'save') {
    $snapshot = (string)($_POST['snapshot'] ?? '');
    if ($snapshot === '' || strlen($snapshot) > MAX_SNAPSHOT_BYTES) {
        portal_fail(413, 'Снимок пустой или больше 20 МБ.');
    }

    // Принимаем только снимок нашего формата — не произвольный текст.
    $decoded = json_decode($snapshot, true);
    if (!is_array($decoded) || ($decoded['format'] ?? '') !== 'stand-editor-backup') {
        portal_fail(400, 'Это не резервная копия редактора стендов.');
    }

    if (!is_dir(BACKUP_DIR) && !mkdir(BACKUP_DIR, 0700, true)) {
        portal_fail(500, 'Не удалось создать папку для резервных копий.');
    }

    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.json';
    if (file_put_contents(BACKUP_DIR . '/' . $name, $snapshot, LOCK_EX) === false) {
        portal_fail(500, 'Не удалось сохранить резервную копию.');
    }

    prune_backups();
    echo json_encode(['name' => $name], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'list') {
    $items = [];
    foreach (backup_files() as $path) {
        $content = @file_get_contents($path, false, null, 0, 4096);
        // Причину снимка берём из начала файла, чтобы не читать целиком.
        $reason = preg_match('/"reason"\s*:\s*"([a-z-]+)"/', (string)$content, $match) ? $match[1] : null;
        $items[] = [
            'name' => basename($path),
            'size' => filesize($path),
            'savedAt' => date('c', filemtime($path)),
            'reason' => $reason,
        ];
    }
    echo json_encode(['items' => $items], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($action === 'get') {
    $name = (string)($_POST['name'] ?? '');
    // Имя проверяем строго по образцу: иначе через него можно было бы
    // прочитать любой файл хостинга.
    if (!preg_match(NAME_PATTERN, $name) || !is_file(BACKUP_DIR . '/' . $name)) {
        portal_fail(404, 'Такой резервной копии нет.');
    }
    readfile(BACKUP_DIR . '/' . $name);
    exit;
}

portal_fail(400, 'Неизвестное действие.');

/** Снимки, новые первыми. Имя начинается с даты, поэтому сортировка по имени. */
function backup_files(): array
{
    $files = glob(BACKUP_DIR . '/*.json') ?: [];
    $files = array_values(array_filter($files, fn ($path) => preg_match(NAME_PATTERN, basename($path))));
    rsort($files);
    return $files;
}

/**
 * Прореживание: последние снимки храним все, а более старые — по одному
 * на день, не старше трёх месяцев. Иначе при автосохранении их копились бы
 * тысячи.
 */
function prune_backups(): void
{
    $keepDays = [];
    foreach (backup_files() as $index => $path) {
        $day = substr(basename($path), 0, 8);

        if ($index < KEEP_RECENT) {
            $keepDays[$day] = true;
            continue;
        }

        $fresh = time() - filemtime($path) <= KEEP_DAILY_DAYS * 86400;
        if ($fresh && !isset($keepDays[$day])) {
            $keepDays[$day] = true;
            continue;
        }

        @unlink($path);
    }
}
