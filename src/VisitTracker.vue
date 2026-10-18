<script lang="tsx">
import { defineComponent, onMounted, shallowRef, watch } from "vue";
import { send, useSite } from "./lib.vue";
import { useLocation } from "./routing.vue";
const VisitTracker = defineComponent(
  () => {
    const site = useSite();
    const routeLocation = useLocation();
    const last = shallowRef("");
    onMounted(() => {
      watch(
        () => [routeLocation.pathname, site.loading],
        () => {
          if (site.loading || last.value === routeLocation.pathname) return;
          last.value = routeLocation.pathname;
          // Route views only. Queries, images, polling and SSE are never page views.
          void send("/visits", {
            eventId: crypto.randomUUID(),
            path: routeLocation.pathname.slice(0, 256),
          }).catch(() => {});
        },
        { immediate: true, flush: "post" },
      );
    });
    return () => null;
  },
  { name: "VisitTracker", props: [] },
);
export default VisitTracker;
</script>
