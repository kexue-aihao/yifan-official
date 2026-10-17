import { Plus } from "lucide-vue-next";
import { AnimatePresence, motion } from "motion-v";
import { defineComponent, shallowRef, ref as vueRef } from "vue";
import { Arrow, Modal } from "../components";
import { useCopy } from "../i18n";
import { SiteImage } from "../MediaProvider";
import {
  FilterTabs,
  flowEase,
  layoutFlow,
  useMotionPreference,
} from "../motion";
import { Link, useSearchParams } from "../routing";
import { useTheme } from "../ThemeProvider";
const works = [
  {
    title: "在爱里，自然发生",
    en: "LOVE IN THE OPEN AIR",
    category: "婚纱影像",
    image: "/images/wedding.jpg",
    text: "让风掠过裙摆，把情绪留给光。自然纪实的婚纱影像灵感。",
  },
  {
    title: "你，本就是缪斯",
    en: "THE EVERYDAY MUSE",
    category: "个人写真",
    image: "/images/portrait.jpg",
    text: "一束自然光，一次与自己的相遇。风格由你定义。",
  },
  {
    title: "爱意，漫过时光",
    en: "A TIMELESS KIND OF LOVE",
    category: "婚纱影像",
    image: "/images/hero.jpg",
    text: "记录亲密与陪伴的真实温度，让重要的时刻成为永恒。",
  },
  {
    title: "把日子过成纪念日",
    en: "CELEBRATE THE LITTLE THINGS",
    category: "庆典布置",
    image: "/images/celebration.jpg",
    text: "花艺、烛光、餐桌与色彩，构成属于你的仪式感。",
  },
  {
    title: "一袭，心之所向",
    en: "DRESSED IN A DREAM",
    category: "礼服造型",
    image: "/images/dress.jpg",
    text: "从轮廓到纹理，以礼服表达当下的心境。",
  },
  {
    title: "细节里的光彩",
    en: "BEAUTY, YOUR WAY",
    category: "礼服造型",
    image: "/images/beauty.jpg",
    text: "用细致的妆容和镜头，看见本来的光彩。",
  },
  {
    title: "成为想象中的自己",
    en: "BEYOND THE EVERYDAY",
    category: "角色写真",
    image: "/images/cosplay.jpg",
    text: "人物摄影的光影参考。Cosplay 可按具体角色定制布景与造型，此图为人像示意。",
  },
  {
    title: "有爱，有花，有你",
    en: "A GATHERING OF LOVE",
    category: "庆典布置",
    image: "/images/story.jpg",
    text: "把爱藏进场景细节，让每一次相聚被温柔记住。",
  },
];
const Portfolio = defineComponent(
  () => {
    const copy = useCopy();
    const appearance = useTheme();
    const reduced = useMotionPreference();
    const [params] = useSearchParams();
    const filter = vueRef(params.value.get("category") || "全部灵感");
    const selected = vueRef<(typeof works)[number] | null>(null);
    const origin = shallowRef<HTMLImageElement | null>(null);
    return () => (
      <div
        class={`page container portfolio-page portfolio-${appearance.theme}`}
      >
        <div class="page-title">
          <span class="eyebrow">{copy("A CURATED WORLD OF YI FAN")}</span>
          <h1>{copy("在光影里，看见心动。")}</h1>
          <p>
            {copy("一些关于爱、风格与庆祝的灵感。")}
            <br />
            {copy("你的故事，将拥有属于自己的模样。")}
          </p>
        </div>
        <FilterTabs
          items={["全部灵感", ...new Set(works.map((w) => w.category))]}
          value={filter.value}
          onChange={(__value) => {
            filter.value = __value;
          }}
          label={copy("作品分类")}
        />
        <div
          class={`gallery-grid gallery-${appearance.theme}`}
          data-layout={`gallery-${appearance.theme}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {works
              .filter(
                (w) =>
                  filter.value === "全部灵感" || w.category === filter.value,
              )
              .map((w, i) => (
                <motion.button
                  class="gallery-item"
                  key={w.title}
                  onClick={(event) => {
                    origin.value = (
                      event.currentTarget as HTMLElement
                    ).querySelector("img");
                    selected.value = w;
                  }}
                  layout={reduced.value ? false : "position"}
                  initial={reduced.value ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: reduced.value ? 1 : 0.97,
                    transition: { duration: reduced.value ? 0 : 0.16 },
                  }}
                  transition={{
                    duration: reduced.value ? 0 : 0.32,
                    delay: reduced.value ? 0 : Math.min(i * 0.025, 0.1),
                    ease: flowEase,
                    layout: reduced.value ? { duration: 0 } : layoutFlow,
                  }}
                >
                  {appearance.theme === "sage" && (
                    <span class="gallery-index">
                      FIG. {String(i + 1).padStart(3, "0")} / {copy(w.category)}
                    </span>
                  )}
                  {appearance.theme === "noir" && (
                    <div class="gallery-editorial-head">
                      <span>0{i + 1}</span>
                      <h2>{copy(w.title)}</h2>
                    </div>
                  )}
                  <div class="image-wrap">
                    <SiteImage
                      src={w.image}
                      alt={copy(w.title)}
                      loading="lazy"
                    />
                    <span class="gallery-plus">
                      <Plus size={22} />
                    </span>
                  </div>
                  <div>
                    {appearance.theme !== "noir" && <h2>{copy(w.title)}</h2>}
                    <span>{copy(w.en)}</span>
                    {appearance.theme === "rose" && <p>{copy(w.text)}</p>}
                    {appearance.theme === "noir" && (
                      <span class="gallery-category">
                        {copy(w.category)}
                        <Plus size={18} />
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
          </AnimatePresence>
        </div>
        <p class="image-disclaimer">
          {copy(
            "本画廊为风格灵感参考，图片来自 Unsplash，并非壹梵真实客片。正式作品将在取得授权后更新。",
          )}
        </p>
        {selected.value && (
          <Modal
            wide
            origin={origin.value}
            title={copy(selected.value.title)}
            onClose={() => (selected.value = null)}
          >
            <SiteImage
              class="lightbox-image"
              src={selected.value.image}
              alt={copy(selected.value.title)}
            />
            <span class="eyebrow">{copy(selected.value.en)}</span>
            <p>{copy(selected.value.text)}</p>
            <p class="subtle-note">{copy("风格示意 · 非品牌客片")}</p>
            <Link
              class="button"
              to="/services"
              onClick={() => (selected.value = null)}
            >
              {copy("预约我的风格")}
              <Arrow />
            </Link>
          </Modal>
        )}
      </div>
    );
  },
  { name: "Portfolio", props: [] },
);
export default Portfolio;
