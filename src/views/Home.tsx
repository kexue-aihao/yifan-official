"use client";
import { useCopy } from "../i18n";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import { ArrowDown, ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "../routing";
import { useSite } from "../lib";

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
export default function Home() {
  const copy = useCopy();
  const { services, openChat } = useSite();
  const [scene, setScene] = useState(0),
    [serviceIndex, setServiceIndex] = useState(0);
  const ref = useRef<HTMLElement>(null),
    reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "23%"]);
  const sceneData = {
      ...scenes[scene],
      title: scenes[scene].title.map((line) => copy(line)),
      subtitle: copy(scenes[scene].subtitle),
      description: copy(scenes[scene].description),
    },
    selected = services[serviceIndex] || services[0];
  return (
    <>
      <section
        className="cinema"
        ref={ref}
        aria-label={copy("壹梵婚纱与定制影像")}
      >
        <motion.div className="cinema-media" style={{ y: reduced ? 0 : y }}>
          <AnimatePresence initial={false} mode="sync">
            <motion.img
              className="hero-image"
              key={sceneData.image}
              src={sceneData.image}
              alt={copy("{v0}风格示意", { v0: sceneData.description })}
              style={{ objectPosition: sceneData.position }}
              initial={{ opacity: 0, scale: reduced ? 1 : 1.08 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduced ? 0 : 1.15,
                ease: [0.2, 0.65, 0.3, 1],
              }}
              fetchPriority="high"
            />
          </AnimatePresence>
        </motion.div>
        <div className="cinema-shade" />
        <motion.div
          className="cinema-curtain"
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: reduced ? 0 : 1.1, ease: [0.76, 0, 0.24, 1] }}
        />
        <div className="cinema-content">
          <p className="cinema-signature">{copy("壹梵定制 / 婚纱与影像")}</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={scene}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: reduced ? 0 : -12 }}
              transition={{ duration: 0.35 }}
            >
              <h1 aria-label={sceneData.title.join("")}>
                {sceneData.title.map((line, index) => (
                  <span className="cinema-line" key={line}>
                    <motion.span
                      initial={{ y: reduced ? 0 : "110%" }}
                      animate={{ y: 0 }}
                      transition={{
                        delay: reduced ? 0 : 0.35 + index * 0.13,
                        duration: 0.9,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      {line}
                    </motion.span>
                  </span>
                ))}
              </h1>
              <p className="cinema-english">{sceneData.subtitle}</p>
            </motion.div>
          </AnimatePresence>
          <motion.div
            className="cinema-actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduced ? 0 : 0.9, duration: 0.6 }}
          >
            <Link to="/services" className="cinema-book">
              {copy("预约你的专属时刻")}
              <ArrowUpRight size={19} />
            </Link>
            <Link to="/portfolio" className="cinema-browse">
              {copy("浏览影像作品")}
            </Link>
          </motion.div>
        </div>
        <div className="cinema-bottom">
          <a href="#atelier" className="cinema-scroll">
            <ArrowDown size={18} />
            {copy("向下，遇见美好")}
          </a>
          <div className="scene-picker">
            <span aria-live="polite">{sceneData.description}</span>
            <div className="scene-progress">
              {scenes.map((s, i) => (
                <button
                  key={s.image}
                  aria-label={copy("切换至{v0}", { v0: copy(s.description) })}
                  aria-pressed={i === scene}
                  onClick={() => setScene(i)}
                  className={scene === i ? "selected" : ""}
                >
                  <span />
                </button>
              ))}
            </div>
            <button
              className="scene-next"
              onClick={() => setScene((scene + 1) % scenes.length)}
              aria-label={copy("下一张影像")}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </div>
        <span className="cinema-caption">{copy("影像为风格灵感示意")}</span>
      </section>
      <section className="atelier-intro container" id="atelier">
        <div>
          <p className="quiet-label">{copy("关于壹梵")}</p>
          <h2>
            {copy("值得珍藏的，")}
            <br />
            {copy("从来不止一张照片。")}
          </h2>
        </div>
        <div className="atelier-intro-copy">
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
          <button className="under-link text-button" onClick={() => openChat()}>
            {copy("和专属顾问聊聊")}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </section>
      <section className="image-essay container" aria-label={copy("影像灵感")}>
        <Link to="/portfolio?category=婚纱影像" className="essay-main">
          <div className="essay-image">
            <img
              src="/images/wedding.jpg"
              loading="lazy"
              alt={copy("海边婚纱影像风格示意")}
            />
          </div>
          <div>
            <h3>{copy("在爱里，自然发生。")}</h3>
            <p>{copy("Wedding stories")}</p>
          </div>
        </Link>
        <div className="essay-side">
          <span className="essay-script" aria-hidden="true">
            {copy("For the moments")}
            <br />
            {copy("that become forever.")}
          </span>
          <Link to="/portfolio?category=个人写真">
            <div className="essay-image">
              <img
                src="/images/portrait.jpg"
                loading="lazy"
                alt={copy("自然光个人写真风格示意")}
              />
            </div>
            <div className="essay-caption">
              <h3>{copy("你，本就是缪斯。")}</h3>
              <ArrowUpRight size={24} />
            </div>
          </Link>
        </div>
      </section>
      <section className="atelier-services" id="services">
        <div className="container">
          <div className="atelier-heading">
            <div>
              <p className="quiet-label">{copy("专属定制")}</p>
              <h2>{copy("美，有很多种可能。")}</h2>
            </div>
            <Link className="under-link" to="/services">
              {copy("探索全部服务")}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="service-showcase">
            <div
              className="service-selector"
              role="tablist"
              aria-label={copy("服务预览")}
            >
              {services.map((service, index) => (
                <button
                  key={service.id}
                  id={`service-tab-${service.id}`}
                  role="tab"
                  aria-selected={index === serviceIndex}
                  aria-controls="service-preview"
                  tabIndex={index === serviceIndex ? 0 : -1}
                  className={index === serviceIndex ? "chosen" : ""}
                  onClick={() => setServiceIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      const next =
                        (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          services.length) %
                        services.length;
                      setServiceIndex(next);
                      document
                        .getElementById(`service-tab-${services[next].id}`)
                        ?.focus();
                    }
                  }}
                >
                  <span>{service.title}</span>
                  <ArrowUpRight size={23} />
                </button>
              ))}
            </div>
            <div
              className="service-stage"
              id="service-preview"
              role="tabpanel"
              aria-labelledby={
                selected ? `service-tab-${selected.id}` : undefined
              }
            >
              {selected && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selected.id}
                    initial={{ opacity: 0, x: reduced ? 0 : 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduced ? 0 : -18 }}
                    transition={{ duration: 0.35 }}
                  >
                    <img
                      src={selected.image}
                      alt={copy("{v0}风格示意", { v0: selected.title })}
                      loading="lazy"
                    />
                    <div className="service-stage-copy">
                      <p>{selected.description}</p>
                      <Link
                        to={`/services?category=${encodeURIComponent(selected.category)}`}
                        className="under-link"
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
      </section>
      <section className="atelier-story container" id="our-story">
        <div className="atelier-story-photo">
          <img
            src="/images/dress.jpg"
            alt={copy("婚纱礼服风格灵感")}
            loading="lazy"
          />
          <span>
            {copy("Thoughtfully chosen.")}
            <br />
            {copy("Beautifully yours.")}
          </span>
        </div>
        <div className="atelier-story-text">
          <p className="quiet-label">{copy("壹份初心 · 梵而不凡")}</p>
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
          <Link className="under-link" to="/community">
            {copy("在社区，分享你的故事")}
            <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="atelier-appointment">
        <p>{copy("下一段美好，从与你相遇开始。")}</p>
        <h2>
          {copy("Let’s make")}
          <br />
          {copy("something beautiful.")}
        </h2>
        <Link to="/services" className="button light">
          {copy("预约专属体验")}
          <ArrowUpRight size={18} />
        </Link>
        <span>{copy("壹梵定制 YI FAN")}</span>
      </section>
    </>
  );
}
