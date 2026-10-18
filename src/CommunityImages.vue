<script lang="tsx">
import { computed, defineComponent, ref as vueRef } from "vue";
import { parsePostImages } from "../shared/media.mjs";
import { useCopy } from "./i18n.vue";
export const CommunityImage = defineComponent(
  (props: { url: string; alt?: string }) => {
    const copy = useCopy();
    const failed = vueRef(false);
    return () => (
      <figure class="community-image">
        {failed.value ? (
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
          >
            {copy("图片未能加载，打开原图")}
          </a>
        ) : (
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
          >
            <img
              src={props.url}
              alt={(props.alt ?? "") || copy("社区图片")}
              loading="lazy"
              referrerpolicy="no-referrer"
              onError={() => (failed.value = true)}
            />
          </a>
        )}
      </figure>
    );
  },
  { name: "CommunityImage", props: ["url", "alt"] },
);
export const PostContent = defineComponent(
  (props: { body: string; images?: string[] }) => () => (
    <div class="post-content">
      {parsePostImages(props.body).map((part, index) =>
        part.type === "image" ? (
          <CommunityImage key={index} url={part.value} alt={part.alt} />
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
      {!!(props.images ?? []).length && (
        <div class="post-image-grid">
          {(props.images ?? []).map((url) => (
            <CommunityImage key={url} url={url} />
          ))}
        </div>
      )}
    </div>
  ),
  { name: "PostContent", props: ["body", "images"] },
);
export const PostSummary = defineComponent(
  (props: { body: string; images?: string[] }) => {
    const copy = useCopy();
    const parts = computed(() => parsePostImages(props.body));
    const text = computed(() =>
      parts.value
        .filter((part) => part.type === "text")
        .map((part) => part.value)
        .join("")
        .trim(),
    );
    const previews = computed(() =>
      [
        ...new Set([
          ...parts.value
            .filter((part) => part.type === "image")
            .map((part) => part.value),
          ...(props.images ?? []),
        ]),
      ].slice(0, 3),
    );
    return () => (
      <>
        <p>
          {text.value.slice(0, 180)}
          {text.value.length > 180 ? "…" : ""}
        </p>
        {!!previews.value.length && (
          <div class="post-thumbnails">
            {previews.value.map((url) => (
              <img
                key={url}
                src={url}
                alt={copy("社区图片")}
                loading="lazy"
                referrerpolicy="no-referrer"
                onError={(event) => {
                  (event.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ))}
          </div>
        )}
      </>
    );
  },
  { name: "PostSummary", props: ["body", "images"] },
);
export function browserSignals() {
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* Unavailable browser signal. */
  }
  return {
    language: navigator.language.slice(0, 50),
    timezone: timezone.slice(0, 100),
    platform: navigator.platform.slice(0, 100),
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    pixelRatio: Math.min(20, window.devicePixelRatio || 1),
    concurrency: Math.min(1024, navigator.hardwareConcurrency || 0),
  };
}

export default {};
</script>
