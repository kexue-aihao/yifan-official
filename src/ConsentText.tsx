"use client";
import { useTranslations } from "next-intl";
import { Link } from "./routing";
export default function ConsentText() {
  const t = useTranslations("common");
  return (
    <span>
      {t.rich("consent", {
        privacy: (text) => (
          <Link to="/privacy" target="_blank">
            {text}
          </Link>
        ),
        terms: (text) => (
          <Link to="/terms" target="_blank">
            {text}
          </Link>
        ),
      })}
    </span>
  );
}
