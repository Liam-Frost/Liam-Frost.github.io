import type { LocalizedString } from "../lib/i18n";

type L = Partial<LocalizedString>;

export const site = {
  name: "Liam Frost",
  nameLatin: "Liam Frost",

  email: "frostnova986@gmail.com",

  role: {
    zh: "全栈工程师 | 摄影爱好者 | 音乐爱好者",
    "zh-Hant": "全棧工程師 | 攝影愛好者 | 音樂愛好者",
    en: "Full-stack engineer | Photographer | Music lover",
    fr: "Ingénieur full-stack | Photographe | Passionné de musique",
    ja: "フルスタックエンジニア | フォトグラファー | 音楽好き"
  } satisfies L,

  location: {
    zh: "温哥华",
    "zh-Hant": "溫哥華",
    en: "Vancouver",
    fr: "Vancouver",
    ja: "バンクーバー"
  } satisfies L,

  bio: {
    zh: "我喜欢用镜头记录光影与城市的节奏，也喜欢用代码把故事做成可交互的网页体验。这个网站是我的个人主页与摄影作品集。",
    "zh-Hant": "我喜歡用鏡頭記錄光影與城市的節奏，也喜歡用代碼把故事做成可互動的網頁體驗。這個網站是我的個人主頁與攝影作品集。",
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

  spotify: {
    tracks: [
      {
        url: "https://open.spotify.com/track/2BHj31ufdEqVK5CkYDp9mA?si=d9a81c1c28ed415d",
        title: "Mayonaka no Door / Stay With Me",
        artist: "Miki Matsubara",
        image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273d2d1c44c2767567810b051ef",
        link: "https://open.spotify.com/track/2BHj31ufdEqVK5CkYDp9mA",
        audio: "https://p.scdn.co/mp3-preview/af7fe78032f34791e4123006fd2d578797226aa2"
      },
      {
        url: "https://open.spotify.com/track/7rU6Iebxzlvqy5t857bKFq?si=31ef1bb15eec466a",
        title: "Plastic Love",
        artist: "Mariya Takeuchi",
        image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273d4740e0434aefcf13a748af8",
        link: "https://open.spotify.com/track/7rU6Iebxzlvqy5t857bKFq",
        audio: "https://p.scdn.co/mp3-preview/3a2c572a309635ce6ae0ee0cc8f26e9eaebfb640"
      },
      {
        url: "https://open.spotify.com/track/2p8IUWQDrpjuFltbdgLOag?si=081994f693d84565",
        title: "After Hours",
        artist: "The Weeknd",
        image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
        link: "https://open.spotify.com/track/2p8IUWQDrpjuFltbdgLOag",
        audio: "https://p.scdn.co/mp3-preview/2375bc6998d765b02b229ff44e5c3d7b75fff74a"
      }
    ]
  },

  stats: [
    { value: "40+", label: { zh: "作品", "zh-Hant": "作品", en: "Shots", fr: "Photos", ja: "作品" } satisfies L },
    { value: "5y", label: { zh: "经验", "zh-Hant": "經驗", en: "Years", fr: "Années", ja: "年" } satisfies L },
    { value: "∞", label: { zh: "灵感", "zh-Hant": "靈感", en: "Ideas", fr: "Idées", ja: "インスピ" } satisfies L }
  ],

  gear: [
    { key: { zh: "相机", "zh-Hant": "相機", en: "Camera", fr: "Caméra", ja: "カメラ" } satisfies L, value: "Canon R5 | Canon 80D | DJI Action 6 | iPhone 16 Pro Max" },
    {
      key: { zh: "镜头", "zh-Hant": "鏡頭", en: "Lens", fr: "Objectif", ja: "レンズ" } satisfies L,
      value: "RF 24mm f/1.4 L VSM | RF 70-200mm f/2.8 L IS USM | EF-S 18-200mm f/3.5-5.6 IS"
    },
    {
      key: { zh: "后期", "zh-Hant": "後期", en: "Editing", fr: "Retouche", ja: "編集" } satisfies L,
      value: "Adobe Lightroom | Adobe Photoshop | DaVinci Resolve"
    }
  ]
} as const;
