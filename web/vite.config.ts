import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  base: "./",
  publicDir: "web/public",
  cacheDir: "/tmp/squeekstage-vite-cache",
  build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
});
