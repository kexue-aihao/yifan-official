<script lang="tsx">
import {
  defineComponent,
  inject,
  onMounted,
  provide,
  reactive,
  watch,
  type ImgHTMLAttributes,
  type InjectionKey,
} from "vue";
export type ImageMap = Partial<Record<string, string>>;
const key: InjectionKey<{
  images: ImageMap;
  setImages: (value: ImageMap) => void;
}> = Symbol("media");
export function useMedia() {
  return inject(key)!;
}
export function provideMedia(images: ImageMap) {
  const state = reactive({
    images,
    setImages(value: ImageMap) {
      state.images = value;
    },
  });
  provide(key, state);
  onMounted(() =>
    watch(
      () => state.images,
      (value) => {
        document.body.style.setProperty(
          "--image-dress",
          `url("${value.dress || "/images/dress.jpg"}")`,
        );
      },
      { immediate: true },
    ),
  );
  return state;
}
export function useImageSource() {
  const state = useMedia();
  return (source: string) => {
    const slot = /^\/images\/([a-z]+)\.jpg$/.exec(source)?.[1];
    return slot && state.images[slot] ? state.images[slot]! : source;
  };
}
export const SiteImage = defineComponent(
  (
    props: ImgHTMLAttributes & {
      src?: string;
    },
    { attrs },
  ) => {
    const image = useImageSource();
    return () => (
      <img
        {...attrs}
        src={image(props.src || "")}
        referrerpolicy="no-referrer"
      />
    );
  },
  { name: "SiteImage", inheritAttrs: false, props: ["src"] },
);

export default {};
</script>
