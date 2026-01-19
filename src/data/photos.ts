import { photoPlaceholder } from "../lib/placeholder";
import type { LocalizedString, Lang } from "../lib/i18n";

type L = Partial<LocalizedString>;

// Photo with localized fields
export type Photo = {
  id: string;
  title: L;
  date: string; // ISO date string
  category: L;
  location?: L;
  camera?: string;
  lens?: string;
  settings?: string;
  description?: L;
  tags: L[];
  src: string;
  alt: L;
  width: number;
  height: number;
};

// Helper to get localized string from Photo field
export function getPhotoField(value: L | undefined, lang: Lang): string {
  if (!value) return "";
  if (lang === "zh-Hant" && !value["zh-Hant"]) {
    return value.zh ?? value.en ?? "";
  }
  return value[lang] ?? value.en ?? value.zh ?? "";
}

// Helper to get localized tags
export function getPhotoTags(tags: L[], lang: Lang): string[] {
  return tags.map(t => getPhotoField(t, lang));
}

type PhotoInput = {
  id: string;
  title: string | L;
  date: string;
  category: string | L;
  location?: string | L;
  camera?: string;
  lens?: string;
  settings?: string;
  description?: string | L;
  tags: (string | L)[];
  src?: string;
  alt?: string | L;
  width: number;
  height: number;
};

function toL(value: string | L | undefined): L | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return { zh: value };
  return value;
}

function makePhoto(p: PhotoInput): Photo {
  const titleL = toL(p.title) ?? { zh: "" };
  const src =
    p.src ??
    photoPlaceholder({
      title: titleL.zh ?? titleL.en ?? "",
      seed: p.id,
      width: p.width,
      height: p.height
    });

  return {
    id: p.id,
    title: titleL,
    date: p.date,
    category: toL(p.category) ?? { zh: "" },
    location: toL(p.location),
    camera: p.camera,
    lens: p.lens,
    settings: p.settings,
    description: toL(p.description),
    tags: p.tags.map(t => toL(t) ?? { zh: "" }),
    src,
    alt: toL(p.alt) ?? titleL,
    width: p.width,
    height: p.height
  };
}

export const photos: Photo[] = [
  makePhoto({
    id: "glico-night-icon",
    title: { zh: "奔跑", en: "Running Man", fr: "L'homme qui court", ja: "グリコサイン" },
    date: "2024-08-21",
    category: { zh: "街头", en: "Street", fr: "Rue", ja: "ストリート" },
    location: { zh: "大阪·道顿堀", en: "Osaka, Dotonbori", fr: "Osaka, Dotonbori", ja: "大阪・道頓堀" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "格力高跑男，城市记忆锚点。", en: "The Glico Running Man, an anchor of urban memory.", fr: "L'homme Glico, ancre de la mémoire urbaine.", ja: "グリコの走る男、都市の記憶のアンカー。" },
    tags: [
      { zh: "霓虹", en: "Neon", fr: "Néon", ja: "ネオン" },
      { zh: "城市符号", en: "Urban Icon", fr: "Icône urbaine", ja: "都市のシンボル" },
      { zh: "日本", en: "Japan", fr: "Japon", ja: "日本" }
    ],
    src: "https://live.staticflickr.com/65535/55042276542_8c2b03588c_b.jpg",
    alt: { zh: "大阪道顿堀夜晚的格力高跑男广告牌，周围被密集的霓虹招牌包围", en: "The Glico Running Man billboard in Dotonbori at night, surrounded by dense neon signs", fr: "Le panneau Glico à Dotonbori la nuit, entouré d'enseignes néon", ja: "夜の道頓堀のグリコサイン、密集したネオン看板に囲まれている" },
    width: 5210,
    height: 3150
  }),
  makePhoto({
    id: "donki-ferris-wheel",
    title: { zh: "黄色摩天轮", en: "Yellow Ferris Wheel", fr: "Grande roue jaune", ja: "黄色い観覧車" },
    date: "2024-08-21",
    category: { zh: "街头", en: "Street", fr: "Rue", ja: "ストリート" },
    location: { zh: "大阪·道顿堀", en: "Osaka, Dotonbori", fr: "Osaka, Dotonbori", ja: "大阪・道頓堀" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "黄色摩天轮，红色座舱，框架中依然能窥见美好的晴天", en: "Yellow ferris wheel, red cabins, a clear sky still visible through the frame", fr: "Grande roue jaune, cabines rouges, un ciel clair visible à travers la structure", ja: "黄色い観覧車、赤いゴンドラ、フレームの中にはまだ晴れた空が見える" },
    tags: [
      { zh: "摩天轮", en: "Ferris Wheel", fr: "Grande roue", ja: "観覧車" },
      { zh: "结构", en: "Structure", fr: "Structure", ja: "構造" },
      { zh: "色彩", en: "Color", fr: "Couleur", ja: "色彩" },
      { zh: "城市", en: "City", fr: "Ville", ja: "都市" }
    ],
    src: "https://live.staticflickr.com/65535/55043514690_4cc7141906_b.jpg",
    alt: { zh: "大阪道顿堀的黄色摩天轮结构，红色座舱沿着钢架排列，背景为晴朗天空", en: "Yellow ferris wheel structure in Dotonbori, red cabins along steel frame against clear sky", fr: "Structure de grande roue jaune à Dotonbori, cabines rouges sur l'armature", ja: "道頓堀の黄色い観覧車の構造、赤いゴンドラが鉄骨に沿って並ぶ" },
    width: 3837,
    height: 5602
  }),
  makePhoto({
    id: "dotonbori-street-light",
    title: { zh: "灯与线", en: "Light and Wires", fr: "Lumière et fils", ja: "灯りと線" },
    date: "2024-08-21",
    category: { zh: "街头", en: "Street", fr: "Rue", ja: "ストリート" },
    location: { zh: "大阪·道顿堀", en: "Osaka, Dotonbori", fr: "Osaka, Dotonbori", ja: "大阪・道頓堀" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "密集的线交错成网，昏黄路灯包被其中。", en: "Dense wires crisscross into a web, a dim street lamp caught within.", fr: "Des fils denses s'entrecroisent, un réverbère tamisé pris au milieu.", ja: "密集した線が網のように交差し、薄暗い街灯がその中に包まれている。" },
    tags: [
      { zh: "街灯", en: "Street Lamp", fr: "Réverbère", ja: "街灯" },
      { zh: "电线", en: "Wires", fr: "Fils", ja: "電線" },
      { zh: "秩序与杂乱", en: "Order and Chaos", fr: "Ordre et chaos", ja: "秩序と混沌" },
      { zh: "城市", en: "City", fr: "Ville", ja: "都市" },
      { zh: "夜前", en: "Pre-dusk", fr: "Pré-crépuscule", ja: "夕暮れ前" }
    ],
    src: "https://live.staticflickr.com/65535/55043176501_dd83d5e978_b.jpg",
    alt: { zh: "大阪道顿堀街头，密集电线之间悬挂的一盏路灯，背景为城市建筑", en: "A street lamp hanging among dense wires in Dotonbori, city buildings in background", fr: "Un réverbère suspendu parmi les fils denses à Dotonbori", ja: "道頓堀の街頭、密集した電線の間に吊り下げられた街灯" },
    width: 3584,
    height: 6000
  }),
  makePhoto({
    id: "dotonbori-canal",
    title: "河道",
    date: "2024-08-21",
    category: "街头",
    location: "大阪·道顿堀",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "夕色填满狭长河道，船只穿行熙攘城市。",
    tags: ["河道", "城市", "黄昏", "街头"],
    src: "https://live.staticflickr.com/65535/55042276442_b643ccd2f0_b.jpg",
    alt: "大阪道顿堀的河道景象，黄昏时分城市建筑与招牌夹着水面，一艘船行驶其中",
    width: 5617,
    height: 3745
  }),
  makePhoto({
    id: "lanterns-and-sign",
    title: "灯笼",
    date: "2024-08-21",
    category: "街头",
    location: "大阪·道顿堀",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "灯笼悬于当前，文字排列之后，招牌缩进夜色。",
    tags: ["灯笼", "文字", "光", "街头"],
    src: "https://live.staticflickr.com/65535/55043176486_237af61044_b.jpg",
    alt: "大阪道顿堀夜晚街头，成排悬挂的灯笼，上面写有日文文字，背景为大型立体招牌",
    width: 6000,
    height: 4000
  }),
  makePhoto({
    id: "crowd-and-lights",
    title: "大阪的夜",
    date: "2024-08-21",
    category: "街头",
    location: "大阪·道顿堀",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "灯具向夜色延伸，人群来来往往。",
    tags: ["人群", "灯", "街道", "夜晚"],
    src: "https://live.staticflickr.com/65535/55043355753_822fb1cce0_b.jpg",
    alt: "大阪道顿堀夜晚的街道，成排灯具悬挂在空中，下方密集的人群沿街行走",
    width: 3848,
    height: 5772
  }),
  makePhoto({
    id: "temple-plaque",
    title: "寺额",
    date: "2024-08-21",
    category: "旅行",
    location: "奈良·东大寺",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "寺额悬于檐下，瓦片排列其前，木结构层层叠合。",
    tags: ["寺庙", "木结构", "瓦片", "文字"],
    src: "https://live.staticflickr.com/65535/55042276402_deaa00c4eb_b.jpg",
    alt: "奈良东大寺悬挂在檐下的寺额，上方为瓦片屋檐，下方为木质结构",
    width: 5448,
    height: 3632
  }),
  makePhoto({
    id: "ema-wooden-plaques",
    title: "绘马",
    date: "2024-08-21",
    category: "旅行",
    location: "奈良·东大寺",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "木牌层层悬挂，文字与图案并置，祈愿被留在木纹之中。",
    tags: ["绘马", "文字", "木纹", "寺庙"],
    src: "https://live.staticflickr.com/65535/55043432854_7e7cf4599b_b.jpg",
    alt: "奈良东大寺内悬挂的绘马木牌，上面写有文字并绘有图案，木牌层叠排列",
    width: 3180,
    height: 4770
  }),
  makePhoto({
    id: "deer-between-stone",
    title: "鹿",
    date: "2024-08-21",
    category: "旅行",
    location: "奈良·春日社",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "鹿从石灯与树干之间探出，视线延伸向寺院深处。",
    tags: ["鹿", "石灯", "寺庙", "结构"],
    src: "https://live.staticflickr.com/65535/55043514605_97ec70b7e8_b.jpg",
    alt: "奈良春日社内，一只鹿从石灯与树木之间探出身体，背景为寺院建筑",
    width: 4000,
    height: 6000
  }),
  makePhoto({
    id: "temple-roof-and-lanterns",
    title: "檐与灯笼",
    date: "2024-08-21",
    category: "旅行",
    location: "京都",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "屋檐层层起伏，灯笼沿檐排列，结构在光影中展开。",
    tags: ["屋檐", "灯笼", "寺庙", "结构"],
    src: "https://live.staticflickr.com/65535/55043432779_e2ca9d45d6_b.jpg",
    alt: "京都寺庙屋檐下悬挂成排灯笼，屋顶结构在光影中显现",
    width: 6000,
    height: 4000
  }),
  makePhoto({
    id: "pagoda",
    title: "京都的塔",
    date: "2024-08-21",
    category: "旅行",
    location: "京都",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "塔身层层叠起，屋檐向外展开，山与天空退至其后。",
    tags: ["塔", "屋檐", "建筑", "山"],
    src: "https://live.staticflickr.com/65535/55043355928_fac15011e4_b.jpg",
    alt: "京都拍摄的多层塔建筑，屋檐层叠，背景为远山与天空",
    width: 4000,
    height: 6000
  }),
  makePhoto({
    id: "fireworks-edogawa",
    title: "花火",
    date: "2024-08-24",
    category: "旅行",
    location: "东京·江户川",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: "火光在夜空中绽开，轨迹向外延伸，随后缓慢坠落。",
    tags: ["花火", "夜空", "光轨"],
    src: "https://live.staticflickr.com/65535/55043355973_418129f1da_b.jpg",
    alt: "东京江户川花火大会夜空中的烟火，光轨向四周扩散后逐渐下落",
    width: 5873,
    height: 3915
  }),
  makePhoto({
    id: "jellyfish",
    title: "水母",
    date: "2024-08-26",
    category: "旅行",
    location: "东京·墨田水族馆",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: "伞体缓慢张合，触须在水中延展，轨迹被光线勾出。",
    tags: ["水母", "水族馆", "流动", "光"],
    src: "https://live.staticflickr.com/65535/55043355868_845e4e19d2_b.jpg",
    alt: "东京墨田水族馆中的水母，伞体张合，半透明触须在黑色水域中延展",
    width: 5503,
    height: 3669
  }),
  makePhoto({
    id: "jellyfish-upward",
    title: "上浮",
    date: "2024-08-26",
    category: "旅行",
    location: "东京·墨田水族馆",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: "伞体下方收拢，触须向上延展，形态在光中逐渐拉长。",
    tags: ["水母", "水族馆", "形态", "光"],
    src: "https://live.staticflickr.com/65535/55043514885_b55498a182_b.jpg",
    alt: "东京墨田水族馆中的水母，触须向上延展，半透明形态在蓝色光线中拉长",
    width: 4000,
    height: 6000
  }),
  makePhoto({
    id: "skytree",
    title: "晴空",
    date: "2024-08-27",
    category: "旅行",
    location: "东京·晴空塔",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: "结构沿竖向展开，线条层层叠加，形态在天空中保持稳定。",
    tags: ["塔", "结构", "线条", "竖向"],
    src: "https://live.staticflickr.com/65535/55043176596_d5819d72d0_b.jpg",
    alt: "东京晴空塔在晴天背景下的塔身细节，钢结构线条沿竖向向上延伸",
    width: 1629,
    height: 3478
  }),
  makePhoto({
    id: "layers",
    title: "涂鸦",
    date: "2024-08-28",
    category: "街头",
    location: "东京·下北泽",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: "涂写与贴纸反复覆盖，颜色与线条在墙面上持续叠加。",
    tags: ["街头", "涂鸦", "贴纸", "表面"],
    src: "https://live.staticflickr.com/65535/55043514760_b211af0f87_b.jpg",
    alt: "东京下北泽街头墙面上的涂鸦与贴纸，多层颜色和线条在表面反复叠加",
    width: 2143,
    height: 3807
  }),
  makePhoto({
    id: "tokyo-tower",
    title: "结构",
    date: "2024-08-29",
    category: "旅行",
    location: "东京·东京塔",
    camera: "Canon Samung S22",
    settings: "1/100 · f/5.6 · ISO 2000",
    description: "钢架以倾斜角度交错展开，受力路径在结构中被清晰显露。",
    tags: ["塔", "结构", "钢架", "线条"],
    src: "https://live.staticflickr.com/65535/55043514715_69361e1566_b.jpg",
    alt: "东京塔近距离视角下的钢结构细节，橙色钢架以倾斜角度交错展开",
    width: 1956,
    height: 3475
  }),
  makePhoto({
    id: "hanabi-scatter",
    title: "散落",
    date: "2025-05-28",
    category: "旅行",
    location: "东京·江户川花火大会",
    camera: "Canon R5",
    lens: "RF 70-200mm f/2.8L IS USM",
    settings: "1/200 · f/2.8 · ISO 100",
    description: "花火散作一片金雨，夜空把余烬慢慢收拢。",
    tags: ["花火", "夜", "金", "余烬"],
    src: "https://live.staticflickr.com/65535/55043010302_4306a5b7f3_b.jpg",
    alt: "夜空中大片金色烟花与余烬散开，底部可见烟雾与光痕",
    width: 6000,
    height: 4000
  }),
  makePhoto({
  id: "shinjuku-redlight",
  title: "红灯",
  date: "2025-05-27",
  category: "城市",
  location: "东京·新宿",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "红灯悬在空中，电线与铁架把城市拉紧。",
  tags: ["城市", "结构", "电线", "红灯"],
  src: "https://live.staticflickr.com/65535/55044251290_590220a5c9_b.jpg",
  alt: "新宿路口的红色交通信号灯悬挂在密集电线与高架结构之间",
  width: 8192,
  height: 5464
}),
makePhoto({
  id: "tokyo-facade",
  title: "立面",
  date: "2025-05-26",
  category: "城市",
  location: "东京",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "建筑在画面一侧停下，天空接管了剩余空间。",
  tags: ["城市", "建筑", "立面", "留白"],
  src: "https://live.staticflickr.com/65535/55044172949_20cbd93dfd_b.jpg",
  alt: "东京城市中一栋高层建筑的立面占据画面一侧，另一侧是大面积天空留白",
  width: 7977,
  height: 5321
}),
makePhoto({
  id: "kabukicho-gate",
  title: "歌舞伎町",
  date: "2025-05-28",
  category: "城市",
  location: "东京 · 歌舞伎町一番街",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "城市在这里收紧，灯牌与规则同时亮起。",
  tags: ["东京", "歌舞伎町", "城市", "街道", "标识"],
  src: "https://live.staticflickr.com/65535/55044172954_5dc1d2cfc7_b.jpg",
  alt: "东京歌舞伎町一番街入口，红色拱门与密集招牌构成的城市街景",
  width: 5464,
  height: 8192
}),
makePhoto({
  id: "shibuya-stability",
  title: "晴空2",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 涩谷 Sky",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "结构归位，城市保持沉默。",
  tags: ["东京", "涩谷", "城市", "天际线", "结构"],
  src: "https://live.staticflickr.com/65535/55044173069_9d8e5732ee_b.jpg",
  alt: "东京城市天际线，远处晴天塔立于高楼群中，天空开阔",
  width: 5030,
  height: 7541
}),
makePhoto({
  id: "shibuya-sky-arena",
  title: "东京折叠",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 涩谷 Sky",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "密集建筑向外扩散，场馆位于其中，像一枚被城市包裹的核心。",
  tags: ["东京", "涩谷", "城市", "城市结构", "天际线"],
  src: "https://live.staticflickr.com/65535/55044090638_f7096439a9_b.jpg",
  alt: "从高空俯瞰东京城市景观，密集建筑之间，一座大型圆形体育场位于画面中央",
  width: 4986,
  height: 7475
}),
makePhoto({
  id: "shinjuku-red-light",
  title: "人流",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 新宿",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "红灯悬在街口，人群被短暂收拢。街道不说话，只负责把人送往下一个方向。",
  tags: ["东京", "新宿", "街头", "人群", "城市"],
  src: "https://live.staticflickr.com/65535/55043913291_48fde29d38_b.jpg",
  alt: "东京新宿街头十字路口，人群在红灯下穿行，城市街道纵深延伸",
  width: 4805,
  height: 7204
}),
makePhoto({
  id: "yoyogi-raven",
  title: "停留",
  date: "2025-05-27",
  category: "自然",
  location: "东京 · 代代木公园",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "黑羽停在木栏上，风声被树叶吸收，时间短暂地放慢。",
  tags: ["东京", "代代木公园", "自然", "鸟", "静态"],
  src: "https://live.staticflickr.com/65535/55043015232_fbc25b17c1_b.jpg",
  alt: "代代木公园中，一只黑色乌鸦停在木质围栏上，背景是模糊的绿色植被",
  width: 5349,
  height: 8019
}),
makePhoto({
  id: "tokyo-night-anchor",
  title: "东京印象",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 涩谷 Sky",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/100 · f/2.8 · ISO 2000",
  description: "灯光铺开城市，东京塔独一无二。",
  tags: ["东京", "涩谷", "夜景", "城市", "天际线"],
  src: "https://live.staticflickr.com/65535/55043913236_6c5e305d75_b.jpg",
  alt: "夜色中的东京城市天际线，东京塔亮起橙色灯光，周围高楼密集延展",
  width: 8098,
  height: 5401
}),
makePhoto({
  id: "shibuya-rail-corridor",
  title: "轨道切片",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 涩谷 Sky",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "城市被纵向剖开，流动被压缩为一条可追踪的轨迹。",
  tags: ["东京", "涩谷", "城市", "铁路", "结构", "俯瞰"],
  src: "https://live.staticflickr.com/65535/55044173029_fe8a3fc096_b.jpg",
  alt: "从高空俯瞰东京城市建筑群，铁路纵向贯穿密集街区，结构清晰",
  width: 4028,
  height: 6039
}),
makePhoto({
  id: "shinjuku-crossing-day",
  title: "通行中",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 新宿",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "红灯悬停，时间被短暂按下暂停键，人流继续向前。",
  tags: ["东京", "新宿", "城市", "街头", "人群", "秩序"],
  src: "https://live.staticflickr.com/65535/55043913206_e8eb1ca5db_b.jpg",
  alt: "东京新宿街头白天，人群在斑马线穿行，城市街道与高楼构成背景",
  width: 5358,
  height: 8033
}),
makePhoto({
  id: "skytree-night-axis",
  title: "夜轴",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 涩谷 Sky",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/100 · f/2.8 · ISO 2000",
  description: "灯光收束成一条垂直的轴线，城市在其下方缓慢呼吸。",
  tags: ["东京", "涩谷", "城市", "夜景", "天际线", "结构"],
  src: "https://live.staticflickr.com/65535/55044172964_fd5f6f9b51_b.jpg",
  alt: "东京夜晚城市天际线，晴空塔在远处垂直升起，灯光成为画面中心轴线",
  width: 5098,
  height: 7644
}),
makePhoto({
  id: "tokyo-tower-anchor",
  title: "夜塔",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 涩谷 Sky",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "橙色的光把城市钉在夜里，塔是唯一不需要解释的存在。",
  tags: ["东京", "东京塔", "夜景", "城市", "天际线", "中心"],
  src: "https://live.staticflickr.com/65535/55044090528_f8163ff9ac_b.jpg",
  alt: "夜晚的东京城市天际线，东京塔在城市中央亮起橙色灯光，周围建筑沉入黑暗",
  width: 5042,
  height: 7532
}),
makePhoto({
  id: "night-city-2077",
  title: "夜之城",
  date: "2025-05-27",
  category: "城市",
  location: "东京 · 涩谷 Sky",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "城市不再属于白天。光源分布决定秩序，夜晚接管一切。",
  tags: ["东京", "涩谷", "夜景", "城市", "天际线", "夜之城"],
  src: "https://live.staticflickr.com/65535/55043913191_40263e142f_b.jpg",
  alt: "夜晚俯瞰东京城市天际线，密集建筑在冷色灯光下延展，呈现出赛博朋克氛围的夜之城",
  width: 8192,
  height: 5464
}),
makePhoto({
  id: "beijing-ornament-001",
  title: "檐下",
  date: "2023-08-28",
  category: "建筑",
  location: "北京 · 北海公园",
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: "装饰先于空间存在。结构不为进入而建，而是为被观看而保存。",
  tags: ["北京", "传统建筑", "中式园林", "纹样", "雕刻", "屋檐"],
  src: "https://live.staticflickr.com/65535/55044091858_464fbbe0fc_b.jpg",
  alt: "北京传统园林建筑细节，红褐色木石纹样与屋檐结构交错，匾额居中，装饰密集而克制",
  width: 4815,
  height: 3225
}),
makePhoto({
  id: "beijing-temple-002",
  title: "皇穹宇",
  date: "2023-08-29",
  category: "建筑",
  location: "北京 · 天坛 · 皇穹宇",
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: "穹顶向天收拢，秩序在装饰中完成闭合。",
  tags: ["北京", "天坛", "皇穹宇", "传统建筑", "对称", "穹顶"],
  src: "https://live.staticflickr.com/65535/55044252685_dd0f2292d1_b.jpg",
  alt: "北京天坛皇穹宇建筑仰视视角，圆形屋顶与金色宝顶在阴云天空下形成强烈对比",
  width: 6000,
  height: 4000
}),
makePhoto({
  id: "beijing-temple-003",
  title: "敬天",
  date: "2023-08-28",
  category: "建筑",
  location: "北京 · 天坛",
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: "文字被置于结构之后，信仰通过遮挡而成立。",
  tags: ["北京", "天坛", "敬天", "传统建筑", "符号", "仪式"],
  src: "https://live.staticflickr.com/65535/55044252690_499b14e103_b.jpg",
  alt: "通过石雕构件框取天坛匾额“天敬”字样，前景粗粝、背景虚化，形成强烈层次对比",
  width: 6000,
  height: 4000
}),
makePhoto({
  id: "kunming-haigeng-004",
  title: "冬日",
  date: "2024-01-22",
  category: "自然",
  location: "昆明 · 海埂大坝",
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: "颜色先于季节抵达，天空为它让出位置。",
  tags: ["昆明", "海埂大坝", "花", "色彩", "季节错位", "天空"],
  src: "https://live.staticflickr.com/65535/55044174239_11172e25b1_b.jpg",
  alt: "深蓝天空下盛开的红色花树，自下而上伸展，占据画面下半部，形成强烈色彩对比",
  width: 4000,
  height: 5225
}),
makePhoto({
  id: "kunming-haigeng-005",
  title: "向前",
  date: "2023-01-22",
  category: "自然 / 生灵",
  location: "昆明 · 海埂大坝",
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: "风从湖面来，它短暂停留，随后交还天空。",
  tags: ["昆明", "海埂大坝", "海鸥", "湖面", "飞翔", "冬季"],
  src: "https://live.staticflickr.com/65535/55044091848_47b1ce634a_b.jpg",
  alt: "一只海鸥立于木桩之上，张开双翼，背景为湖面与天空",
  width: 1421,
  height: 2192
}),
makePhoto({
  id: "rome-alley-dome-006",
  title: "穹顶之间",
  date: "2023-08",
  category: "城市 / 建筑",
  location: "意大利 · 罗马",
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: "城市收紧视线，只为让穹顶在尽头浮现。",
  tags: ["罗马", "意大利", "街巷", "穹顶", "建筑", "历史"],
  src: "https://live.staticflickr.com/65535/55043016452_300e44a2c3_b.jpg",
  alt: "罗马狭窄街巷之间，尽头显露一座浅色穹顶建筑",
  width: 1000,
  height: 1500
}),
makePhoto({
  id: "vancouver-window-cat-2026",
  title: "小黑",
  date: "2026-01-17",
  category: "日常 / 动物",
  location: "加拿大 · 温哥华",
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: "冬日的光停在窗边，猫占据了时间最安静的位置。",
  tags: ["猫", "日常", "室内", "光影", "温哥华"],
  src: "https://live.staticflickr.com/65535/55046917474_60edaceb47_b.jpg",
  alt: "阳光照进窗边，一只蓝眼睛的猫慵懒地躺在桌面上",
  width: 6812,
  height: 4544
}),
makePhoto({
  id: "vancouver-locarno-pier-2025",
  title: "木与海",
  date: "2025-08-12",
  category: "自然 / 城市边缘",
  location: "加拿大 · 温哥华 · Locarno Beach",
  camera: "iPhone 16 Pro Max",
  lens: "15.66mm f/2.8",
  settings: "1/100 · f/2.8 · ISO 100",
  description: "风浪反复打磨水面，木纹记录时间留下的方向。",
  tags: ["温哥华", "海边", "木结构", "纹理", "光影"],
  src: "https://live.staticflickr.com/65535/55048463767_0ee76d0ab5_b.jpg",
  alt: "码头木桩被夕阳染成暖色，背景是起伏的海面",
  width: 3826,
  height: 3018
}),
makePhoto({
  id: "vancouver-impression-locarno-2025",
  title: "温哥华印象",
  date: "2025-08-12",
  category: "自然 / 城市边缘",
  location: "加拿大 · 温哥华 · Locarno Beach",
  camera: "iPhone 16 Pro Max",
  lens: "15.66mm f/2.8",
  settings: "1/100 · f/2.8 · ISO 100",
  description: "冷色的天空压低地平线，海与城在光线中达成暂时的平衡。",
  tags: ["温哥华", "海岸", "城市", "天空", "光影"],
  src: "https://live.staticflickr.com/65535/55048463752_aa31ba4994_b.jpg",
  alt: "温哥华 Locarno Beach 海岸线，远处城市与海面在冷色天空下展开",
  width: 3784,
  height: 2348
})
];
