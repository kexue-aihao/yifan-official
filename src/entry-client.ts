import { createApplication } from "./application.vue";
import type { InitialState } from "./context";

declare global {
  interface Window {
    __YIFAN__: InitialState;
  }
}
const { app, router } = createApplication(window.__YIFAN__);
void router.isReady().then(() => app.mount("#app"));
