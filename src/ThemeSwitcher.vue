<script lang="tsx">
import { Check, Palette, RotateCcw } from "lucide-vue-next";
import { computed, defineComponent, ref as vueRef } from "vue";
import { Modal } from "./components.vue";
import { useCopy } from "./i18n.vue";
import { SiteImage } from "./MediaProvider.vue";
import { useTheme } from "./ThemeProvider.vue";
import { themes, type ThemeId } from "./themes";
export const ThemeChoices = defineComponent(
  (props: { value: ThemeId; onChange: (theme: ThemeId) => void }) => {
    const copy = useCopy();
    return () => (
      <div class="theme-choices" role="group" aria-label={copy("主题方案")}>
        {themes.map((theme) => (
          <button
            key={theme.id}
            type="button"
            class="theme-choice"
            data-palette={theme.id}
            aria-label={copy(theme.name)}
            aria-pressed={props.value === theme.id}
            onClick={() => props.onChange(theme.id)}
          >
            <span class="theme-preview" aria-hidden="true">
              <span class="theme-preview-top">
                <span>YI FAN</span>
                <span>— &nbsp; — &nbsp; —</span>
              </span>
              <span class={`theme-preview-composition preview-${theme.id}`}>
                {theme.id === "ivory" ? (
                  <>
                    <SiteImage
                      src="/images/wedding.jpg"
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      Yours,
                      <br />
                      <i>always.</i>
                    </span>
                  </>
                ) : theme.id === "rose" ? (
                  <>
                    <SiteImage
                      src="/images/wedding.jpg"
                      alt=""
                      loading="lazy"
                    />
                    <span>
                      With
                      <br />
                      <i>love.</i>
                    </span>
                    <SiteImage src="/images/story.jpg" alt="" loading="lazy" />
                  </>
                ) : theme.id === "sage" ? (
                  <>
                    <span>
                      THE
                      <br />
                      NATURAL
                      <br />
                      MUSE.<i>01 — STUDIO</i>
                    </span>
                    <SiteImage
                      src="/images/portrait.jpg"
                      alt=""
                      loading="lazy"
                    />
                  </>
                ) : (
                  <>
                    <strong>YI FAN</strong>
                    <span>
                      BE THE
                      <br />
                      <i>MUSE.</i>
                    </span>
                    <SiteImage
                      src="/images/wedding.jpg"
                      alt=""
                      loading="lazy"
                    />
                    <SiteImage src="/images/beauty.jpg" alt="" loading="lazy" />
                  </>
                )}
              </span>
              <span class="theme-preview-foot">
                <span class="theme-swatches">
                  <i />
                  <i />
                  <i />
                </span>
                <span>YF</span>
              </span>
              {props.value === theme.id && (
                <span class="theme-selected">
                  <Check size={15} />
                </span>
              )}
            </span>
            <span class="theme-choice-name">{copy(theme.name)}</span>
            <span class="theme-choice-edition" lang="en">
              {theme.edition}
            </span>
            <span class="theme-choice-mood">{copy(theme.mood)}</span>
          </button>
        ))}
      </div>
    );
  },
  { name: "ThemeChoices", props: ["value", "onChange"] },
);
const ThemeSwitcher = defineComponent(
  () => {
    const copy = useCopy();
    const appearance = useTheme();
    const open = vueRef(false);
    const current = computed(() =>
      themes.find((t) => t.id === appearance.theme)!,
    );
    return () => (
      <>
        <button
          class="theme-toggle icon-button"
          type="button"
          onClick={() => (open.value = true)}
          aria-label={copy("切换主题")}
          aria-haspopup="dialog"
          title={copy(current.value.name)}
        >
          <Palette size={18} aria-hidden="true" />
          <span>{copy("主题")}</span>
        </button>
        {open.value && (
          <Modal
            title={copy("选择你的壹梵主题")}
            wide
            onClose={() => (open.value = false)}
          >
            <div class="theme-studio">
              <p class="theme-intro">
                {copy(
                  "四种独立排版：电影叙事、浪漫拼贴、自然工作室与时装画册。",
                )}
              </p>
              <ThemeChoices
                value={appearance.theme}
                onChange={appearance.choose}
              />
              <div class="theme-studio-footer">
                <button
                  class="text-button"
                  type="button"
                  onClick={() => appearance.choose(null)}
                  aria-pressed={!appearance.preferred}
                >
                  <RotateCcw size={15} />
                  {copy("跟随品牌默认")}
                  <span class="theme-default-name">
                    {copy(
                      themes.find((t) => t.id === appearance.siteTheme)!.name,
                    )}
                  </span>
                </button>
                <button
                  class="button small"
                  type="button"
                  onClick={() => (open.value = false)}
                >
                  {copy("完成")}
                </button>
              </div>
              <p class="theme-saved" role="status">
                {copy("当前主题：{v0}", { v0: copy(current.value.name) })} ·{" "}
                {copy("偏好将保存在此浏览器")}
              </p>
            </div>
          </Modal>
        )}
      </>
    );
  },
  { name: "ThemeSwitcher", props: [] },
);
export default ThemeSwitcher;
</script>
