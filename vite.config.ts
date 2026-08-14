import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Относительные пути: приложение живёт в подкаталоге хостинга и в iframe
  // Битрикс24, а не в корне домена. С base "/" сборка не найдёт свои файлы.
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
  },
});
