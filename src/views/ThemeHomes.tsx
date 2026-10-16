"use client";
import {SiteImage} from '../MediaProvider';
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "../routing";
import { useCopy } from "../i18n";
import { useSite } from "../lib";
import { useTheme } from "../ThemeProvider";

const reveal = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.75 },
};
function Action({ secondary = false }: { secondary?: boolean }) {
  const copy = useCopy();
  return (
    <Link
      className={secondary ? "under-link" : "button"}
      to={secondary ? "/portfolio" : "/services"}
    >
      {copy(secondary ? "影像灵感画廊" : "预约专属体验")}
      <ArrowUpRight size={17} />
    </Link>
  );
}
function Story({ compact = false }: { compact?: boolean }) {
  const copy = useCopy();
  const { openChat } = useSite();
  return (
    <section
      id="our-story"
      className={`theme-story ${compact ? "compact" : ""}`}
    >
      <SiteImage
        src="/images/dress.jpg"
        alt={copy("一袭，心之所向")}
        loading="lazy"
      />
      <motion.div {...reveal}>
        <span className="eyebrow">{copy("关于壹梵")}</span>
        <h2>{copy("为每一个你，定格不凡。")}</h2>
        <p>{copy("从婚纱影像到个人表达，从重要庆典到日常心动。")}</p>
        <p>{copy("女生 · 男生 · 每一种自我表达")}</p>
        <button className="text-button" onClick={() => openChat()}>
          {copy("联系专属顾问")}
          <ArrowUpRight size={18} />
        </button>
      </motion.div>
    </section>
  );
}
export default function ThemeHome() {
  const { theme } = useTheme();
  const copy = useCopy();
  const { services } = useSite();
  if (theme === "rose")
    return (
      <div className="theme-home rose-home" data-layout="romantic-collage">
        <section className="rose-cover">
          <motion.div className="rose-invitation" {...reveal}>
            <span className="eyebrow">YI FAN · ROMANCE JOURNAL</span>
            <h1>
              {copy("爱的形状，")}
              <br />
              <i>{copy("由你定义。")}</i>
            </h1>
            <p>{copy("一抹玫瑰，珍藏浪漫时刻。")}</p>
            <Action />
          </motion.div>
          <motion.figure
            className="rose-photo rose-photo-left"
            initial={{ opacity: 0, rotate: -8, y: 35 }}
            animate={{ opacity: 1, rotate: -6, y: 0 }}
            transition={{ duration: 1 }}
          >
            <SiteImage
              className="hero-image"
              src="/images/wedding.jpg"
              alt={copy("婚纱影像")}
            />
            <figcaption>01 / {copy("在爱里，自然发生")}</figcaption>
          </motion.figure>
          <motion.figure
            className="rose-photo rose-photo-right"
            initial={{ opacity: 0, rotate: 8, y: 45 }}
            animate={{ opacity: 1, rotate: 6, y: 0 }}
            transition={{ duration: 1, delay: 0.15 }}
          >
            <SiteImage src="/images/story.jpg" alt={copy("有爱，有花，有你")} />
            <figcaption>02 / {copy("有爱，有花，有你")}</figcaption>
          </motion.figure>
          <span className="rose-cover-foot">
            {copy("婚纱 · 影像 · 造型 · 庆典")}
            <span>WITH LOVE, YI FAN</span>
          </span>
        </section>
        <section className="rose-chapters">
          <div className="theme-section-heading">
            <span className="eyebrow">THE CHAPTERS</span>
            <h2>{copy("你的美好，专属定制。")}</h2>
          </div>
          {services.slice(0, 3).map((s, i) => (
            <motion.article key={s.id} {...reveal} className="rose-chapter">
              <span className="chapter-no">0{i + 1}</span>
              <Link to={`/services?book=${s.id}`} className="chapter-image">
                <SiteImage src={s.image} alt={s.title} loading="lazy" />
              </Link>
              <div>
                <span className="eyebrow">{s.english}</span>
                <h3>{s.title}</h3>
                <p>{s.description}</p>
                <Link className="under-link" to={`/services?book=${s.id}`}>
                  {copy("预约专属体验")}
                  <ArrowUpRight size={16} />
                </Link>
              </div>
            </motion.article>
          ))}
        </section>
        <Story />
        <section className="theme-closing">
          <span>Yours, always.</span>
          <h2>
            {copy("让心动，")}
            {copy("有迹可循。")}
          </h2>
          <Action secondary />
        </section>
      </div>
    );
  if (theme === "sage")
    return (
      <div className="theme-home sage-home" data-layout="studio-index">
        <section className="sage-cover">
          <div className="sage-rail">
            <span>YI FAN STUDIO</span>
            <span>LIGHT / NATURE / YOU</span>
          </div>
          <div className="sage-manifesto">
            <span className="eyebrow">
              {copy("自然光影，自在记录每一种你。")}
            </span>
            <motion.h1 {...reveal}>
              {copy("每一个你，")}
              <br />
              {copy("都不凡。")}
            </motion.h1>
            <p>{copy("美，始于你本来的样子。")}</p>
            <Action />
            <div className="sage-contact-sheet">
              <SiteImage src="/images/beauty.jpg" alt={copy("细节里的光彩")} />
              <span>
                01—06
                <br />
                YI FAN
                <br />
                ATELIER
              </span>
            </div>
          </div>
          <figure className="sage-cover-photo">
            <SiteImage
              className="hero-image"
              src="/images/portrait.jpg"
              alt={copy("你，本就是缪斯")}
            />
            <figcaption>
              {copy("个人写真 · 自我表达")}
              <span>FIG. 001</span>
            </figcaption>
          </figure>
        </section>
        <section className="sage-directory">
          <div className="theme-section-heading">
            <span className="eyebrow">STUDIO DIRECTORY / 01</span>
            <h2>{copy("定制服务")}</h2>
            <p>{copy("女生 · 男生 · 每一种自我表达")}</p>
          </div>
          <div>
            {services.map((s, i) => (
              <motion.article key={s.id} {...reveal}>
                <span className="directory-no">0{i + 1}</span>
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
        <section className="sage-diptych">
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
        </section>
        <Story compact />
      </div>
    );
  return (
    <div className="theme-home noir-home" data-layout="couture-editorial">
      <section className="noir-cover">
        <div className="noir-masthead">
          <span>YI FAN</span>
          <span>
            COUTURE
            <br />
            WEDDING & PORTRAIT
          </span>
        </div>
        <motion.div className="noir-lead" {...reveal}>
          <div>
            <span className="eyebrow">THE ART OF YOU / 01</span>
            <h1>
              {copy("每一个你，")}
              <br />
              <i>{copy("都不凡。")}</i>
            </h1>
            <Action />
          </div>
          <figure>
            <SiteImage
              className="hero-image"
              src="/images/wedding.jpg"
              alt={copy("婚纱影像")}
            />
            <figcaption>YI FAN — {copy("婚纱摄影 · 自然纪实")}</figcaption>
          </figure>
          <aside>
            <SiteImage src="/images/beauty.jpg" alt={copy("细节里的光彩")} />
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
        <div className="noir-cover-line">
          <span>{copy("婚纱 · 影像 · 造型 · 庆典")}</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </section>
      <section className="noir-collections">
        <div className="theme-section-heading">
          <span className="eyebrow">THE COLLECTIONS</span>
          <h2>{copy("你的美好，专属定制。")}</h2>
        </div>
        {services.map((s, i) => (
          <motion.article key={s.id} {...reveal}>
            <div className="noir-collection-title">
              <span>0{i + 1}</span>
              <h3>{s.title}</h3>
              <span>{s.english}</span>
            </div>
            <Link
              to={`/services?book=${s.id}`}
              className="noir-collection-image"
            >
              <SiteImage src={s.image} alt={s.title} loading="lazy" />
              <span className="noir-image-cta">
                {copy("预约专属体验")}
                <ArrowUpRight />
              </span>
            </Link>
          </motion.article>
        ))}
      </section>
      <Story />
      <section className="theme-closing">
        <span>BE THE MUSE.</span>
        <h2>{copy("在光影里，看见心动。")}</h2>
        <Action secondary />
      </section>
    </div>
  );
}
