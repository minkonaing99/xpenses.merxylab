/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// ponytail: dev proxies /api to the local Express server; prod serves same-origin.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "pwa-192.png", "pwa-512.png", "pwa-maskable-512.png"],
      manifest: {
        name: "xpenses",
        short_name: "xpenses",
        description: "Personal expense tracker",
        theme_color: "#f4f2fa",
        background_color: "#f4f2fa",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  // Build straight into the Express app's public dir so prod serves it same-origin.
  // assetsDir "static" (not the default "assets"): the host reverse-proxy reserves
  // /assets/* for a CDN bucket, so hashed assets there 404. /static/* hits Express.
  build: { outDir: "../server/public", emptyOutDir: true, assetsDir: "static" },
  server: {
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    css: false,
  },
});
