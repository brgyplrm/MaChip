import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // This allows other devices on your WiFi to connect
    allowedHosts: [".trycloudflare.com", ".ts.net"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        xfwd: true, // Automatically appends X-Forwarded-For header so Express receives real client LAN IPs
        proxyTimeout: 60000,
        timeout: 60000,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            if (err.code === "ECONNREFUSED") {
              // Backend is still initializing; return clean 503 rather than throwing terminal stack trace
              if (res && typeof res.writeHead === "function" && !res.headersSent) {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Backend initializing. Please retry in a moment." }));
              }
              return;
            }
          });
        },
      },
      "/socket.io": {
        target: "http://127.0.0.1:4000",
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            if (err.code === "ECONNREFUSED") {
              // Backend is still initializing; suppress transient socket startup noise
              if (res && typeof res.writeHead === "function" && !res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Backend initializing" }));
              }
              return;
            }
          });
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-mui": ["@mui/material", "@mui/icons-material", "@mui/x-date-pickers"],
          "vendor-charts": ["recharts"],
          "vendor-pdf": ["jspdf", "jspdf-autotable"],
          "vendor-icons": ["lucide-react"],
        },
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: [".trycloudflare.com", ".ts.net"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        xfwd: true,
        proxyTimeout: 60000,
        timeout: 60000,
      },
      "/socket.io": {
        target: "http://127.0.0.1:4000",
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("error", (err, req, res) => {
            if (err.code === "ECONNREFUSED") {
              // Backend is still initializing; suppress transient socket startup noise
              if (res && typeof res.writeHead === "function" && !res.headersSent) {
                res.writeHead(502, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Backend initializing" }));
              }
              return;
            }
          });
        },
      },
    },
  },
});