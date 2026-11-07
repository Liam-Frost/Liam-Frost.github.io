import type { LocalizedText } from "./api";

const languages = ["zh", "zh-Hant", "en", "ja", "fr"] as const;
const rows = [
  ["动作", "動作", "Action", "アクション", "Action"],
  ["冒险", "冒險", "Adventure", "冒険", "Aventure"],
  ["动画", "動畫", "Animation", "アニメーション", "Animation"],
  ["喜剧", "喜劇", "Comedy", "コメディ", "Comédie"],
  ["剧情", "劇情", "Drama", "ドラマ", "Drame"],
  ["奇幻", "奇幻", "Fantasy", "ファンタジー", "Fantastique"],
  ["科幻", "科幻", "Science Fiction", "SF", "Science-fiction"],
  ["爱情", "愛情", "Romance", "恋愛", "Romance"],
  ["悬疑", "懸疑", "Mystery", "ミステリー", "Mystère"],
  ["惊悚", "驚悚", "Thriller", "スリラー", "Thriller"],
  ["恐怖", "恐怖", "Horror", "ホラー", "Horreur"],
  ["犯罪", "犯罪", "Crime", "犯罪", "Policier"],
  ["历史", "歷史", "History", "歴史", "Histoire"],
  ["战争", "戰爭", "War", "戦争", "Guerre"],
  ["纪录片", "紀錄片", "Documentary", "ドキュメンタリー", "Documentaire"],
  ["家庭", "家庭", "Family", "ファミリー", "Familial"],
  ["音乐", "音樂", "Music", "音楽", "Musique"],
  ["日常", "日常", "Slice of Life", "日常", "Tranche de vie"],
  ["校园", "校園", "School", "学園", "Vie scolaire"],
  ["运动", "運動", "Sports", "スポーツ", "Sport"],
  ["机战", "機戰", "Mecha", "ロボット", "Mecha"],
  ["心理", "心理", "Psychological", "心理", "Psychologique"],
  ["超自然", "超自然", "Supernatural", "超自然", "Surnaturel"],
  ["治愈", "治癒", "Iyashikei", "癒やし", "Iyashikei"],
  ["原创", "原創", "Original", "オリジナル", "Œuvre originale"],
  ["漫画改", "漫畫改", "Manga adaptation", "漫画原作", "Adaptation de manga"],
  [
    "轻小说改",
    "輕小說改",
    "Light novel adaptation",
    "ライトノベル原作",
    "Adaptation de light novel"
  ],
  ["小说改", "小說改", "Novel adaptation", "小説原作", "Adaptation de roman"],
  ["游戏改", "遊戲改", "Game adaptation", "ゲーム原作", "Adaptation de jeu"],
  ["剧场版", "劇場版", "Theatrical film", "劇場版", "Film de cinéma"],
  ["偶像", "偶像", "Idols", "アイドル", "Idoles"],
  ["角色扮演", "角色扮演", "Role-playing", "RPG", "Jeu de rôle"],
  ["模拟", "模擬", "Simulator", "シミュレーション", "Simulation"],
  ["策略", "策略", "Strategy", "ストラテジー", "Stratégie"],
  ["独立", "獨立", "Indie", "インディー", "Indépendant"],
  ["解谜", "解謎", "Puzzle", "パズル", "Réflexion"],
  ["平台", "平台", "Platform", "プラットフォーム", "Plateforme"],
  ["竞速", "競速", "Racing", "レース", "Course"],
  ["射击", "射擊", "Shooter", "シューティング", "Tir"],
  ["摇滚", "搖滾", "Rock", "ロック", "Rock"],
  ["流行", "流行", "Pop", "ポップ", "Pop"],
  ["爵士", "爵士", "Jazz", "ジャズ", "Jazz"],
  ["古典", "古典", "Classical", "クラシック", "Classique"],
  ["电子", "電子", "Electronic", "エレクトロニック", "Électronique"],
  ["原声", "原聲", "Soundtrack", "サウンドトラック", "Bande originale"]
] as const;
const normalize = (value: string) => value.normalize("NFKC").trim().toLowerCase();
const dictionary = new Map<string, LocalizedText>();
for (const row of rows) {
  const labels = Object.fromEntries(languages.map((lang, i) => [lang, row[i]]));
  for (const alias of row) dictionary.set(normalize(alias), labels);
}
for (const [alias, canonical] of Object.entries({
  "sci-fi": "Science Fiction",
  "sci fi": "Science Fiction",
  "science-fiction": "Science Fiction",
  搞笑: "Comedy",
  恋爱: "Romance",
  恋愛: "Romance",
  运动: "Sports",
  sport: "Sports",
  rpg: "Role-playing",
  "role-playing (rpg)": "Role-playing"
})) {
  const labels = dictionary.get(normalize(canonical));
  if (labels) dictionary.set(normalize(alias), labels);
}
/** Explicit translations always win. Known taxonomy labels fill gaps; unknown custom tags stay intact. */
export function genreLabel(value: LocalizedText, lang: string): string {
  const explicit = value[lang as keyof LocalizedText]?.trim();
  if (explicit) return explicit;
  for (const text of Object.values(value)) {
    const translated = text ? dictionary.get(normalize(text))?.[lang as keyof LocalizedText] : null;
    if (translated) return translated;
  }
  return value.en || value.zh || Object.values(value).find((v) => v?.trim()) || "";
}
