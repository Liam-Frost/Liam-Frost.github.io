import { useCallback } from "react";
import { genreLabel, type LocalizedText } from "@liam-frost/shared";
import { useSiteSettings } from "../data/useSiteSettings";
export function useGenreLabel() {
  const settings = useSiteSettings();
  return useCallback(
    (value: LocalizedText, lang: string) => {
      const explicit = value[lang as keyof LocalizedText]?.trim();
      if (explicit) return explicit;
      const normalize = (v: string) => v.normalize("NFKC").trim().toLowerCase();
      const aliases = Object.values(value)
        .filter((v): v is string => Boolean(v))
        .map(normalize);
      const entry = settings?.dictionary.entries.find((e) =>
        e.aliases.some((a) => aliases.includes(normalize(a)))
      );
      return entry
        ? entry.labels[lang as keyof LocalizedText] || entry.labels.en || entry.aliases[0]
        : genreLabel(value, lang);
    },
    [settings]
  );
}
