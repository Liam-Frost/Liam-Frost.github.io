import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "zh" | "en" | "fr" | "ja";

export type LocalizedString = Record<Lang, string>;

export function pickLocalized(value: Partial<LocalizedString> | undefined, lang: Lang) {
  if (!value) return "";
  return value[lang] ?? value.en ?? value.zh ?? value.fr ?? value.ja ?? "";
}

const zh = {
  // Common
  "common.skipToContent": "跳到主要内容",
  "common.theme": "主题",
  "common.language": "语言",
  "common.reset": "重置",
  "common.close": "关闭",
  "common.backToTop": "回到顶部",

  // Nav
  "nav.home": "主页",
  "nav.portfolio": "作品集",
  "nav.about": "关于",
  "nav.skills": "技术栈",
  "nav.contact": "联系",
  "nav.openMenu": "打开菜单",
  "nav.closeMenu": "关闭菜单",

  // Theme
  "theme.system": "系统",
  "theme.light": "浅色",
  "theme.dark": "深色",

  // Home
  "home.eyebrow": "PERSONAL + PHOTO PORTFOLIO",
  "home.title": "你好，我是 {name}",
  "home.cta.portfolio": "查看作品集",
  "home.cta.contact": "联系我",

  // About
  "about.title": "关于我",
  "about.subtitle": "我关注视觉叙事、交互细节与性能体验。",

  "about.card.left": "能力与方法",
  "about.card.right": "设备",

  "about.section.capabilities": "Capabilities",
  "about.section.focus": "Focus",
  "about.section.tooling": "Tooling",
  "about.section.workflow": "Workflow",
  "about.section.gear": "Gear",
  "about.section.output": "Output",

  "about.capabilities.b1": "组件化与设计系统：一致性、可维护性",
  "about.capabilities.b2": "性能与可访问性：让体验更快、更稳",
  "about.capabilities.b3": "动效与交互语义：克制但有层次",

  "about.focus.body": "把前端、后端与摄影视为同一件事：用清晰的结构、稳定的系统和可延展的叙事，把复杂内容组织成可被理解、浏览并长期演进的体验。",

  // Skills
  "skills.title": "技术栈",
  "skills.subtitle": "结构化展示能力分组与层级。",
  "skills.filterAll": "显示全部",

  "skills.group.frontend": "Frontend",
  "skills.group.backend": "Backend",
  "skills.group.creative": "Creative",

  "skills.groupDesc.frontend": "前端工程与现代 Web 交付。",
  "skills.groupDesc.backend": "后端工程与性能和可靠性。",
  "skills.groupDesc.creative": "设计工具与视觉 / 动效能力。",

  // Featured
  "featured.title": "精选照片",
  "featured.subtitle": "点击打开灯箱查看详情；支持键盘导航。",
  "featured.cta.all": "查看全部作品",
  "featured.cta.contact": "合作 / 约拍",

  // Contact
  "contact.title": "联系我",
  "contact.subtitle": "适合工作机会、合作、约拍与交流。",
  "contact.lead": "让我们聊聊",
  "contact.message": "有合作想法？欢迎直接来信。",
  "contact.elsewhere": "也可以在以下平台找到我：",
  "contact.copy": "复制邮箱",
  "contact.copied": "已复制邮箱到剪贴板",
  "contact.copyFailed": "复制失败，请手动复制邮箱",

  // Portfolio
  "portfolio.title": "摄影作品集",
  "portfolio.subtitle": "支持分类筛选、关键词搜索与瀑布流展示。",
  "portfolio.search": "搜索：标题 / 标签 / 地点",
  "portfolio.sort.new": "最新优先",
  "portfolio.sort.old": "最早优先",
  "portfolio.count": "共 {count} 张",

  // Photo
  "photo.open": "打开照片：{title}",
  "photo.close": "关闭",
  "photo.prev": "上一张",
  "photo.next": "下一张",
  "photo.hint": "键盘：Esc 关闭，←/→ 切换。",
  "photo.meta.location": "地点",
  "photo.meta.date": "日期",
  "photo.meta.camera": "相机",
  "photo.meta.lens": "镜头",
  "photo.meta.settings": "参数",

  // NotFound
  "notFound.title": "404",
  "notFound.subtitle": "这个页面不存在，可能被移动或删除了。",
  "notFound.home": "返回主页",
  "notFound.portfolio": "去作品集"
} as const;

type Key = keyof typeof zh;

const en: Record<Key, string> = {
  "common.skipToContent": "Skip to content",
  "common.theme": "Theme",
  "common.language": "Language",
  "common.reset": "Reset",
  "common.close": "Close",
  "common.backToTop": "Back to top",

  "nav.home": "Home",
  "nav.portfolio": "Gallery",
  "nav.about": "About",
  "nav.skills": "Stack",
  "nav.contact": "Contact",
  "nav.openMenu": "Open menu",
  "nav.closeMenu": "Close menu",

  "theme.system": "System",
  "theme.light": "Light",
  "theme.dark": "Dark",

  "home.eyebrow": "PERSONAL + PHOTO PORTFOLIO",
  "home.title": "Hi, I'm {name}",
  "home.cta.portfolio": "View gallery",
  "home.cta.contact": "Contact",

  "about.title": "About",
  "about.subtitle": "I care about visual storytelling, interaction details, and performance.",

  "about.card.left": "Capabilities & Approach",
  "about.card.right": "Gear",

  "about.section.capabilities": "Capabilities",
  "about.section.focus": "Focus",
  "about.section.tooling": "Tooling",
  "about.section.workflow": "Workflow",
  "about.section.gear": "Gear",
  "about.section.output": "Output",

  "about.capabilities.b1": "Component systems & design systems: consistency and maintainability",
  "about.capabilities.b2": "Performance & accessibility: faster, clearer experiences",
  "about.capabilities.b3": "Motion & interaction semantics: restrained but layered",

  "about.focus.body": "I approach frontend, backend, and photography in the same way: structuring complexity into systems and narratives that are clear, navigable, and built to evolve over time.",

  "skills.title": "Tech Stack",
  "skills.subtitle": "A structured skill stack with clear grouping and priority.",
  "skills.filterAll": "Show all",

  "skills.group.frontend": "Frontend",
  "skills.group.backend": "Backend",
  "skills.group.creative": "Creative",

  "skills.groupDesc.frontend": "UI engineering and modern web delivery.",
  "skills.groupDesc.backend": "Backend engineering, performance, and reliability.",
  "skills.groupDesc.creative": "Design tools and visual/motion craft.",

  "featured.title": "Featured Photos",
  "featured.subtitle": "Click to open the lightbox. Keyboard navigation supported.",
  "featured.cta.all": "View all",
  "featured.cta.contact": "Work together",

  "contact.title": "Contact",
  "contact.subtitle": "For roles, collaborations, photo shoots, and chats.",
  "contact.lead": "Let’s talk",
  "contact.message": "Interested in working together? Drop me a line.",
  "contact.elsewhere": "You can also find me on:",
  "contact.copy": "Copy email",
  "contact.copied": "Email copied to clipboard",
  "contact.copyFailed": "Copy failed. Please copy manually",

  "portfolio.title": "Photo Gallery",
  "portfolio.subtitle": "Filter by category, search, and masonry layout.",
  "portfolio.search": "Search: title / tags / location",
  "portfolio.sort.new": "Newest first",
  "portfolio.sort.old": "Oldest first",
  "portfolio.count": "{count} photos",

  "photo.open": "Open photo: {title}",
  "photo.close": "Close",
  "photo.prev": "Previous",
  "photo.next": "Next",
  "photo.hint": "Keyboard: Esc to close, ←/→ to navigate.",
  "photo.meta.location": "Location",
  "photo.meta.date": "Date",
  "photo.meta.camera": "Camera",
  "photo.meta.lens": "Lens",
  "photo.meta.settings": "Settings",

  "notFound.title": "404",
  "notFound.subtitle": "This page doesn't exist. It may have moved.",
  "notFound.home": "Go home",
  "notFound.portfolio": "Go to gallery"
};

const fr: Record<Key, string> = {
  "common.skipToContent": "Aller au contenu",
  "common.theme": "Thème",
  "common.language": "Langue",
  "common.reset": "Réinitialiser",
  "common.close": "Fermer",
  "common.backToTop": "Haut de page",

  "nav.home": "Accueil",
  "nav.portfolio": "Galerie",
  "nav.about": "À propos",
  "nav.skills": "Stack",
  "nav.contact": "Contact",
  "nav.openMenu": "Ouvrir le menu",
  "nav.closeMenu": "Fermer le menu",

  "theme.system": "Système",
  "theme.light": "Clair",
  "theme.dark": "Sombre",

  "home.eyebrow": "PORTFOLIO PERSONNEL + PHOTO",
  "home.title": "Salut, je suis {name}",
  "home.cta.portfolio": "Voir la galerie",
  "home.cta.contact": "Me contacter",

  "about.title": "À propos",
  "about.subtitle": "Je m'intéresse au storytelling visuel, aux détails d'interaction et aux performances.",

  "about.card.left": "Capacités & approche",
  "about.card.right": "Matériel",

  "about.section.capabilities": "Capacités",
  "about.section.focus": "Focus",
  "about.section.tooling": "Outils",
  "about.section.workflow": "Workflow",
  "about.section.gear": "Matériel",
  "about.section.output": "Sortie",

  "about.capabilities.b1": "Design system & composants : cohérence et maintenabilité",
  "about.capabilities.b2": "Performance & accessibilité : expériences plus rapides et claires",
  "about.capabilities.b3": "Motion & sémantique d'interaction : sobre mais riche",

  "about.focus.body": "Frontend, backend et photographie relèvent pour moi de la même démarche: structurer la complexité en systèmes et récits clairs, parcourables et conçus pour évoluer dans le temps.",

  "skills.title": "Technos",
  "skills.subtitle": "Stack structuré : groupes + priorité.",
  "skills.filterAll": "Tout afficher",

  "skills.group.frontend": "Frontend",
  "skills.group.backend": "Backend",
  "skills.group.creative": "Créatif",

  "skills.groupDesc.frontend": "Ingénierie UI et delivery web moderne.",
  "skills.groupDesc.backend": "Ingénierie backend, performance, fiabilité.",
  "skills.groupDesc.creative": "Outils design et sens du visuel/motion.",

  "featured.title": "Photos sélectionnées",
  "featured.subtitle": "Clique pour ouvrir la lightbox. Navigation clavier supportée.",
  "featured.cta.all": "Tout voir",
  "featured.cta.contact": "Collaborer",

  "contact.title": "Contact",
  "contact.subtitle": "Pour postes, collaborations, shootings et échanges.",
  "contact.lead": "Discutons",
  "contact.message": "Envie de collaborer ? Écris-moi directement.",
  "contact.elsewhere": "Vous pouvez aussi me retrouver sur :",
  "contact.copy": "Copier l'email",
  "contact.copied": "Email copié",
  "contact.copyFailed": "Échec de copie. Copie manuelle nécessaire",

  "portfolio.title": "Galerie photo",
  "portfolio.subtitle": "Filtrer par catégorie, rechercher, et affichage masonry.",
  "portfolio.search": "Rechercher : titre / tags / lieu",
  "portfolio.sort.new": "Plus récent",
  "portfolio.sort.old": "Plus ancien",
  "portfolio.count": "{count} photos",

  "photo.open": "Ouvrir la photo : {title}",
  "photo.close": "Fermer",
  "photo.prev": "Précédente",
  "photo.next": "Suivante",
  "photo.hint": "Clavier : Esc pour fermer, ←/→ pour naviguer.",
  "photo.meta.location": "Lieu",
  "photo.meta.date": "Date",
  "photo.meta.camera": "Appareil",
  "photo.meta.lens": "Objectif",
  "photo.meta.settings": "Réglages",

  "notFound.title": "404",
  "notFound.subtitle": "Cette page n'existe pas (ou a été déplacée).",
  "notFound.home": "Retour à l'accueil",
  "notFound.portfolio": "Aller à la galerie"
};

const ja: Record<Key, string> = {
  "common.skipToContent": "本文へスキップ",
  "common.theme": "テーマ",
  "common.language": "言語",
  "common.reset": "リセット",
  "common.close": "閉じる",
  "common.backToTop": "トップへ",

  "nav.home": "ホーム",
  "nav.portfolio": "ギャラリー",
  "nav.about": "概要",
  "nav.skills": "技術",
  "nav.contact": "連絡",
  "nav.openMenu": "メニューを開く",
  "nav.closeMenu": "メニューを閉じる",

  "theme.system": "システム",
  "theme.light": "ライト",
  "theme.dark": "ダーク",

  "home.eyebrow": "PERSONAL + PHOTO PORTFOLIO",
  "home.title": "こんにちは、{name}です",
  "home.cta.portfolio": "ギャラリーを見る",
  "home.cta.contact": "連絡する",

  "about.title": "概要",
  "about.subtitle": "ビジュアルストーリー、インタラクションの細部、パフォーマンスを大切にしています。",

  "about.card.left": "能力とアプローチ",
  "about.card.right": "機材",

  "about.section.capabilities": "Capabilities",
  "about.section.focus": "Focus",
  "about.section.tooling": "Tooling",
  "about.section.workflow": "Workflow",
  "about.section.gear": "Gear",
  "about.section.output": "Output",

  "about.capabilities.b1": "デザインシステム／コンポーネント：一貫性と保守性",
  "about.capabilities.b2": "パフォーマンス／アクセシビリティ：速く、分かりやすく",
  "about.capabilities.b3": "モーション／インタラクション語彙：控えめに層を作る",

  "about.focus.body": "フロントエンド、バックエンド、そして写真制作を、私は同じ視点で捉えています。複雑な要素を整理し、理解しやすく、閲覧でき、継続的に拡張できる体験へと構成することです。",

  "skills.title": "技術スタック",
  "skills.subtitle": "構造化したスキルスタック（グループ＋優先度）。",
  "skills.filterAll": "すべて表示",

  "skills.group.frontend": "Frontend",
  "skills.group.backend": "Backend",
  "skills.group.creative": "Creative",

  "skills.groupDesc.frontend": "UI実装とモダンなWeb開発。",
  "skills.groupDesc.backend": "後端工程、性能、信頼性。",
  "skills.groupDesc.creative": "デザインツールと視覚／モーションの感覚。",

  "featured.title": "おすすめ写真",
  "featured.subtitle": "クリックでライトボックス。キーボード操作対応。",
  "featured.cta.all": "すべて見る",
  "featured.cta.contact": "相談する",

  "contact.title": "連絡",
  "contact.subtitle": "採用、コラボ、撮影、雑談など歓迎です。",
  "contact.lead": "話しましょう",
  "contact.message": "一緒に仕事しませんか？気軽に連絡ください。",
  "contact.elsewhere": "他の場所でも見つけられます：",
  "contact.copy": "メールをコピー",
  "contact.copied": "メールをコピーしました",
  "contact.copyFailed": "コピーに失敗しました。手動でコピーしてください",

  "portfolio.title": "写真ギャラリー",
  "portfolio.subtitle": "カテゴリ絞り込み・検索・マソンリー表示に対応。",
  "portfolio.search": "検索：タイトル / タグ / 場所",
  "portfolio.sort.new": "新しい順",
  "portfolio.sort.old": "古い順",
  "portfolio.count": "{count}枚",

  "photo.open": "写真を開く：{title}",
  "photo.close": "閉じる",
  "photo.prev": "前へ",
  "photo.next": "次へ",
  "photo.hint": "キー操作：Esc で閉じる、←/→ で移動。",
  "photo.meta.location": "場所",
  "photo.meta.date": "日付",
  "photo.meta.camera": "カメラ",
  "photo.meta.lens": "レンズ",
  "photo.meta.settings": "設定",

  "notFound.title": "404",
  "notFound.subtitle": "ページが見つかりません。移動または削除された可能性があります。",
  "notFound.home": "ホームへ",
  "notFound.portfolio": "ギャラリーへ"
};

const DICT: Record<Lang, Record<Key, string>> = { zh, en, fr, ja };

const STORAGE_KEY = "lang";

function normalizeLang(value: string | null): Lang | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "zh" || v === "en" || v === "fr" || v === "ja") return v;
  return null;
}

function detectLang(): Lang {
  try {
    const saved = normalizeLang(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // ignore
  }

  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("fr")) return "fr";
  if (nav.startsWith("ja")) return "ja";
  if (nav.startsWith("en")) return "en";
  return "zh";
}

function langToHtmlLang(lang: Lang) {
  if (lang === "zh") return "zh-Hans";
  if (lang === "ja") return "ja";
  return lang;
}

function format(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = params[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: Key, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => detectLang());

  useEffect(() => {
    document.documentElement.setAttribute("data-lang", lang);
    document.documentElement.lang = langToHtmlLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    const dict = DICT[lang];
    return {
      lang,
      setLang,
      t: (key, params) => format(dict[key], params)
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
