import type { LocalizedString } from "../lib/i18n";

type L = Partial<LocalizedString>;

export const site = {
  name: "Liam Frost",
  nameLatin: "Liam Frost",

  email: "frostnova986@gmail.com",

  role: {
    zh: "全栈工程师 / 摄影爱好者 / 音乐爱好者",
    en: "Full-stack engineer / Photographer / Music lover",
    fr: "Ingénieur full-stack / Photographe / Passionné de musique",
    ja: "フルスタックエンジニア / フォトグラファー / 音楽好き"
  } satisfies L,

  location: {
    zh: "温哥华",
    en: "Vancouver",
    fr: "Vancouver",
    ja: "バンクーバー"
  } satisfies L,

  bio: {
    zh: "我喜欢用镜头记录光影与城市的节奏，也喜欢用代码把故事做成可交互的网页体验。这个网站是我的个人主页与摄影作品集。",
    en: "I capture light and rhythm in everyday life, and I build interactive web experiences. This site is my personal homepage and photo portfolio.",
    fr: "J'aime capturer la lumière et le rythme du quotidien, et créer des expériences web interactives. Ce site est ma page personnelle et mon portfolio photo.",
    ja: "光と街のリズムを写真に残しつつ、コードでインタラクティブな体験を作っています。このサイトは個人ページ兼フォトポートフォリオです。"
  } satisfies L,

  socials: [
    { label: "Instagram", href: "https://www.instagram.com/los_frost_lava/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/shanhaoliu/" },
    { label: "GitHub", href: "https://github.com/Liam-Frost" },
    { label: "Blog", href: "#" }
  ],

  stats: [
    { value: "23+", label: { zh: "作品", en: "Shots", fr: "Photos", ja: "作品" } satisfies L },
    { value: "5y", label: { zh: "经验", en: "Years", fr: "Années", ja: "年" } satisfies L },
    { value: "∞", label: { zh: "灵感", en: "Ideas", fr: "Idées", ja: "インスピ" } satisfies L }
  ],

  gear: [
    { key: { zh: "相机", en: "Camera", fr: "Caméra", ja: "カメラ" } satisfies L, value: "Canon / DJI Action 6 / iPhone 16 Pro Max" },
    {
      key: { zh: "镜头", en: "Lens", fr: "Objectif", ja: "レンズ" } satisfies L,
      value: "RF 24mm f1.4 L VSM / RF 70-200mm f2.8 L IS USM"
    },
    {
      key: { zh: "后期", en: "Editing", fr: "Retouche", ja: "編集" } satisfies L,
      value: "Adobe Lightroom / Photoshop"
    }
  ]
} as const;
