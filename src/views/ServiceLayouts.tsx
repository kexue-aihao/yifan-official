import { Check, Clock3 } from "lucide-vue-next";
import { AnimatePresence, motion } from "motion-v";
import { defineComponent, Fragment } from "vue";
import { Arrow } from "../components";
import { useCopy, useFormatting } from "../i18n";
import type { Service } from "../lib";
import { SiteImage } from "../MediaProvider";
import { flowEase, layoutFlow, useMotionPreference } from "../motion";
import { useTheme } from "../ThemeProvider";
const ServiceLayouts = defineComponent(
  (props: {
    services: Service[];
    book: (s: Service) => void;
    enabled: boolean;
  }) => {
    const appearance = useTheme();
    const copy = useCopy();
    const { money } = useFormatting();
    const reduced = useMotionPreference();
    const cardMotion = (index: number) => ({
      layout: reduced.value ? (false as const) : ("position" as const),
      initial: reduced.value ? (false as const) : { opacity: 0, y: 12 },
      whileInView: { opacity: 1, y: 0, scale: 1 },
      viewport: { once: true, amount: 0.08 },
      exit: {
        opacity: 0,
        scale: reduced.value ? 1 : 0.98,
        transition: { duration: reduced.value ? 0 : 0.16 },
      },
      transition: {
        duration: reduced.value ? 0 : 0.34,
        delay: reduced.value ? 0 : Math.min(index * 0.025, 0.09),
        ease: flowEase,
        layout: reduced.value ? { duration: 0 } : layoutFlow,
      },
    });
    const image = (s: Service) => (
      <div class="image-wrap" key="image">
        <SiteImage
          src={s.image}
          alt={copy("{v0}风格示意", { v0: s.title })}
          loading="lazy"
        />
        {s.featured && <span class="package-badge">{copy("壹梵精选")}</span>}
      </div>
    );
    const heading = (s: Service) => (
      <Fragment key="heading">
        <span class="eyebrow">{s.english}</span>
        <h2>{s.title}</h2>
        <p class="package-description">{s.description}</p>
      </Fragment>
    );
    const features = (s: Service) => (
      <ul class="feature-list" key="features">
        {s.features.map((f) => (
          <li key={f}>
            <Check size={15} />
            {f}
          </li>
        ))}
      </ul>
    );
    const price = (s: Service) => (
      <div class="package-price" key="price">
        <strong>{money(s.price)}</strong>
        <span>{copy("套餐参考价")}</span>
        <span class="duration">
          <Clock3 size={14} />
          {s.duration}
        </span>
      </div>
    );
    const action = (s: Service) => (
      <div class="package-action" key="action">
        <button
          class="button full"
          onClick={() => props.book(s)}
          disabled={!props.enabled}
        >
          {copy("预约专属体验")}
          <Arrow />
        </button>
        <p class="deposit-note">
          {copy("预约订金 ¥{v0} · 抵扣套餐费用", { v0: money(s.deposit) })}
        </p>
      </div>
    );
    return () => {
      if (appearance.theme === "sage")
        return (
          <div class="studio-service-list" data-layout="service-directory">
            <AnimatePresence mode="popLayout">
              {props.services.map((s, i) => (
                <motion.article
                  {...cardMotion(i)}
                  class="package-card studio-service"
                  key={s.id}
                >
                  <span class="service-number" key="number">
                    0{i + 1}
                  </span>
                  {image(s)}
                  <div class="package-content" key="content">
                    {heading(s)}
                    {features(s)}
                  </div>
                  <div class="service-booking-column" key="booking">
                    {price(s)}
                    {action(s)}
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        );
      if (appearance.theme === "noir")
        return (
          <div class="couture-service-list" data-layout="service-lookbook">
            <AnimatePresence mode="popLayout">
              {props.services.map((s, i) => (
                <motion.article
                  {...cardMotion(i)}
                  class="package-card couture-service"
                  key={s.id}
                >
                  <header key="header">
                    <span>COLLECTION / 0{i + 1}</span>
                    <span>{s.english}</span>
                  </header>
                  <div class="couture-service-spread" key="spread">
                    {image(s)}
                    <div class="package-content">
                      <span class="service-number">0{i + 1}</span>
                      {heading(s)}
                      {features(s)}
                      {price(s)}
                      {action(s)}
                    </div>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        );
      if (appearance.theme === "rose")
        return (
          <div class="romance-service-list" data-layout="service-chapters">
            <AnimatePresence mode="popLayout">
              {props.services.map((s, i) => (
                <motion.article
                  {...cardMotion(i)}
                  class="package-card romance-service"
                  key={s.id}
                >
                  <div class="romance-service-photo" key="photo">
                    <span class="service-number">CHAPTER 0{i + 1}</span>
                    {image(s)}
                  </div>
                  <div class="package-content" key="content">
                    {heading(s)}
                    {price(s)}
                    {features(s)}
                    {action(s)}
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        );
      return (
        <div class="packages-grid" data-layout="service-cards">
          <AnimatePresence mode="popLayout">
            {props.services.map((s, i) => (
              <motion.article
                {...cardMotion(i)}
                class="package-card"
                key={s.id}
              >
                {image(s)}
                <div class="package-content" key="content">
                  {heading(s)}
                  {price(s)}
                  {features(s)}
                  {action(s)}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      );
    };
  },
  { name: "ServiceLayouts", props: ["services", "book", "enabled"] },
);
export default ServiceLayouts;
