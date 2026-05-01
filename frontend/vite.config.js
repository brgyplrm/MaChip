import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(),tailwindcss(),],
  server: {
    host: true, // This allows other devices on your WiFi to connect
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        proxyTimeout: 60000,
        timeout: 60000,
      },
    },
  },
});
