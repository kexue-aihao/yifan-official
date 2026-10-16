export const themes = [
  {
    id: "ivory",
    name: "象牙香槟",
    mood: "如婚纱缎面，温润而隽永。",
    edition: "IVORY ATELIER",
    color: "#f8f6f0",
  },
  {
    id: "rose",
    name: "玫瑰雾粉",
    mood: "一抹玫瑰，珍藏浪漫时刻。",
    edition: "ROSE ROMANCE",
    color: "#fcf6f6",
  },
  {
    id: "sage",
    name: "翡翠雅绿",
    mood: "自然光影，自在记录每一种你。",
    edition: "BOTANICAL MUSE",
    color: "#f3f6f1",
  },
  {
    id: "noir",
    name: "午夜鎏金",
    mood: "深邃幕色，让主角成为焦点。",
    edition: "NOIR COUTURE",
    color: "#171a1b",
  },
] as const;

export type ThemeId = (typeof themes)[number]["id"];
export const defaultTheme: ThemeId = "ivory";
export const themeCookie = "YF_THEME";
export function isTheme(value: unknown): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}
