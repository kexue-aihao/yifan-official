import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJsx from "@vitejs/plugin-vue-jsx";

export default defineConfig({
  plugins: [vue(), vueJsx({ enableObjectSlots: false })],
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".json", ".vue"],
  },
  build: {
    target: ["es2020", "safari15"],
    outDir: "dist/client",
    manifest: true,
  },
  ssr: { noExternal: ["motion-v", "lucide-vue-next"] },
});
