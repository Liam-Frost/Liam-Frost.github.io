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
export type SiteLogo = { text: string; photoId: string | null };
export type PresentationSettings = {
  sections: Record<HomeSection, boolean>;
  publicLogo: SiteLogo;
  adminLogo: SiteLogo;
  loginBackground: {
    mode: "none" | "fixed" | "rotate";
    photoIds: string[];
    intervalSeconds: number;
  };
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
  publicLogo: { text: "", photoId: null },
  adminLogo: { text: "", photoId: null },
  loginBackground: { mode: "none", photoIds: [], intervalSeconds: 30 }
};
export type PublicPresentation = PresentationSettings & {
  images: Record<string, string>;
  logoImages: Record<string, string>;
};
export type AdminPresentation = { settings: PresentationSettings; revision: string };
