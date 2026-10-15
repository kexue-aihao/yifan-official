"use client";
import { useCopy } from "../i18n";

import { useState } from "react";
import { Link, useSearchParams } from "../routing";
import { Plus } from "lucide-react";
import { Arrow, Modal } from "../components";

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
export default function Portfolio() {
  const copy = useCopy();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get("category") || "全部灵感");
  const [selected, setSelected] = useState<(typeof works)[number] | null>(null);
  return (
    <div className="page container">
      <div className="page-title">
        <span className="eyebrow">{copy("A CURATED WORLD OF YI FAN")}</span>
        <h1>{copy("在光影里，看见心动。")}</h1>
        <p>
          {copy("一些关于爱、风格与庆祝的灵感。")}
          <br />
          {copy("你的故事，将拥有属于自己的模样。")}
        </p>
      </div>
      <div className="filter-tabs" role="group" aria-label={copy("作品分类")}>
        {["全部灵感", ...new Set(works.map((w) => w.category))].map((f) => (
          <button
            className={f === filter ? "active" : ""}
            aria-pressed={f === filter}
            onClick={() => setFilter(f)}
            key={f}
          >
            {copy(f)}
          </button>
        ))}
      </div>
      <div className="gallery-grid">
        {works
          .filter((w) => filter === "全部灵感" || w.category === filter)
          .map((w) => (
            <button
              className="gallery-item"
              key={w.title}
              onClick={() => setSelected(w)}
            >
              <div className="image-wrap">
                <img src={w.image} alt={copy(w.title)} loading="lazy" />
                <span className="gallery-plus">
                  <Plus size={22} />
                </span>
              </div>
              <div>
                <h2>{copy(w.title)}</h2>
                <span>{copy(w.en)}</span>
              </div>
            </button>
          ))}
      </div>
      <p className="image-disclaimer">
        {copy(
          "本画廊为风格灵感参考，图片来自 Unsplash，并非壹梵真实客片。正式作品将在取得授权后更新。",
        )}
      </p>
      {selected && (
        <Modal
          wide
          title={copy(selected.title)}
          onClose={() => setSelected(null)}
        >
          <img
            className="lightbox-image"
            src={selected.image}
            alt={copy(selected.title)}
          />
          <span className="eyebrow">{copy(selected.en)}</span>
          <p>{copy(selected.text)}</p>
          <p className="subtle-note">{copy("风格示意 · 非品牌客片")}</p>
          <Link
            className="button"
            to="/services"
            onClick={() => setSelected(null)}
          >
            {copy("预约我的风格")}
            <Arrow />
          </Link>
        </Modal>
      )}
    </div>
  );
}
