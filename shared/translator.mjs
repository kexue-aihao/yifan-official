import { IntlMessageFormat } from "intl-messageformat";

// Keep the existing ICU dictionaries, including plural rules and rich links.
export function createTranslator({ locale, messages, namespace }) {
  const cache = new Map();
  const translate = (key, values) => {
    const path = namespace ? `${namespace}.${key}` : key;
    const source = path
      .split(".")
      .reduce((value, part) => value?.[part], messages);
    if (typeof source !== "string") return key;
    let message = cache.get(path);
    if (!message) {
      message = new IntlMessageFormat(source, locale);
      cache.set(path, message);
    }
    return message.format(values);
  };
  translate.rich = translate;
  return translate;
}
