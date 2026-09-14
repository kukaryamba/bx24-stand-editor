<?php
/**
 * Приём плана выставки от приложения.
 *
 * Картинка плана весит сотни килобайт и в настройки портала не помещается,
 * поэтому раньше подложка оставалась в браузере того, кто её загрузил, —
 * коллеги видели стенды без неё. Здесь файл сохраняется на хостинг, а в портал
 * уходит только короткая ссылка на него.
 *
 * Файлы лежат вне папки приложения: выкладка приводит ту папку в точное
 * соответствие со сборкой и стёрла бы всё, чего нет в репозитории.
 */

require __DIR__ . '/portal-auth.php';

header('Content-Type: application/json; charset=utf-8');

const MAX_BYTES = 10 * 1024 * 1024;
const FILES_DIR = __DIR__ . '/../stand-editor-files/plans';
/** Ссылка на тот же каталог — относительно адреса приложения. */
const FILES_URL = '../stand-editor-files/plans';

require_portal_user();

$file = $_FILES['plan'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    portal_fail(400, 'Файл плана не пришёл.');
}
if ($file['size'] > MAX_BYTES) {
    portal_fail(413, 'План больше 10 МБ.');
}

// Проверяем содержимое, а не имя: переименованный скрипт картинкой не прикинется.
$info = @getimagesize($file['tmp_name']);
if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
    portal_fail(415, 'Нужна картинка в формате JPEG или PNG.');
}

if (!is_dir(FILES_DIR) && !mkdir(FILES_DIR, 0755, true)) {
    portal_fail(500, 'Не удалось создать папку для планов на хостинге.');
}

// Имя придумываем сами: пользовательское могло бы содержать что угодно.
$extension = $info[2] === IMAGETYPE_PNG ? 'png' : 'jpg';
$name = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;

if (!move_uploaded_file($file['tmp_name'], FILES_DIR . '/' . $name)) {
    portal_fail(500, 'Не удалось сохранить план на хостинге.');
}

echo json_encode(['url' => FILES_URL . '/' . $name], JSON_UNESCAPED_UNICODE);
