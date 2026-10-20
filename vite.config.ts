import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const isDevelopment = process.env.NODE_ENV === "development";

// Optional: bundle a local Excalidraw build (e.g. the @zsviczian/excalidraw fork used by
// obsidian-excalidraw-plugin) instead of loading the official one from esm.sh.
// Example: EXCALIDRAW_LIB=I:/app/obsidian-excalidraw-plugin/node_modules/@zsviczian/excalidraw
const localExcalidraw = process.env.EXCALIDRAW_LIB
  ? path.resolve(process.env.EXCALIDRAW_LIB)
  : undefined;

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: localExcalidraw
    ? { alias: { "@excalidraw/excalidraw": localExcalidraw } }
    : undefined,
  build: {
    sourcemap: isDevelopment ? "inline" : undefined,
    cssMinify: !isDevelopment,
    minify: !isDevelopment,

    rollupOptions: {
      input: path.resolve(__dirname, "src/mcp-app.html"),
      external: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        ...(localExcalidraw ? [] : ["@excalidraw/excalidraw"]),
        "morphdom",
      ],
      output: {
        paths: {
          "react": "https://esm.sh/react@19.0.0",
          "react-dom": "https://esm.sh/react-dom@19.0.0?deps=react@19.0.0",
          "react-dom/client": "https://esm.sh/react-dom@19.0.0/client?deps=react@19.0.0",
          "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
          "@excalidraw/excalidraw": "https://esm.sh/@excalidraw/excalidraw@0.18.0?deps=react@19.0.0,react-dom@19.0.0",
          "morphdom": "https://esm.sh/morphdom@2.7.8",
        },
      },
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
