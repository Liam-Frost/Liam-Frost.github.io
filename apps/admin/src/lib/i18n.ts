import { LANGS, type Lang, type LocalizedText } from "@liam-frost/shared";

export { LANGS, type Lang };

export const LANG_LABELS: Record<Lang, string> = {
  zh: "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  fr: "Français",
  ja: "日本語"
};

/** First non-empty text, preferring Simplified Chinese then English, like the public site's fallback. */
export function pickText(value: LocalizedText | null | undefined, fallback = "") {
  if (!value) return fallback;
  return value.zh || value.en || LANGS.map((lang) => value[lang]).find(Boolean) || fallback;
}
