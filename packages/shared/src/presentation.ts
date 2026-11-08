import type { RotationMode } from "./rotation";

export const HOME_SECTIONS = [
  "top",
  "about",
  "skills",
  "projects",
  "watching",
  "featured",
  "contact"
] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];
/** The uploaded images: front-end logo, admin logo, the icon used by both, and the home avatar. */
export const BRAND_SLOTS = ["publicLogo", "adminLogo", "favicon", "avatar"] as const;
export type BrandSlot = (typeof BRAND_SLOTS)[number];
/** The current image address in each slot; null means the default. */
export type AdminBranding = Record<BrandSlot, string | null>;

/** Text and description of a logo; the image itself is uploaded separately. */
export type SiteLogo = { text: string; alt?: string };
export type PresentationSettings = {
  sections: Record<HomeSection, boolean>;
  publicLogo: SiteLogo;
  adminLogo: SiteLogo;
  /** How the login page chooses among the photos (fixed: the first). No photos: a plain background. */
  loginBackground: { mode: RotationMode; photoIds: string[] };
};
export const DEFAULT_PRESENTATION: PresentationSettings = {
  sections: {
    top: true,
    about: true,
    skills: true,
    projects: true,
    watching: true,
    featured: true,
    contact: true
  },
  publicLogo: { text: "" },
  adminLogo: { text: "" },
  loginBackground: { mode: "fixed", photoIds: [] }
};
export type PublicPresentation = PresentationSettings & {
  images: Record<string, string>;
  logoUrls: Record<"publicLogo" | "adminLogo", string | null>;
};
export type AdminPresentation = { settings: PresentationSettings; revision: string };
