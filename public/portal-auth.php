<?php
/**
 * Проверка, что запрос пришёл от сотрудника портала.
 *
 * Общая для приёмника планов и резервных копий: проверка доступа должна быть
 * одной, а не расходиться по двум файлам.
 *
 * Приложение присылает домен портала и токен входа. Токен сверяется запросом
 * к самому Битрикс24: настоящий вернёт пользователя. Список порталов
 * обязателен — иначе подошёл бы токен любого чужого портала.
 */

const ALLOWED_DOMAINS = ['alit.bitrix24.ru'];

function portal_fail(int $status, string $message): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Возвращает пользователя портала или завершает запрос с ошибкой. */
function require_portal_user(): array
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        portal_fail(405, 'Ожидается POST-запрос.');
    }

    $domain = strtolower(trim((string)($_POST['domain'] ?? '')));
    $auth = trim((string)($_POST['auth'] ?? ''));

    if (!in_array($domain, ALLOWED_DOMAINS, true) || $auth === '') {
        portal_fail(403, 'Доступно только из портала компании.');
    }

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
        portal_fail(403, 'Портал не подтвердил вход. Откройте приложение из Битрикс24 заново.');
    }

    return $user['result'];
}
