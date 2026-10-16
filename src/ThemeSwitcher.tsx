"use client";
import {SiteImage} from './MediaProvider';
import { useState } from "react";
import { Check, Palette, RotateCcw } from "lucide-react";
import { Modal } from "./components";
import { useCopy } from "./i18n";
import { useTheme } from "./ThemeProvider";
import { themes, type ThemeId } from "./themes";

export function ThemeChoices({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}) {
  const copy = useCopy();
  return (
    <div className="theme-choices" role="group" aria-label={copy("主题方案")}>
      {themes.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className="theme-choice"
          data-palette={theme.id}
          aria-label={copy(theme.name)}
          aria-pressed={value === theme.id}
          onClick={() => onChange(theme.id)}
        >
          <span className="theme-preview" aria-hidden="true">
            <span className="theme-preview-top">
              <span>YI FAN</span>
              <span>— &nbsp; — &nbsp; —</span>
            </span>
            <span className={`theme-preview-composition preview-${theme.id}`}>
              {theme.id === "ivory" ? (
                <>
                  <SiteImage src="/images/wedding.jpg" alt="" loading="lazy" />
                  <span>
                    Yours,
                    <br />
                    <i>always.</i>
                  </span>
                </>
              ) : theme.id === "rose" ? (
                <>
                  <SiteImage src="/images/wedding.jpg" alt="" loading="lazy" />
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
                  <SiteImage src="/images/portrait.jpg" alt="" loading="lazy" />
                </>
              ) : (
                <>
                  <strong>YI FAN</strong>
                  <span>
                    BE THE
                    <br />
                    <i>MUSE.</i>
                  </span>
                  <SiteImage src="/images/wedding.jpg" alt="" loading="lazy" />
                  <SiteImage src="/images/beauty.jpg" alt="" loading="lazy" />
                </>
              )}
            </span>
            <span className="theme-preview-foot">
              <span className="theme-swatches">
                <i />
                <i />
                <i />
              </span>
              <span>YF</span>
            </span>
            {value === theme.id && (
              <span className="theme-selected">
                <Check size={15} />
              </span>
            )}
          </span>
          <span className="theme-choice-name">{copy(theme.name)}</span>
          <span className="theme-choice-edition" lang="en">
            {theme.edition}
          </span>
          <span className="theme-choice-mood">{copy(theme.mood)}</span>
        </button>
      ))}
    </div>
  );
}

export default function ThemeSwitcher() {
  const copy = useCopy();
  const { theme, preferred, siteTheme, choose } = useTheme();
  const [open, setOpen] = useState(false);
  const current = themes.find((t) => t.id === theme)!;
  return (
    <>
      <button
        className="theme-toggle icon-button"
        type="button"
        onClick={() => setOpen(true)}
        aria-label={copy("切换主题")}
        aria-haspopup="dialog"
        title={copy(current.name)}
      >
        <Palette size={18} aria-hidden="true" />
        <span>{copy("主题")}</span>
      </button>
      {open && (
        <Modal
          title={copy("选择你的壹梵主题")}
          wide
          onClose={() => setOpen(false)}
        >
          <div className="theme-studio">
            <p className="theme-intro">
              {copy("四种独立排版：电影叙事、浪漫拼贴、自然工作室与时装画册。")}
            </p>
            <ThemeChoices value={theme} onChange={choose} />
            <div className="theme-studio-footer">
              <button
                className="text-button"
                type="button"
                onClick={() => choose(null)}
                aria-pressed={!preferred}
              >
                <RotateCcw size={15} />
                {copy("跟随品牌默认")}
                <span className="theme-default-name">
                  {copy(themes.find((t) => t.id === siteTheme)!.name)}
                </span>
              </button>
              <button
                className="button small"
                type="button"
                onClick={() => setOpen(false)}
              >
                {copy("完成")}
              </button>
            </div>
            <p className="theme-saved" role="status">
              {copy("当前主题：{v0}", { v0: copy(current.name) })} ·{" "}
              {copy("偏好将保存在此浏览器")}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
