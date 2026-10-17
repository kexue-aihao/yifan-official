import { ArrowDown, ArrowUpRight, ChevronRight, UserRound } from "lucide-vue-next";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useScroll,
  useTransform,
} from "motion-v";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  shallowRef,
  ref as vueRef,
} from "vue";
import { useCopy } from "../i18n";
import { useSite } from "../lib";
import { SiteImage, useImageSource } from "../MediaProvider";
import {
  flowEase,
  layoutFlow,
  useImageReveal,
  useMotionPreference,
  useReveal,
} from "../motion";
import { Link } from "../routing";
import { useTheme } from "../ThemeProvider";
import ThemeHome from "./ThemeHomes";
const scenes = [
  {
    image: "/images/wedding.jpg",
    title: ["爱的形状，", "由你定义。"],
    subtitle: "The art of being in love.",
    description: "婚纱摄影 · 自然纪实",
    position: "center 46%",
  },
  {
    image: "/images/story.jpg",
    title: ["让心动，", "有迹可循。"],
    subtitle: "A feeling, made timeless.",
    description: "婚礼细节 · 私人定制",
    position: "center 50%",
  },
  {
    image: "/images/portrait.jpg",
    title: ["每一个你，", "都不凡。"],
    subtitle: "Beautifully, simply you.",
    description: "个人写真 · 自我表达",
    position: "center 35%",
  },
];
const Home = defineComponent(
  () => {
    const appearance = useTheme();
    return () =>
      appearance.theme === "ivory" ? <CinematicHome /> : <ThemeHome />;
  },
  { name: "Home", props: [] },
);
export default Home;
const CinematicHome = defineComponent(
  () => {
    const imageSource = useImageSource();
    const copy = useCopy();
    const site = useSite();
    const scene = vueRef(0);
    const pendingScene = vueRef<number | null>(null);
    let sceneRequest = 0;
    onBeforeUnmount(() => {
      sceneRequest++;
    });
    const direction = vueRef(1);
    const serviceIndex = vueRef(0);
    const ref = shallowRef<HTMLElement | null>(null);
    const reduced = useMotionPreference();
    const { scrollYProgress } = useScroll({
      target: ref,
      offset: ["start start", "end start"],
    });
    const y = useTransform(scrollYProgress, [0, 1], ["0%", "23%"]);
    const contentY = useTransform(scrollYProgress, [0, 1], [0, 70]);
    const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.1]);
    const reveal = useReveal();
    const imageReveal = useImageReveal();
    async function changeScene(
      next: number,
      nextDirection = next > scene.value ? 1 : -1,
    ) {
      const request = ++sceneRequest;
      pendingScene.value = next;
      if (next === scene.value) {
        pendingScene.value = null;
        return;
      }
      // Decode the next frame before changing either the photo or its caption.
      // A slow image keeps the current composition intact; the latest pick wins.
      const image = new Image();
      image.referrerPolicy = "no-referrer";
      image.src = imageSource(scenes[next].image);
      try {
        await image.decode();
      } catch {
        if (request === sceneRequest) pendingScene.value = null;
        return;
      }
      if (request !== sceneRequest) return;
      direction.value = nextDirection;
      scene.value = next;
      pendingScene.value = null;
    }
    const sceneData = computed(() => ({
      ...scenes[scene.value],
      title: scenes[scene.value].title.map((line) => copy(line)),
      subtitle: copy(scenes[scene.value].subtitle),
      description: copy(scenes[scene.value].description),
    }));
    const selected = computed(
      () => site.services[serviceIndex.value] || site.services[0],
    );
    return () => (
      <>
        <section
          data-layout="cinematic-narrative"
          class="cinema"
          aria-busy={pendingScene.value !== null}
          ref={ref}
          aria-label={copy("壹梵婚纱与定制影像")}
        >
          <motion.div class="cinema-media" style={{ y: reduced.value ? 0 : y }}>
            <AnimatePresence initial={false} mode="sync">
              <motion.img
                class="hero-image"
                key={sceneData.value.image}
                src={imageSource(sceneData.value.image)}
                referrerpolicy="no-referrer"
                alt={copy("{v0}风格示意", {
                  v0: sceneData.value.description,
                })}
                style={{ objectPosition: sceneData.value.position }}
                initial={
                  reduced.value
                    ? { opacity: 0 }
                    : {
                        clipPath:
                          direction.value > 0
                            ? "inset(0% 0% 0% 100%)"
                            : "inset(0% 100% 0% 0%)",
                        scale: 1.07,
                      }
                }
                animate={{
                  opacity: 1,
                  scale: 1,
                  clipPath: "inset(0% 0% 0% 0%)",
                }}
                exit={{
                  opacity: 0,
                  transition: { duration: reduced.value ? 0 : 0.9 },
                }}
                transition={{
                  duration: reduced.value ? 0 : 0.65,
                  ease: flowEase,
                }}
                fetchpriority="high"
              />
            </AnimatePresence>
          </motion.div>
          <div class="cinema-shade" />
          <motion.div
            class="cinema-curtain"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{
              duration: reduced.value ? 0 : 0.7,
              ease: [0.76, 0, 0.24, 1],
            }}
          />
          <motion.div
            class="cinema-content"
            style={{
              y: reduced.value ? 0 : contentY,
              opacity: reduced.value ? 1 : contentOpacity,
            }}
          >
            <motion.p
              class="cinema-signature"
              initial={{ opacity: 0, y: reduced.value ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduced.value ? 0 : 0.18,
                duration: reduced.value ? 0 : 0.65,
                ease: flowEase,
              }}
            >
              {copy("壹梵定制 / 婚纱与影像")}
            </motion.p>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={scene.value}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: reduced.value ? 0 : -12 }}
                transition={{
                  duration: reduced.value ? 0 : 0.2,
                  ease: flowEase,
                }}
              >
                <h1 aria-label={sceneData.value.title.join("")}>
                  {sceneData.value.title.map((line, index) => (
                    <span class="cinema-line" key={line}>
                      <motion.span
                        initial={{ y: reduced.value ? 0 : "110%" }}
                        animate={{ y: 0 }}
                        transition={{
                          delay: reduced.value ? 0 : 0.06 + index * 0.065,
                          duration: reduced.value ? 0 : 0.5,
                          ease: flowEase,
                        }}
                      >
                        {line}
                      </motion.span>
                    </span>
                  ))}
                </h1>
                <motion.p
                  class="cinema-english"
                  initial={{ opacity: 0, y: reduced.value ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: reduced.value ? 0 : 0.16,
                    duration: reduced.value ? 0 : 0.4,
                    ease: flowEase,
                  }}
                >
                  {sceneData.value.subtitle}
                </motion.p>
              </motion.div>
            </AnimatePresence>
            <motion.div
              class="cinema-actions"
              initial={{ opacity: 0, y: reduced.value ? 0 : 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: reduced.value ? 0 : 0.28,
                duration: reduced.value ? 0 : 0.44,
                ease: flowEase,
              }}
            >
              <Link to="/services" class="cinema-book">
                {copy("预约你的专属时刻")}
                <ArrowUpRight size={19} />
              </Link>
              <Link to="/portfolio" class="cinema-browse">
                {copy("浏览影像作品")}
              </Link>
              {!site.user && (
                <Link to="/login" class="cinema-account">
                  <UserRound size={16} />
                  {copy("登录 / 注册")}
                </Link>
              )}
            </motion.div>
          </motion.div>
          <div class="cinema-bottom">
            <a href="#atelier" class="cinema-scroll">
              <ArrowDown size={18} />
              {copy("向下，遇见美好")}
            </a>
            <div class="scene-picker">
              <span aria-live="polite">{sceneData.value.description}</span>
              <div class="scene-progress">
                {scenes.map((s, i) => (
                  <button
                    key={s.image}
                    aria-label={copy("切换至{v0}", {
                      v0: copy(s.description),
                    })}
                    aria-pressed={i === scene.value}
                    onClick={() => changeScene(i)}
                    class={scene.value === i ? "selected" : ""}
                  >
                    <span>
                      <motion.i
                        animate={{ scaleX: scene.value === i ? 1 : 0 }}
                        transition={{
                          duration: reduced.value ? 0 : 0.65,
                          ease: flowEase,
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
              <button
                class="scene-next"
                onClick={() =>
                  changeScene(
                    ((pendingScene.value ?? scene.value) + 1) % scenes.length,
                    1,
                  )
                }
                aria-label={copy("下一张影像")}
              >
                <ChevronRight size={22} />
              </button>
            </div>
          </div>
          <span class="cinema-caption">{copy("影像为风格灵感示意")}</span>
        </section>
        <motion.section
          {...reveal.value}
          class="atelier-intro container"
          id="atelier"
        >
          <div>
            <p class="quiet-label">{copy("关于壹梵")}</p>
            <h2>
              {copy("值得珍藏的，")}
              <br />
              {copy("从来不止一张照片。")}
            </h2>
          </div>
          <div class="atelier-intro-copy">
            <p>
              {copy("是穿上婚纱时的怦然心动，")}
              <br />
              {copy("是镜头前，终于自在的自己。")}
              <br />
              {copy("是把平凡的一天，过成值得纪念的日子。")}
            </p>
            <p>
              {copy("从婚纱影像到个人表达，壹梵以细致的沟通与定制，")}
              <br />
              {copy("陪你把关于美的想象，变成触手可及的记忆。")}
            </p>
            <button
              class="under-link text-button"
              onClick={() => site.openChat()}
            >
              {copy("和专属顾问聊聊")}
              <ArrowUpRight size={17} />
            </button>
          </div>
        </motion.section>
        <motion.section
          {...reveal.value}
          class="image-essay container"
          aria-label={copy("影像灵感")}
        >
          <Link to="/portfolio?category=婚纱影像" class="essay-main">
            <motion.div {...imageReveal.value} class="essay-image">
              <SiteImage
                src="/images/wedding.jpg"
                loading="lazy"
                alt={copy("海边婚纱影像风格示意")}
              />
            </motion.div>
            <div>
              <h3>{copy("在爱里，自然发生。")}</h3>
              <p>{copy("Wedding stories")}</p>
            </div>
          </Link>
          <div class="essay-side">
            <span class="essay-script" aria-hidden="true">
              {copy("For the moments")}
              <br />
              {copy("that become forever.")}
            </span>
            <Link to="/portfolio?category=个人写真">
              <motion.div {...imageReveal.value} class="essay-image">
                <SiteImage
                  src="/images/portrait.jpg"
                  loading="lazy"
                  alt={copy("自然光个人写真风格示意")}
                />
              </motion.div>
              <div class="essay-caption">
                <h3>{copy("你，本就是缪斯。")}</h3>
                <ArrowUpRight size={24} />
              </div>
            </Link>
          </div>
        </motion.section>
        <motion.section
          {...reveal.value}
          class="atelier-services"
          id="services"
        >
          <div class="container">
            <div class="atelier-heading">
              <div>
                <p class="quiet-label">{copy("专属定制")}</p>
                <h2>{copy("美，有很多种可能。")}</h2>
              </div>
              <Link class="under-link" to="/services">
                {copy("探索全部服务")}
                <ArrowUpRight size={17} />
              </Link>
            </div>
            <div class="service-showcase">
              <LayoutGroup>
                <div
                  class="service-selector"
                  role="tablist"
                  aria-label={copy("服务预览")}
                >
                  {site.services.map((service, index) => (
                    <button
                      key={service.id}
                      id={`service-tab-${service.id}`}
                      role="tab"
                      aria-selected={index === serviceIndex.value}
                      aria-controls="service-preview"
                      tabindex={index === serviceIndex.value ? 0 : -1}
                      class={index === serviceIndex.value ? "chosen" : ""}
                      onClick={() => (serviceIndex.value = index)}
                      onKeydown={(e) => {
                        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                          e.preventDefault();
                          const next =
                            (index +
                              (e.key === "ArrowDown" ? 1 : -1) +
                              site.services.length) %
                            site.services.length;
                          serviceIndex.value = next;
                          document
                            .getElementById(
                              `service-tab-${site.services[next].id}`,
                            )
                            ?.focus();
                        }
                      }}
                    >
                      <span>{service.title}</span>
                      <ArrowUpRight size={23} />
                      {index === serviceIndex.value && (
                        <motion.i
                          class="service-active-line"
                          layoutId="service-active-line"
                          transition={
                            reduced.value ? { duration: 0 } : layoutFlow
                          }
                        />
                      )}
                    </button>
                  ))}
                </div>
              </LayoutGroup>
              <div
                class="service-stage"
                id="service-preview"
                role="tabpanel"
                aria-labelledby={
                  selected.value
                    ? `service-tab-${selected.value.id}`
                    : undefined
                }
              >
                {selected.value && (
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                      key={selected.value.id}
                      initial={{ opacity: 0, y: reduced.value ? 0 : 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                        y: reduced.value ? 0 : -10,
                        transition: { duration: reduced.value ? 0 : 0.18 },
                      }}
                      transition={{
                        duration: reduced.value ? 0 : 0.36,
                        ease: flowEase,
                      }}
                    >
                      <SiteImage
                        src={selected.value.image}
                        alt={copy("{v0}风格示意", {
                          v0: selected.value.title,
                        })}
                        loading="lazy"
                      />
                      <div class="service-stage-copy">
                        <p>{selected.value.description}</p>
                        <Link
                          to={`/services?category=${encodeURIComponent(selected.value.category)}`}
                          class="under-link"
                        >
                          {copy("了解这份体验")}
                          <ArrowUpRight size={17} />
                        </Link>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </motion.section>
        <motion.section
          {...reveal.value}
          class="atelier-story container"
          id="our-story"
        >
          <motion.div {...imageReveal.value} class="atelier-story-photo">
            <SiteImage
              src="/images/dress.jpg"
              alt={copy("婚纱礼服风格灵感")}
              loading="lazy"
            />
            <span>
              {copy("Thoughtfully chosen.")}
              <br />
              {copy("Beautifully yours.")}
            </span>
          </motion.div>
          <div class="atelier-story-text">
            <p class="quiet-label">{copy("壹份初心 · 梵而不凡")}</p>
            <h2>
              {copy("把时间，")}
              <br />
              {copy("留给真正重要的事。")}
            </h2>
            <p>
              {copy("一袭婚纱的选择，一次光影的等待，")}
              <br />
              {copy("一个妆容细节的反复打磨。")}
              <br />
              {copy("我们相信，细致的陪伴，是美好体验的开始。")}
            </p>
            <p>
              {copy("女生、男生、情侣，或是走进热爱角色的你，")}
              <br />
              {copy("每一种真实的表达，都值得被认真看见。")}
            </p>
            <Link class="under-link" to="/community">
              {copy("在社区，分享你的故事")}
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </motion.section>
        <motion.section {...reveal.value} class="atelier-appointment">
          <p>{copy("下一段美好，从与你相遇开始。")}</p>
          <h2>
            {copy("Let’s make")}
            <br />
            {copy("something beautiful.")}
          </h2>
          <Link to="/services" class="button light">
            {copy("预约专属体验")}
            <ArrowUpRight size={18} />
          </Link>
          <span>{copy("壹梵定制 YI FAN")}</span>
        </motion.section>
      </>
    );
  },
  { name: "CinematicHome", props: [] },
);
