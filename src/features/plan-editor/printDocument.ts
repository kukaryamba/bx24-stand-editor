/**
 * Печать документа в отдельной вкладке.
 *
 * Внутри Битрикс24 приложение живёт в рамке, и печать из рамки браузер
 * блокирует или печатает пустоту — паспорт не сохранялся в PDF. Отдельная
 * вкладка — обычная страница: печать и «Сохранить как PDF» работают.
 *
 * В вкладку переносится готовая разметка документа и стили приложения,
 * поэтому паспорт выглядит так же, как в окне. Заголовок вкладки становится
 * именем PDF-файла по умолчанию.
 */
export function printInNewTab(element: HTMLElement, title: string): boolean {
  const tab = window.open("", "_blank");
  if (!tab) return false;

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");

  tab.document.open();
  tab.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<base href="${escapeHtml(window.location.href)}">
${styles}
</head>
<body class="print-tab">
<div class="print-tab__bar">
  <button type="button" onclick="window.print()">Печать / сохранить в PDF</button>
  <span>Если окно печати не открылось само, нажмите кнопку или Ctrl+P. Для PDF выберите принтер «Сохранить как PDF».</span>
</div>
${element.outerHTML}
</body>
</html>`);
  tab.document.close();

  // Печатаем, когда подгрузятся стили и картинки, иначе в PDF уйдут пустые клетки.
  const print = () => {
    const images = Array.from(tab.document.images);
    void Promise.all(images.map((image) => (image.complete ? Promise.resolve() : image.decode().catch(() => undefined)))).then(() => {
      tab.focus();
      tab.print();
    });
  };
  if (tab.document.readyState === "complete") window.setTimeout(print, 300);
  else tab.addEventListener("load", print);

  return true;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}
