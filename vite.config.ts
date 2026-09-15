import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Относительные пути: приложение живёт в подкаталоге хостинга и в iframe
  // Битрикс24, а не в корне домена. С base "/" сборка не найдёт свои файлы.
  base: "./",
  plugins: [react()],
  define: {
    // Метка сборки — к адресам картинок каталога. Хостинг велит браузеру
    // хранить картинки год, и перерисованный значок не показывался, пока
    // не почистишь кэш. С меткой каждая выкладка — новые адреса.
    __BUILD_STAMP__: JSON.stringify(Date.now().toString(36)),
  },
  server: {
    port: 5173,
  },
});
