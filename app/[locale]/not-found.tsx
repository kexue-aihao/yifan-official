import { getTranslations } from "next-intl/server";
import { Link } from "../../i18n/navigation";
import sourceMap from "../../i18n/source-map.json";
export default async function NotFound() {
  const t = await getTranslations("copy");
  return (
    <main className="page container">
      <h1>{t(sourceMap["这一页，暂未定格。"])}</h1>
      <Link className="button" href="/">
        {t(sourceMap["回到首页"])}
      </Link>
    </main>
  );
}
