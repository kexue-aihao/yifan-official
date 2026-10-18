<script lang="tsx">
import { ArrowUpRight } from "lucide-vue-next";
import { motion } from "motion-v";
import { defineComponent } from "vue";
import { useCopy } from "../i18n.vue";
import { useSite } from "../lib.vue";
import { SiteImage } from "../MediaProvider.vue";
import {
  flowEase,
  useImageReveal,
  useMotionPreference,
  useReveal,
} from "../motion.vue";
import { Link } from "../routing.vue";
import { useTheme } from "../ThemeProvider.vue";
const Action = defineComponent(
  (props: { secondary?: boolean }) => {
    const copy = useCopy();
    return () => (
      <Link
        class={(props.secondary ?? false) ? "under-link" : "button"}
        to={(props.secondary ?? false) ? "/portfolio" : "/services"}
      >
        {copy((props.secondary ?? false) ? "影像灵感画廊" : "预约专属体验")}
        <ArrowUpRight size={17} />
      </Link>
    );
  },
  { name: "Action", props: ["secondary"] },
);
const Story = defineComponent(
  (props: { compact?: boolean }) => {
    const copy = useCopy();
    const reveal = useReveal();
    const site = useSite();
    return () => (
      <section
        id="our-story"
        class={`theme-story ${(props.compact ?? false) ? "compact" : ""}`}
      >
        <SiteImage
          src="/images/dress.jpg"
          alt={copy("一袭，心之所向")}
          loading="lazy"
        />
        <motion.div {...reveal.value}>
          <span class="eyebrow">{copy("关于壹梵")}</span>
          <h2>{copy("为每一个你，定格不凡。")}</h2>
          <p>{copy("从婚纱影像到个人表达，从重要庆典到日常心动。")}</p>
          <p>{copy("女生 · 男生 · 每一种自我表达")}</p>
          <button class="text-button" onClick={() => site.openChat()}>
            {copy("联系专属顾问")}
            <ArrowUpRight size={18} />
          </button>
        </motion.div>
      </section>
    );
  },
  { name: "Story", props: ["compact"] },
);
const ThemeHome = defineComponent(
  () => {
    const appearance = useTheme();
    const reduced = useMotionPreference();
    const reveal = useReveal();
    const imageReveal = useImageReveal();
    const copy = useCopy();
    const site = useSite();
    return () => {
      if (appearance.theme === "rose")
        return (
          <div class="theme-home rose-home" data-layout="romantic-collage">
            <section class="rose-cover">
              <motion.div class="rose-invitation" {...reveal.value}>
                <span class="eyebrow">YI FAN · ROMANCE JOURNAL</span>
                <h1>
                  {copy("爱的形状，")}
                  <br />
                  <i>{copy("由你定义。")}</i>
                </h1>
                <p>{copy("一抹玫瑰，珍藏浪漫时刻。")}</p>
                <Action />
              </motion.div>
              <motion.figure
                class="rose-photo rose-photo-left"
                initial={
                  reduced.value ? false : { opacity: 0, rotate: -8, y: 35 }
                }
                animate={{ opacity: 1, rotate: -6, y: 0 }}
                transition={{ duration: reduced.value ? 0 : 1, ease: flowEase }}
              >
                <SiteImage
                  class="hero-image"
                  src="/images/wedding.jpg"
                  alt={copy("婚纱影像")}
                />
                <figcaption>01 / {copy("在爱里，自然发生")}</figcaption>
              </motion.figure>
              <motion.figure
                class="rose-photo rose-photo-right"
                initial={
                  reduced.value ? false : { opacity: 0, rotate: 8, y: 45 }
                }
                animate={{ opacity: 1, rotate: 6, y: 0 }}
                transition={{
                  duration: reduced.value ? 0 : 1,
                  delay: reduced.value ? 0 : 0.15,
                  ease: flowEase,
                }}
              >
                <SiteImage
                  src="/images/story.jpg"
                  alt={copy("有爱，有花，有你")}
                />
                <figcaption>02 / {copy("有爱，有花，有你")}</figcaption>
              </motion.figure>
              <span class="rose-cover-foot">
                {copy("婚纱 · 影像 · 造型 · 庆典")}
                <span>WITH LOVE, YI FAN</span>
              </span>
            </section>
            <section class="rose-chapters">
              <div class="theme-section-heading">
                <span class="eyebrow">THE CHAPTERS</span>
                <h2>{copy("你的美好，专属定制。")}</h2>
              </div>
              {site.services.slice(0, 3).map((s, i) => (
                <motion.article
                  key={s.id}
                  {...reveal.value}
                  class="rose-chapter"
                >
                  <span class="chapter-no">0{i + 1}</span>
                  <Link to={`/services?book=${s.id}`} class="chapter-image">
                    <SiteImage src={s.image} alt={s.title} loading="lazy" />
                  </Link>
                  <div>
                    <span class="eyebrow">{s.english}</span>
                    <h3>{s.title}</h3>
                    <p>{s.description}</p>
                    <Link class="under-link" to={`/services?book=${s.id}`}>
                      {copy("预约专属体验")}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                </motion.article>
              ))}
            </section>
            <Story />
            <motion.section {...reveal.value} class="theme-closing">
              <span>Yours, always.</span>
              <h2>
                {copy("让心动，")}
                {copy("有迹可循。")}
              </h2>
              <Action secondary />
            </motion.section>
          </div>
        );
      if (appearance.theme === "sage")
        return (
          <div class="theme-home sage-home" data-layout="studio-index">
            <section class="sage-cover">
              <div class="sage-rail">
                <span>YI FAN STUDIO</span>
                <span>LIGHT / NATURE / YOU</span>
              </div>
              <div class="sage-manifesto">
                <span class="eyebrow">
                  {copy("自然光影，自在记录每一种你。")}
                </span>
                <motion.h1 {...reveal.value}>
                  {copy("每一个你，")}
                  <br />
                  {copy("都不凡。")}
                </motion.h1>
                <p>{copy("美，始于你本来的样子。")}</p>
                <Action />
                <div class="sage-contact-sheet">
                  <SiteImage
                    src="/images/beauty.jpg"
                    alt={copy("细节里的光彩")}
                  />
                  <span>
                    01—06
                    <br />
                    YI FAN
                    <br />
                    ATELIER
                  </span>
                </div>
              </div>
              <motion.figure {...imageReveal.value} class="sage-cover-photo">
                <SiteImage
                  class="hero-image"
                  src="/images/portrait.jpg"
                  alt={copy("你，本就是缪斯")}
                />
                <figcaption>
                  {copy("个人写真 · 自我表达")}
                  <span>FIG. 001</span>
                </figcaption>
              </motion.figure>
            </section>
            <section class="sage-directory">
              <div class="theme-section-heading">
                <span class="eyebrow">STUDIO DIRECTORY / 01</span>
                <h2>{copy("定制服务")}</h2>
                <p>{copy("女生 · 男生 · 每一种自我表达")}</p>
              </div>
              <div>
                {site.services.map((s, i) => (
                  <motion.article key={s.id} {...reveal.value}>
                    <span class="directory-no">0{i + 1}</span>
                    <Link to={`/services?book=${s.id}`}>
                      <h3>{s.title}</h3>
                      <span>{s.english}</span>
                    </Link>
                    <SiteImage src={s.image} alt="" loading="lazy" />
                    <Link
                      to={`/services?book=${s.id}`}
                      aria-label={`${copy("预约专属体验")} · ${s.title}`}
                    >
                      <ArrowUpRight />
                    </Link>
                  </motion.article>
                ))}
              </div>
            </section>
            <motion.section {...reveal.value} class="sage-diptych">
              <SiteImage
                src="/images/wedding.jpg"
                alt={copy("婚纱影像")}
                loading="lazy"
              />
              <div>
                <SiteImage
                  src="/images/story.jpg"
                  alt={copy("有爱，有花，有你")}
                  loading="lazy"
                />
                <h2>{copy("一些关于爱、风格与庆祝的灵感。")}</h2>
                <Action secondary />
              </div>
            </motion.section>
            <Story compact />
          </div>
        );
      return (
        <div class="theme-home noir-home" data-layout="couture-editorial">
          <section class="noir-cover">
            <div class="noir-masthead">
              <span>YI FAN</span>
              <span>
                COUTURE
                <br />
                WEDDING & PORTRAIT
              </span>
            </div>
            <motion.div class="noir-lead" {...reveal.value}>
              <div>
                <span class="eyebrow">THE ART OF YOU / 01</span>
                <h1>
                  {copy("每一个你，")}
                  <br />
                  <i>{copy("都不凡。")}</i>
                </h1>
                <Action />
              </div>
              <motion.figure {...imageReveal.value}>
                <SiteImage
                  class="hero-image"
                  src="/images/wedding.jpg"
                  alt={copy("婚纱影像")}
                />
                <figcaption>YI FAN — {copy("婚纱摄影 · 自然纪实")}</figcaption>
              </motion.figure>
              <aside>
                <SiteImage
                  src="/images/beauty.jpg"
                  alt={copy("细节里的光彩")}
                />
                <span>
                  DETAILS
                  <br />
                  MAKE
                  <br />
                  THE STORY.
                </span>
                <p>{copy("深邃幕色，让主角成为焦点。")}</p>
              </aside>
            </motion.div>
            <div class="noir-cover-line">
              <span>{copy("婚纱 · 影像 · 造型 · 庆典")}</span>
              <span>SCROLL TO EXPLORE ↓</span>
            </div>
          </section>
          <section class="noir-collections">
            <div class="theme-section-heading">
              <span class="eyebrow">THE COLLECTIONS</span>
              <h2>{copy("你的美好，专属定制。")}</h2>
            </div>
            {site.services.map((s, i) => (
              <motion.article key={s.id} {...reveal.value}>
                <div class="noir-collection-title">
                  <span>0{i + 1}</span>
                  <h3>{s.title}</h3>
                  <span>{s.english}</span>
                </div>
                <Link
                  to={`/services?book=${s.id}`}
                  class="noir-collection-image"
                >
                  <SiteImage src={s.image} alt={s.title} loading="lazy" />
                  <span class="noir-image-cta">
                    {copy("预约专属体验")}
                    <ArrowUpRight />
                  </span>
                </Link>
              </motion.article>
            ))}
          </section>
          <Story />
          <motion.section {...reveal.value} class="theme-closing">
            <span>BE THE MUSE.</span>
            <h2>{copy("在光影里，看见心动。")}</h2>
            <Action secondary />
          </motion.section>
        </div>
      );
    };
  },
  { name: "ThemeHome", props: [] },
);
export default ThemeHome;
</script>
