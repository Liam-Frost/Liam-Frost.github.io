export type ContactContent = {
  email: string;
  links: { label: string; href: string }[];
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
