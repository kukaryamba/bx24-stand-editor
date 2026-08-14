/**
 * Приём POST-запроса от Битрикс24.
 *
 * Портал открывает встроенное приложение POST-запросом, а любой статический
 * хостинг отвечает на POST ошибкой 405 — отдавать файлы он умеет только на GET.
 * Здесь запрос перехватывается и та же страница отдаётся как обычный GET.
 *
 * Параметры авторизации приложение берёт не из тела запроса, а из адресной
 * строки и из библиотеки BX24, поэтому терять тело POST безопасно.
 */
export async function onRequest(context) {
  const { request, env, next } = context;

  if (request.method !== "POST") {
    return next();
  }

  const response = await env.ASSETS.fetch(new Request(request.url, { method: "GET" }));

  // Ответ ASSETS неизменяемый, а заголовок про фрейм добавить нужно:
  // без него браузер может отказаться показывать страницу внутри портала.
  const headers = new Headers(response.headers);
  headers.delete("X-Frame-Options");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
