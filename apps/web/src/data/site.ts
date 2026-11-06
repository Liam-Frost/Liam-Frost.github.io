import type { SpotifyTrack } from "@liam-frost/shared";

import type { LocalizedString } from "../lib/i18n";

type L = Partial<LocalizedString>;

export const site = {
  name: "Liam Frost",
  nameLatin: "Liam Frost",

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
    "zh-Hant":
      "我喜歡用鏡頭記錄光影與城市的節奏，也喜歡用代碼把故事做成可互動的網頁體驗。這個網站是我的個人主頁與攝影作品集。",
    en: "I capture light and rhythm in everyday life, and I build interactive web experiences. This site is my personal homepage and photo portfolio.",
    fr: "J'aime capturer la lumière et le rythme du quotidien, et créer des expériences web interactives. Ce site est ma page personnelle et mon portfolio photo.",
    ja: "光と街のリズムを写真に残しつつ、コードでインタラクティブな体験を作っています。このサイトは個人ページ兼フォトポートフォリオです。"
  } satisfies L,

  /** Fallback tracks for static builds; the API serves the playlist configured in the admin. */
  spotify: {
    tracks: [
      {
        id: "2BHj31ufdEqVK5CkYDp9mA",
        title: "Mayonaka no Door / Stay With Me",
        artist: "Miki Matsubara",
        image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273d2d1c44c2767567810b051ef",
        link: "https://open.spotify.com/track/2BHj31ufdEqVK5CkYDp9mA",
        previewUrl: "https://p.scdn.co/mp3-preview/af7fe78032f34791e4123006fd2d578797226aa2"
      },
      {
        id: "7rU6Iebxzlvqy5t857bKFq",
        title: "Plastic Love",
        artist: "Mariya Takeuchi",
        image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273d4740e0434aefcf13a748af8",
        link: "https://open.spotify.com/track/7rU6Iebxzlvqy5t857bKFq",
        previewUrl: "https://p.scdn.co/mp3-preview/3a2c572a309635ce6ae0ee0cc8f26e9eaebfb640"
      },
      {
        id: "2p8IUWQDrpjuFltbdgLOag",
        title: "After Hours",
        artist: "The Weeknd",
        image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
        link: "https://open.spotify.com/track/2p8IUWQDrpjuFltbdgLOag",
        previewUrl: "https://p.scdn.co/mp3-preview/2375bc6998d765b02b229ff44e5c3d7b75fff74a"
      }
    ] satisfies SpotifyTrack[]
  }
} as const;
