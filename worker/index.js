/**
 * Точка входа Worker'а на Cloudflare.
 *
 * Битрикс24 открывает встроенное приложение POST-запросом, а раздача статики
 * отвечает на POST ошибкой 405 — отдавать файлы она умеет только на GET.
 * Здесь POST перехватывается и та же страница отдаётся как обычный GET.
 *
 * Параметры авторизации приложение берёт не из тела запроса, а из адресной
 * строки и из библиотеки BX24, поэтому терять тело POST безопасно.
 */
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return env.ASSETS.fetch(request);
    }

    const asset = await env.ASSETS.fetch(new Request(request.url, { method: "GET" }));

    // Ответ раздачи статики неизменяемый, а заголовок про фреймы снять нужно:
    // иначе браузер может отказаться показывать страницу внутри портала.
    const headers = new Headers(asset.headers);
    headers.delete("X-Frame-Options");

    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  },
};
