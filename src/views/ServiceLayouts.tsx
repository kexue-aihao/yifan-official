"use client";
import {SiteImage} from '../MediaProvider';
import { Check, Clock3 } from "lucide-react";
import { useCopy, useFormatting } from "../i18n";
import { useTheme } from "../ThemeProvider";
import type { Service } from "../lib";
import { Arrow } from "../components";

export default function ServiceLayouts({
  services,
  book,
  enabled,
}: {
  services: Service[];
  book: (s: Service) => void;
  enabled: boolean;
}) {
  const { theme } = useTheme();
  const copy = useCopy();
  const { money } = useFormatting();
  const image = (s: Service) => (
    <div className="image-wrap">
      <SiteImage
        src={s.image}
        alt={copy("{v0}风格示意", { v0: s.title })}
        loading="lazy"
      />
      {s.featured && <span className="package-badge">{copy("壹梵精选")}</span>}
    </div>
  );
  const heading = (s: Service) => (
    <>
      <span className="eyebrow">{s.english}</span>
      <h2>{s.title}</h2>
      <p className="package-description">{s.description}</p>
    </>
  );
  const features = (s: Service) => (
    <ul className="feature-list">
      {s.features.map((f) => (
        <li key={f}>
          <Check size={15} />
          {f}
        </li>
      ))}
    </ul>
  );
  const price = (s: Service) => (
    <div className="package-price">
      <strong>{money(s.price)}</strong>
      <span>{copy("套餐参考价")}</span>
      <span className="duration">
        <Clock3 size={14} />
        {s.duration}
      </span>
    </div>
  );
  const action = (s: Service) => (
    <div className="package-action">
      <button
        className="button full"
        onClick={() => book(s)}
        disabled={!enabled}
      >
        {copy("预约专属体验")}
        <Arrow />
      </button>
      <p className="deposit-note">
        {copy("预约订金 ¥{v0} · 抵扣套餐费用", { v0: money(s.deposit) })}
      </p>
    </div>
  );
  if (theme === "sage")
    return (
      <div className="studio-service-list" data-layout="service-directory">
        {services.map((s, i) => (
          <article className="package-card studio-service" key={s.id}>
            <span className="service-number">0{i + 1}</span>
            {image(s)}
            <div className="package-content">
              {heading(s)}
              {features(s)}
            </div>
            <div className="service-booking-column">
              {price(s)}
              {action(s)}
            </div>
          </article>
        ))}
      </div>
    );
  if (theme === "noir")
    return (
      <div className="couture-service-list" data-layout="service-lookbook">
        {services.map((s, i) => (
          <article className="package-card couture-service" key={s.id}>
            <header>
              <span>COLLECTION / 0{i + 1}</span>
              <span>{s.english}</span>
            </header>
            <div className="couture-service-spread">
              {image(s)}
              <div className="package-content">
                <span className="service-number">0{i + 1}</span>
                {heading(s)}
                {features(s)}
                {price(s)}
                {action(s)}
              </div>
            </div>
          </article>
        ))}
      </div>
    );
  if (theme === "rose")
    return (
      <div className="romance-service-list" data-layout="service-chapters">
        {services.map((s, i) => (
          <article className="package-card romance-service" key={s.id}>
            <div className="romance-service-photo">
              <span className="service-number">CHAPTER 0{i + 1}</span>
              {image(s)}
            </div>
            <div className="package-content">
              {heading(s)}
              {price(s)}
              {features(s)}
              {action(s)}
            </div>
          </article>
        ))}
      </div>
    );
  return (
    <div className="packages-grid" data-layout="service-cards">
      {services.map((s) => (
        <article className="package-card" key={s.id}>
          {image(s)}
          <div className="package-content">
            {heading(s)}
            {price(s)}
            {features(s)}
            {action(s)}
          </div>
        </article>
      ))}
    </div>
  );
}
