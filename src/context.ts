import type { ThemeId } from "./themes";
import type { ImageMap } from "./MediaProvider";

export type InitialState = {
  locale: string;
  siteTheme: ThemeId;
  preference: ThemeId | null;
  images: ImageMap;
  messages: Record<string, Record<string, string>>;
};
