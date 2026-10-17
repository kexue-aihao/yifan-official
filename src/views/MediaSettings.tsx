import { defineComponent, ref as vueRef } from "vue";
import { imageSlots, siteImageURL } from "../../shared/media.mjs";
import { ErrorNotice } from "../components";
import { useCopy } from "../i18n";
import { send, useSite } from "../lib";
import { useMedia, type ImageMap } from "../MediaProvider";
const labels: Record<string, string> = {
  hero: "场景影像",
  wedding: "婚纱影像",
  story: "品牌故事",
  portrait: "个人写真",
  celebration: "庆典布置",
  dress: "礼服",
  beauty: "化妆造型",
  cosplay: "角色写真",
};
const MediaSettings = defineComponent(
  () => {
    const copy = useCopy();
    const media = useMedia();
    const site = useSite();
    const values = vueRef<ImageMap>({ ...media.images });
    const error = vueRef("");
    const saved = vueRef(false);
    const busy = vueRef(false);
    async function save(event: SubmitEvent) {
      event.preventDefault();
      busy.value = true;
      saved.value = false;
      error.value = "";
      try {
        const next = Object.fromEntries(
          Object.entries(values.value)
            .map(([slot, value]) => [slot, (value || "").trim()])
            .filter(([, value]) => value),
        );
        if (Object.values(next).some((value) => !siteImageURL(value)))
          throw new Error("请输入有效的 HTTPS 图片链接");
        await send("/admin/settings/media", { images: next }, "PUT");
        await site.refreshSite();
        saved.value = true;
      } catch (reason) {
        error.value = (reason as Error).message;
      } finally {
        busy.value = false;
      }
    }
    return () => (
      <form class="form media-settings" onSubmit={save}>
        <p>
          {copy(
            "替换站点示例图片，应用于所有主题、作品和默认服务配图。留空恢复示例。",
          )}
        </p>
        <p class="subtle-note">
          {copy("请使用有权展示的 HTTPS 图片直链。图片由访客浏览器直接加载。")}
        </p>
        <div class="media-settings-grid">
          {imageSlots.map((slot) => (
            <article key={slot}>
              <img
                src={siteImageURL(values.value[slot]) || `/images/${slot}.jpg`}
                alt={copy(labels[slot])}
                referrerpolicy="no-referrer"
              />
              <label>
                {copy(labels[slot])}
                <input
                  type="url"
                  value={values.value[slot] || ""}
                  onInput={(event) => {
                    values.value = {
                      ...values.value,
                      [slot]: (event.target as HTMLInputElement).value,
                    };
                    saved.value = false;
                  }}
                  placeholder="https://…"
                  maxlength={2048}
                />
              </label>
              <button
                class="text-button"
                type="button"
                onClick={() => {
                  values.value = { ...values.value, [slot]: "" };
                  saved.value = false;
                }}
              >
                {copy("恢复示例图片")}
              </button>
            </article>
          ))}
        </div>
        <ErrorNotice error={error.value} />
        {saved.value && (
          <p role="status" class="success-notice">
            {copy("站点图片已更新")}
          </p>
        )}
        <button class="button" disabled={busy.value}>
          {copy(busy.value ? "保存中…" : "保存站点图片")}
        </button>
      </form>
    );
  },
  { name: "MediaSettings", props: [] },
);
export default MediaSettings;
