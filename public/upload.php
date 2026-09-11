<?php
/**
 * Приём плана выставки от приложения.
 *
 * Картинка плана весит сотни килобайт и в настройки портала не помещается,
 * поэтому раньше подложка оставалась в браузере того, кто её загрузил, —
 * коллеги видели стенды без неё. Здесь файл сохраняется на хостинг, а в портал
 * уходит только короткая ссылка на него.
 *
 * Принимаем файл только от сотрудника портала: токен авторизации проверяется
 * запросом к самому Битрикс24. Без этого загружать на хостинг мог бы любой.
 *
 * Файлы лежат вне папки приложения: выкладка приводит ту папку в точное
 * соответствие со сборкой и стёрла бы всё, чего нет в репозитории.
 */

header('Content-Type: application/json; charset=utf-8');

/** Порталы, которым разрешено загружать планы. */
const ALLOWED_DOMAINS = ['alit.bitrix24.ru'];
const MAX_BYTES = 10 * 1024 * 1024;
const FILES_DIR = __DIR__ . '/../stand-editor-files/plans';
/** Ссылка на тот же каталог — относительно адреса приложения. */
const FILES_URL = '../stand-editor-files/plans';

function fail(int $status, string $message): void
{
    http_response_code($status);
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail(405, 'Ожидается POST-запрос.');
}

$domain = strtolower(trim((string)($_POST['domain'] ?? '')));
$auth = trim((string)($_POST['auth'] ?? ''));

// Список разрешённых порталов обязателен: иначе злоумышленник подсунул бы
// свой портал, где его токен настоящий, и проверка прошла бы.
if (!in_array($domain, ALLOWED_DOMAINS, true) || $auth === '') {
    fail(403, 'Загрузка доступна только из портала компании.');
}

// Спрашиваем у портала, чей это токен. Настоящий — вернёт пользователя.
$checkUrl = 'https://' . $domain . '/rest/user.current.json?auth=' . urlencode($auth);
$response = false;
if (function_exists('curl_init')) {
    $curl = curl_init($checkUrl);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    $response = curl_exec($curl);
    curl_close($curl);
} else {
    $response = @file_get_contents($checkUrl);
}

$user = $response ? json_decode($response, true) : null;
if (empty($user['result']['ID'])) {
    fail(403, 'Портал не подтвердил вход. Откройте приложение из Битрикс24 заново.');
}

$file = $_FILES['plan'] ?? null;
if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
    fail(400, 'Файл плана не пришёл.');
}
if ($file['size'] > MAX_BYTES) {
    fail(413, 'План больше 10 МБ.');
}

// Проверяем содержимое, а не имя: переименованный скрипт картинкой не прикинется.
$info = @getimagesize($file['tmp_name']);
if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
    fail(415, 'Нужна картинка в формате JPEG или PNG.');
}

if (!is_dir(FILES_DIR) && !mkdir(FILES_DIR, 0755, true)) {
    fail(500, 'Не удалось создать папку для планов на хостинге.');
}

// Имя придумываем сами: пользовательское могло бы содержать что угодно.
$extension = $info[2] === IMAGETYPE_PNG ? 'png' : 'jpg';
$name = date('Ymd-His') . '-' . bin2hex(random_bytes(6)) . '.' . $extension;

if (!move_uploaded_file($file['tmp_name'], FILES_DIR . '/' . $name)) {
    fail(500, 'Не удалось сохранить план на хостинге.');
}

echo json_encode(['url' => FILES_URL . '/' . $name], JSON_UNESCAPED_UNICODE);
