import { renderToString } from "@vue/server-renderer";
import { createApplication } from "./application.vue";
import type { InitialState } from "./context";

export async function render(url: string, initial: InitialState) {
  const { app, router } = createApplication(initial, true);
  await router.push(url);
  await router.isReady();
  return {
    html: await renderToString(app),
    status: router.currentRoute.value.matched[0]?.path.includes("pathMatch")
      ? 404
      : 200,
  };
}
