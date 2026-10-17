import { defineComponent, type VNodeChild } from "vue";
import { useTranslations } from "./i18n";
import { Link } from "./routing";
const ConsentText = defineComponent(
  () => {
    const t = useTranslations("common");
    return () => (
      <span>
        {t.rich("consent", {
          privacy: (text: VNodeChild) => (
            <Link to="/privacy" target="_blank">
              {text}
            </Link>
          ),
          terms: (text: VNodeChild) => (
            <Link to="/terms" target="_blank">
              {text}
            </Link>
          ),
        })}
      </span>
    );
  },
  { name: "ConsentText", props: [] },
);
export default ConsentText;
