import { useEffect, useState } from "react";

/**
 * Картинка для холста.
 *
 * В браузере картинка грузится с первого раза. В приложении Битрикс24 для
 * компьютера (старый встроенный браузер) значки предметов не загружались —
 * на плане оставались пустые квадраты. Поэтому при ошибке пробуем ещё два
 * способа: тот же адрес без метки версии и сам файл, скачанный вручную
 * и подставленный содержимым (data: URL) — так его не трогают ни кэш,
 * ни правила встроенного браузера для внешних картинок.
 */
export function useImage(src: string): HTMLImageElement | null {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    let cancelled = false;
    const attempts: Array<() => Promise<string>> = [
      async () => src,
      async () => src.replace(/\?.*$/, ""),
      () => fetchAsDataUrl(src),
    ];

    const tryNext = (index: number) => {
      if (cancelled || index >= attempts.length) {
        if (!cancelled) setImage(null);
        return;
      }
      attempts[index]()
        .then((url) => {
          if (cancelled) return;
          const next = new window.Image();
          next.onload = () => {
            if (!cancelled) setImage(next);
          };
          next.onerror = () => tryNext(index + 1);
          next.src = url;
        })
        .catch(() => tryNext(index + 1));
    };

    tryNext(0);
    return () => {
      cancelled = true;
    };
  }, [src]);

  return image;
}

async function fetchAsDataUrl(src: string): Promise<string> {
  const response = await fetch(src, { cache: "no-store" });
  if (!response.ok) throw new Error(`Картинка не загрузилась: ${response.status}`);
  const blob = await response.blob();
  // У SVG тип указываем явно: без него старый браузер не рисует его на холсте.
  const typed = src.split("?")[0].toLowerCase().endsWith(".svg") ? new Blob([blob], { type: "image/svg+xml" }) : blob;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать картинку."));
    reader.readAsDataURL(typed);
  });
}
