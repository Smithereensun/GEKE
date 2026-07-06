import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  appType: "mpa",
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        changelog: path.resolve(__dirname, "changelog/index.html"),
        prototype: path.resolve(__dirname, "prototype/index.html"),
        about: path.resolve(__dirname, "about/index.html"),
      },
    },
  },
});
