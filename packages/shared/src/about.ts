import type { LocalizedText } from "./api";
import { ROTATION_MODES, type RotationMode } from "./rotation";

/** How the about section chooses among the visible manifestos (see RotationMode). */
export const MANIFESTO_ROTATION_MODES = ROTATION_MODES;
export type ManifestoRotationMode = RotationMode;

export type ManifestoRotation = { mode: ManifestoRotationMode; fixedId: string | null };

/** A line for the about section. In `text`, `*…*` marks the words shown in the accent colour. */
export type AboutManifesto = {
  id: string;
  text: LocalizedText;
  /** Who said it, when it is a quotation; empty for the site owner's own words. */
  attribution: LocalizedText;
  visible: boolean;
  /** Relative selection weight; omitted legacy values mean 1. Fixed mode ignores it. */
  weight?: number;
};

export type AboutGearItem = { id: string; name: string; visible: boolean };

export type AboutGearCategory = {
  id: string;
  name: LocalizedText;
  visible: boolean;
  items: AboutGearItem[];
};

/** The about section's content as the admin edits it, in display order. */
export type AboutContent = {
  manifestos: AboutManifesto[];
  rotation: ManifestoRotation;
  gear: AboutGearCategory[];
};

/**
 * GET /api/about: visible manifestos and gear only (a category without a visible item is left out);
 * the site picks the manifesto by `rotation`, whose fixedId is always one of the listed manifestos.
 */
export type PublicAbout = {
  manifestos: Omit<AboutManifesto, "visible">[];
  rotation: ManifestoRotation;
  gear: { id: string; name: LocalizedText; items: { id: string; name: string }[] }[];
};

/**
 * GET and PUT /api/admin/about. `revision` identifies the saved content; a save sends the revision it
 * started from and is refused (409) when someone saved in between. `saved` is false until the first
 * save: the defaults are shown until then.
 */
export type AdminAboutResponse = { about: AboutContent; revision: string; saved: boolean };
export type AdminAboutUpdate = { about: AboutContent; revision: string };

export const ABOUT_LIMITS = {
  manifestos: 50,
  manifestoText: 300,
  attribution: 80,
  gearCategories: 20,
  gearItems: 60,
  gearCategoryName: 40,
  gearItemName: 120
} as const;

/** The content before the first save, and the site's fallback without the API. */
export const DEFAULT_ABOUT: AboutContent = {
  manifestos: [
    {
      id: "churchill-change",
      text: {
        en: "To improve is to change; to be perfect is to *change often*.",
        zh: "变则善，*常变则至善*。",
        "zh-Hant": "變則善，*常變則至善*。",
        fr: "S’améliorer, c’est changer ; être parfait, c’est *changer souvent*.",
        ja: "向上とは変化であり、完璧とは*頻繁に変化すること*だ。"
      },
      attribution: {
        en: "Winston Churchill",
        zh: "温斯顿·丘吉尔",
        "zh-Hant": "溫斯頓·邱吉爾",
        fr: "Winston Churchill",
        ja: "ウィンストン・チャーチル"
      },
      visible: true
    }
  ],
  rotation: { mode: "fixed", fixedId: "churchill-change" },
  gear: [
    {
      id: "camera",
      name: { zh: "相机", "zh-Hant": "相機", en: "Camera", fr: "Caméra", ja: "カメラ" },
      visible: true,
      items: ["Canon R5", "Canon 80D", "DJI Action 6", "iPhone 16 Pro Max"].map((name, i) => ({
        id: `camera-${i + 1}`,
        name,
        visible: true
      }))
    },
    {
      id: "lens",
      name: { zh: "镜头", "zh-Hant": "鏡頭", en: "Lens", fr: "Objectif", ja: "レンズ" },
      visible: true,
      items: [
        "RF 24mm f/1.4 L VSM",
        "RF 70-200mm f/2.8 L IS USM",
        "EF-S 18-200mm f/3.5-5.6 IS"
      ].map((name, i) => ({ id: `lens-${i + 1}`, name, visible: true }))
    },
    {
      id: "editing",
      name: { zh: "后期", "zh-Hant": "後期", en: "Editing", fr: "Retouche", ja: "編集" },
      visible: true,
      items: ["Adobe Lightroom", "Adobe Photoshop", "DaVinci Resolve"].map((name, i) => ({
        id: `editing-${i + 1}`,
        name,
        visible: true
      }))
    }
  ]
};

/** The public view of the content: hidden manifestos and gear dropped, a usable fixedId. */
export function toPublicAbout(about: AboutContent): PublicAbout {
  const manifestos = about.manifestos
    .filter((m) => m.visible)
    .map(({ id, text, attribution, weight }) => ({ id, text, attribution, weight: weight ?? 1 }));
  const fixedId = manifestos.some((m) => m.id === about.rotation.fixedId)
    ? about.rotation.fixedId
    : (manifestos[0]?.id ?? null);
  return {
    manifestos,
    rotation: { mode: about.rotation.mode, fixedId },
    gear: about.gear
      .filter((c) => c.visible)
      .map((c) => ({
        id: c.id,
        name: c.name,
        items: c.items.filter((i) => i.visible).map(({ id, name }) => ({ id, name }))
      }))
      .filter((c) => c.items.length > 0)
  };
}

/** Splits `*…*` emphasis into plain and emphasised parts; an unmatched `*` stays as text. */
export function splitEmphasis(text: string) {
  return text
    .split(/(\*[^*\n]+\*)/)
    .filter(Boolean)
    .map((part) =>
      part.length > 2 && part.startsWith("*") && part.endsWith("*")
        ? { text: part.slice(1, -1), em: true }
        : { text: part, em: false }
    );
}
