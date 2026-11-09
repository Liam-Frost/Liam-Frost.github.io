/** The icons a contact link can use instead of its text: one monochrome set, drawn by the site. */
export const CONTACT_ICONS = [
  "github",
  "instagram",
  "linkedin",
  "x",
  "youtube",
  "telegram",
  "bluesky",
  "discord",
  "bilibili",
  "weibo",
  "xiaohongshu"
] as const;
export type ContactIconName = (typeof CONTACT_ICONS)[number];

export type ContactContent = {
  email: string;
  /** Without `icon` the link shows its label; with one, the label names the icon for screen readers. */
  links: { label: string; href: string; icon?: ContactIconName }[];
};

export type AdminContactResponse = { contact: ContactContent; revision: string };

export const DEFAULT_CONTACT: ContactContent = {
  email: "frostnova986@gmail.com",
  links: [
    { label: "Instagram", href: "https://www.instagram.com/los_frost_lava/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/shanhaoliu/" },
    { label: "GitHub", href: "https://github.com/Liam-Frost" }
  ]
};
