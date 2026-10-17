import { defineConfig } from "vite";
import vueJsx from "@vitejs/plugin-vue-jsx";

export default defineConfig({
  plugins: [vueJsx({ enableObjectSlots: false })],
  build: {
    target: ["es2020", "safari15"],
    outDir: "dist/client",
    manifest: true,
  },
  ssr: { noExternal: ["motion-v", "lucide-vue-next"] },
});
