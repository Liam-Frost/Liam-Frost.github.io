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
    title: { zh: "河道", "zh-Hant": "河道", en: "Canal", fr: "Canal", ja: "運河" },
    date: "2024-08-21",
    category: { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "ストリート" },
    location: { zh: "大阪·道顿堀", "zh-Hant": "大阪·道頓堀", en: "Osaka, Dotonbori", fr: "Osaka, Dotonbori", ja: "大阪・道頓堀" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "夕色填满狭长河道，船只穿行熙攘城市。", "zh-Hant": "夕色填滿狹長河道，船隻穿行熙攘城市。", en: "Twilight fills the narrow canal as boats navigate through the bustling city.", fr: "Le crépuscule remplit le canal étroit tandis que les bateaux naviguent dans la ville animée.", ja: "夕暮れの色が狭い運河を満たし、船が賑やかな街を行き交う。" },
    tags: [
      { zh: "河道", "zh-Hant": "河道", en: "Canal", fr: "Canal", ja: "運河" },
      { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
      { zh: "黄昏", "zh-Hant": "黃昏", en: "Twilight", fr: "Crépuscule", ja: "黄昏" },
      { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "ストリート" }
    ],
    src: "https://live.staticflickr.com/65535/55042276442_b643ccd2f0_b.jpg",
    alt: { zh: "大阪道顿堀的河道景象，黄昏时分城市建筑与招牌夹着水面，一艘船行驶其中", "zh-Hant": "大阪道頓堀的河道景象，黃昏時分城市建築與招牌夾著水面，一艘船行駛其中", en: "Dotonbori canal in Osaka at twilight, city buildings and signs flanking the water with a boat passing through", fr: "Canal de Dotonbori à Osaka au crépuscule, bâtiments et enseignes encadrant l'eau avec un bateau", ja: "大阪道頓堀の運河の景色、黄昏時に都市の建物と看板が水面を挟み、船が一隻航行している" },
    width: 5617,
    height: 3745
  }),
  makePhoto({
    id: "lanterns-and-sign",
    title: { zh: "灯笼", "zh-Hant": "燈籠", en: "Lanterns", fr: "Lanternes", ja: "提灯" },
    date: "2024-08-21",
    category: { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "ストリート" },
    location: { zh: "大阪·道顿堀", "zh-Hant": "大阪·道頓堀", en: "Osaka, Dotonbori", fr: "Osaka, Dotonbori", ja: "大阪・道頓堀" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "灯笼悬于当前，文字排列之后，招牌缩进夜色。", "zh-Hant": "燈籠懸於眼前，文字排列其後，招牌縮進夜色。", en: "Lanterns hang in the foreground, text arranged behind, signs receding into the night.", fr: "Les lanternes pendent au premier plan, le texte disposé derrière, les enseignes s'effacent dans la nuit.", ja: "提灯が手前に吊るされ、文字がその後ろに並び、看板が夜色に溶け込む。" },
    tags: [
      { zh: "灯笼", "zh-Hant": "燈籠", en: "Lanterns", fr: "Lanternes", ja: "提灯" },
      { zh: "文字", "zh-Hant": "文字", en: "Text", fr: "Texte", ja: "文字" },
      { zh: "光", "zh-Hant": "光", en: "Light", fr: "Lumière", ja: "光" },
      { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "ストリート" }
    ],
    src: "https://live.staticflickr.com/65535/55043176486_237af61044_b.jpg",
    alt: { zh: "大阪道顿堀夜晚街头，成排悬挂的灯笼，上面写有日文文字，背景为大型立体招牌", "zh-Hant": "大阪道頓堀夜晚街頭，成排懸掛的燈籠，上面寫有日文文字，背景為大型立體招牌", en: "Dotonbori street at night in Osaka, rows of hanging lanterns with Japanese text, large 3D signs in background", fr: "Rue Dotonbori la nuit à Osaka, rangées de lanternes suspendues avec texte japonais, grandes enseignes 3D en arrière-plan", ja: "大阪道頓堀の夜の街頭、日本語の文字が書かれた提灯が並んで吊るされ、背景には大型立体看板" },
    width: 6000,
    height: 4000
  }),
  makePhoto({
    id: "crowd-and-lights",
    title: { zh: "大阪的夜", "zh-Hant": "大阪的夜", en: "Osaka Night", fr: "Nuit à Osaka", ja: "大阪の夜" },
    date: "2024-08-21",
    category: { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "ストリート" },
    location: { zh: "大阪·道顿堀", "zh-Hant": "大阪·道頓堀", en: "Osaka, Dotonbori", fr: "Osaka, Dotonbori", ja: "大阪・道頓堀" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "灯具向夜色延伸，人群来来往往。", "zh-Hant": "燈具向夜色延伸，人群來來往往。", en: "Lights extend into the night, crowds come and go.", fr: "Les lumières s'étendent dans la nuit, les foules vont et viennent.", ja: "照明が夜色に伸び、人々が行き交う。" },
    tags: [
      { zh: "人群", "zh-Hant": "人群", en: "Crowd", fr: "Foule", ja: "人混み" },
      { zh: "灯", "zh-Hant": "燈", en: "Lights", fr: "Lumières", ja: "灯り" },
      { zh: "街道", "zh-Hant": "街道", en: "Street", fr: "Rue", ja: "通り" },
      { zh: "夜晚", "zh-Hant": "夜晚", en: "Night", fr: "Nuit", ja: "夜" }
    ],
    src: "https://live.staticflickr.com/65535/55043355753_822fb1cce0_b.jpg",
    alt: { zh: "大阪道顿堀夜晚的街道，成排灯具悬挂在空中，下方密集的人群沿街行走", "zh-Hant": "大阪道頓堀夜晚的街道，成排燈具懸掛在空中，下方密集的人群沿街行走", en: "Dotonbori street at night in Osaka, rows of lights hanging overhead, dense crowds walking below", fr: "Rue Dotonbori la nuit à Osaka, rangées de lumières suspendues, foules denses marchant en dessous", ja: "大阪道頓堀の夜の通り、空中に吊るされた照明の列、その下を密集した人々が歩く" },
    width: 3848,
    height: 5772
  }),
  makePhoto({
    id: "temple-plaque",
    title: { zh: "寺额", "zh-Hant": "寺額", en: "Temple Plaque", fr: "Plaque de temple", ja: "寺額" },
    date: "2024-08-21",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "奈良·东大寺", "zh-Hant": "奈良·東大寺", en: "Nara, Todai-ji Temple", fr: "Nara, Temple Tōdai-ji", ja: "奈良・東大寺" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "寺额悬于檐下，瓦片排列其前，木结构层层叠合。", "zh-Hant": "寺額懸於檐下，瓦片排列其前，木結構層層疊合。", en: "The temple plaque hangs beneath the eaves, tiles arranged before it, wooden structures layered one upon another.", fr: "La plaque du temple pend sous l'avant-toit, les tuiles disposées devant, les structures en bois superposées.", ja: "寺額が軒下に掛かり、瓦がその前に並び、木造構造が重なり合う。" },
    tags: [
      { zh: "寺庙", "zh-Hant": "寺廟", en: "Temple", fr: "Temple", ja: "寺院" },
      { zh: "木结构", "zh-Hant": "木結構", en: "Wooden Structure", fr: "Structure en bois", ja: "木造構造" },
      { zh: "瓦片", "zh-Hant": "瓦片", en: "Tiles", fr: "Tuiles", ja: "瓦" },
      { zh: "文字", "zh-Hant": "文字", en: "Text", fr: "Texte", ja: "文字" }
    ],
    src: "https://live.staticflickr.com/65535/55042276402_deaa00c4eb_b.jpg",
    alt: { zh: "奈良东大寺悬挂在檐下的寺额，上方为瓦片屋檐，下方为木质结构", "zh-Hant": "奈良東大寺懸掛在檐下的寺額，上方為瓦片屋檐，下方為木質結構", en: "Temple plaque hanging under the eaves at Todai-ji in Nara, tiled roof above, wooden structure below", fr: "Plaque de temple suspendue sous l'avant-toit à Tōdai-ji à Nara, toit de tuiles au-dessus, structure en bois en dessous", ja: "奈良東大寺の軒下に掛かる寺額、上方は瓦屋根、下方は木造構造" },
    width: 5448,
    height: 3632
  }),
  makePhoto({
    id: "ema-wooden-plaques",
    title: { zh: "绘马", "zh-Hant": "繪馬", en: "Ema Plaques", fr: "Plaques Ema", ja: "絵馬" },
    date: "2024-08-21",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "奈良·东大寺", "zh-Hant": "奈良·東大寺", en: "Nara, Todai-ji Temple", fr: "Nara, Temple Tōdai-ji", ja: "奈良・東大寺" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "木牌层层悬挂，文字与图案并置，祈愿被留在木纹之中。", "zh-Hant": "木牌層層懸掛，文字與圖案並置，祈願被留在木紋之中。", en: "Wooden plaques hang in layers, text and patterns juxtaposed, wishes left within the wood grain.", fr: "Des plaques en bois pendent en couches, textes et motifs juxtaposés, les vœux laissés dans le grain du bois.", ja: "木札が幾重にも吊るされ、文字と図案が並置され、願いが木目の中に残される。" },
    tags: [
      { zh: "绘马", "zh-Hant": "繪馬", en: "Ema", fr: "Ema", ja: "絵馬" },
      { zh: "文字", "zh-Hant": "文字", en: "Text", fr: "Texte", ja: "文字" },
      { zh: "木纹", "zh-Hant": "木紋", en: "Wood Grain", fr: "Grain du bois", ja: "木目" },
      { zh: "寺庙", "zh-Hant": "寺廟", en: "Temple", fr: "Temple", ja: "寺院" }
    ],
    src: "https://live.staticflickr.com/65535/55043432854_7e7cf4599b_b.jpg",
    alt: { zh: "奈良东大寺内悬挂的绘马木牌，上面写有文字并绘有图案，木牌层叠排列", "zh-Hant": "奈良東大寺內懸掛的繪馬木牌，上面寫有文字並繪有圖案，木牌層疊排列", en: "Ema wooden plaques hanging at Todai-ji in Nara, inscribed with text and painted with patterns, plaques layered together", fr: "Plaques en bois ema suspendues à Tōdai-ji à Nara, inscrites de textes et peintes de motifs, plaques superposées", ja: "奈良東大寺に吊るされた絵馬、文字が書かれ図案が描かれ、木札が重なって並ぶ" },
    width: 3180,
    height: 4770
  }),
  makePhoto({
    id: "deer-between-stone",
    title: { zh: "鹿", "zh-Hant": "鹿", en: "Deer", fr: "Cerf", ja: "鹿" },
    date: "2024-08-21",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "奈良·春日社", "zh-Hant": "奈良·春日社", en: "Nara, Kasuga Shrine", fr: "Nara, Sanctuaire Kasuga", ja: "奈良・春日社" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "鹿从石灯与树干之间探出，视线延伸向寺院深处。", "zh-Hant": "鹿從石燈與樹幹之間探出，視線延伸向寺院深處。", en: "A deer peers out between stone lanterns and tree trunks, gaze extending into the temple depths.", fr: "Un cerf apparaît entre les lanternes de pierre et les troncs d'arbres, le regard s'étendant vers les profondeurs du temple.", ja: "鹿が石灯籠と木の幹の間から顔を出し、視線は寺院の奥へと延びる。" },
    tags: [
      { zh: "鹿", "zh-Hant": "鹿", en: "Deer", fr: "Cerf", ja: "鹿" },
      { zh: "石灯", "zh-Hant": "石燈", en: "Stone Lantern", fr: "Lanterne de pierre", ja: "石灯籠" },
      { zh: "寺庙", "zh-Hant": "寺廟", en: "Temple", fr: "Temple", ja: "寺院" },
      { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" }
    ],
    src: "https://live.staticflickr.com/65535/55043514605_97ec70b7e8_b.jpg",
    alt: { zh: "奈良春日社内，一只鹿从石灯与树木之间探出身体，背景为寺院建筑", "zh-Hant": "奈良春日社內，一隻鹿從石燈與樹木之間探出身體，背景為寺院建築", en: "A deer peers out between stone lanterns and trees at Kasuga Shrine in Nara, temple buildings in background", fr: "Un cerf apparaît entre lanternes de pierre et arbres au sanctuaire Kasuga à Nara, bâtiments du temple en arrière-plan", ja: "奈良春日社で石灯籠と樹木の間から顔を出す鹿、背景は寺院建築" },
    width: 4000,
    height: 6000
  }),
  makePhoto({
    id: "temple-roof-and-lanterns",
    title: { zh: "檐与灯笼", "zh-Hant": "簷與燈籠", en: "Eaves and Lanterns", fr: "Avant-toits et lanternes", ja: "軒と灯籠" },
    date: "2024-08-21",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "京都", "zh-Hant": "京都", en: "Kyoto", fr: "Kyoto", ja: "京都" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "屋檐层层起伏，灯笼沿檐排列，结构在光影中展开。", "zh-Hant": "屋簷層層起伏，燈籠沿簷排列，結構在光影中展開。", en: "Layered eaves rise and fall, lanterns aligned along the roofline, structure unfolding in light and shadow.", fr: "Les avant-toits en couches montent et descendent, les lanternes alignées le long du toit, la structure se déploie dans l'ombre et la lumière.", ja: "幾重にも重なる軒が起伏し、軒に沿って灯籠が並び、構造が光と影の中で展開する。" },
    tags: [
      { zh: "屋檐", "zh-Hant": "屋簷", en: "Eaves", fr: "Avant-toits", ja: "軒" },
      { zh: "灯笼", "zh-Hant": "燈籠", en: "Lanterns", fr: "Lanternes", ja: "灯籠" },
      { zh: "寺庙", "zh-Hant": "寺廟", en: "Temple", fr: "Temple", ja: "寺院" },
      { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" }
    ],
    src: "https://live.staticflickr.com/65535/55043432779_e2ca9d45d6_b.jpg",
    alt: { zh: "京都寺庙屋檐下悬挂成排灯笼，屋顶结构在光影中显现", "zh-Hant": "京都寺廟屋簷下懸掛成排燈籠，屋頂結構在光影中顯現", en: "Rows of lanterns hanging beneath temple eaves in Kyoto, roof structure revealed in light and shadow", fr: "Rangées de lanternes suspendues sous l'avant-toit d'un temple à Kyoto, structure du toit révélée par l'ombre et la lumière", ja: "京都の寺院の軒下に吊るされた灯籠の列、屋根の構造が光と影の中に現れる" },
    width: 6000,
    height: 4000
  }),
  makePhoto({
    id: "pagoda",
    title: { zh: "京都的塔", "zh-Hant": "京都的塔", en: "Kyoto Pagoda", fr: "Pagode de Kyoto", ja: "京都の塔" },
    date: "2024-08-21",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "京都", "zh-Hant": "京都", en: "Kyoto", fr: "Kyoto", ja: "京都" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: { zh: "塔身层层叠起，屋檐向外展开，山与天空退至其后。", "zh-Hant": "塔身層層疊起，屋簷向外展開，山與天空退至其後。", en: "The pagoda rises tier by tier, eaves extending outward, mountains and sky receding behind.", fr: "La pagode s'élève étage par étage, les avant-toits s'étendant vers l'extérieur, les montagnes et le ciel reculant derrière.", ja: "塔が層をなして立ち上がり、軒が外に広がり、山と空がその後ろに退く。" },
    tags: [
      { zh: "塔", "zh-Hant": "塔", en: "Pagoda", fr: "Pagode", ja: "塔" },
      { zh: "屋檐", "zh-Hant": "屋簷", en: "Eaves", fr: "Avant-toits", ja: "軒" },
      { zh: "建筑", "zh-Hant": "建築", en: "Architecture", fr: "Architecture", ja: "建築" },
      { zh: "山", "zh-Hant": "山", en: "Mountains", fr: "Montagnes", ja: "山" }
    ],
    src: "https://live.staticflickr.com/65535/55043355928_fac15011e4_b.jpg",
    alt: { zh: "京都拍摄的多层塔建筑，屋檐层叠，背景为远山与天空", "zh-Hant": "京都拍攝的多層塔建築，屋簷層疊，背景為遠山與天空", en: "Multi-tiered pagoda in Kyoto, layered eaves, distant mountains and sky in background", fr: "Pagode à plusieurs étages à Kyoto, avant-toits superposés, montagnes lointaines et ciel en arrière-plan", ja: "京都で撮影された多層塔建築、軒が重なり、背景は遠山と空" },
    width: 4000,
    height: 6000
  }),
  makePhoto({
    id: "fireworks-edogawa",
    title: { zh: "花火", "zh-Hant": "花火", en: "Fireworks", fr: "Feux d'artifice", ja: "花火" },
    date: "2024-08-24",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "东京·江户川", "zh-Hant": "東京·江戶川", en: "Tokyo, Edogawa", fr: "Tokyo, Edogawa", ja: "東京・江戸川" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: { zh: "火光在夜空中绽开，轨迹向外延伸，随后缓慢坠落。", "zh-Hant": "火光在夜空中綻開，軌跡向外延伸，隨後緩慢墜落。", en: "Fire bursts in the night sky, trails extending outward, then slowly falling.", fr: "Le feu éclate dans le ciel nocturne, les traînées s'étendant vers l'extérieur, puis tombant lentement.", ja: "夜空で火が開き、軌跡が外へ延び、そしてゆっくりと落下する。" },
    tags: [
      { zh: "花火", "zh-Hant": "花火", en: "Fireworks", fr: "Feux d'artifice", ja: "花火" },
      { zh: "夜空", "zh-Hant": "夜空", en: "Night Sky", fr: "Ciel nocturne", ja: "夜空" },
      { zh: "光轨", "zh-Hant": "光軌", en: "Light Trails", fr: "Traînées lumineuses", ja: "光跡" }
    ],
    src: "https://live.staticflickr.com/65535/55043355973_418129f1da_b.jpg",
    alt: { zh: "东京江户川花火大会夜空中的烟火，光轨向四周扩散后逐渐下落", "zh-Hant": "東京江戶川花火大會夜空中的煙火，光軌向四周擴散後逐漸下落", en: "Fireworks in the night sky at Edogawa Fireworks Festival in Tokyo, light trails spreading then gradually falling", fr: "Feux d'artifice dans le ciel nocturne au festival de feux d'artifice d'Edogawa à Tokyo, traînées lumineuses se dispersant puis tombant progressivement", ja: "東京江戸川花火大会の夜空の花火、光跡が四方に広がり徐々に落下する" },
    width: 5873,
    height: 3915
  }),
  makePhoto({
    id: "jellyfish",
    title: { zh: "水母", "zh-Hant": "水母", en: "Jellyfish", fr: "Méduse", ja: "クラゲ" },
    date: "2024-08-26",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "东京·墨田水族馆", "zh-Hant": "東京·墨田水族館", en: "Tokyo, Sumida Aquarium", fr: "Tokyo, Aquarium Sumida", ja: "東京・すみだ水族館" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: { zh: "伞体缓慢张合，触须在水中延展，轨迹被光线勾出。", "zh-Hant": "傘體緩慢張合，觸鬚在水中延展，軌跡被光線勾出。", en: "The bell slowly pulses, tentacles extending through water, trajectories traced by light.", fr: "La cloche pulse lentement, les tentacules s'étendant dans l'eau, les trajectoires tracées par la lumière.", ja: "傘がゆっくりと開閉し、触手が水中に伸び、軌跡が光で描かれる。" },
    tags: [
      { zh: "水母", "zh-Hant": "水母", en: "Jellyfish", fr: "Méduse", ja: "クラゲ" },
      { zh: "水族馆", "zh-Hant": "水族館", en: "Aquarium", fr: "Aquarium", ja: "水族館" },
      { zh: "流动", "zh-Hant": "流動", en: "Flow", fr: "Flux", ja: "流れ" },
      { zh: "光", "zh-Hant": "光", en: "Light", fr: "Lumière", ja: "光" }
    ],
    src: "https://live.staticflickr.com/65535/55043355868_845e4e19d2_b.jpg",
    alt: { zh: "东京墨田水族馆中的水母，伞体张合，半透明触须在黑色水域中延展", "zh-Hant": "東京墨田水族館中的水母，傘體張合，半透明觸鬚在黑色水域中延展", en: "Jellyfish at Sumida Aquarium in Tokyo, bell pulsing, translucent tentacles extending in dark water", fr: "Méduse à l'aquarium Sumida à Tokyo, cloche pulsant, tentacules translucides s'étendant dans l'eau sombre", ja: "東京すみだ水族館のクラゲ、傘が開閉し、半透明の触手が暗い水域に伸びる" },
    width: 5503,
    height: 3669
  }),
  makePhoto({
    id: "jellyfish-upward",
    title: { zh: "上浮", "zh-Hant": "上浮", en: "Rising", fr: "Montée", ja: "上昇" },
    date: "2024-08-26",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "东京·墨田水族馆", "zh-Hant": "東京·墨田水族館", en: "Tokyo, Sumida Aquarium", fr: "Tokyo, Aquarium Sumida", ja: "東京・すみだ水族館" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: { zh: "伞体下方收拢，触须向上延展，形态在光中逐渐拉长。", "zh-Hant": "傘體下方收攏，觸鬚向上延展，形態在光中逐漸拉長。", en: "The bell closes below, tentacles stretching upward, form gradually elongating in the light.", fr: "La cloche se referme en dessous, les tentacules s'étirant vers le haut, la forme s'allongeant progressivement dans la lumière.", ja: "傘の下部が閉じ、触手が上へ伸び、形態が光の中で徐々に伸びる。" },
    tags: [
      { zh: "水母", "zh-Hant": "水母", en: "Jellyfish", fr: "Méduse", ja: "クラゲ" },
      { zh: "水族馆", "zh-Hant": "水族館", en: "Aquarium", fr: "Aquarium", ja: "水族館" },
      { zh: "形态", "zh-Hant": "形態", en: "Form", fr: "Forme", ja: "形態" },
      { zh: "光", "zh-Hant": "光", en: "Light", fr: "Lumière", ja: "光" }
    ],
    src: "https://live.staticflickr.com/65535/55043514885_b55498a182_b.jpg",
    alt: { zh: "东京墨田水族馆中的水母，触须向上延展，半透明形态在蓝色光线中拉长", "zh-Hant": "東京墨田水族館中的水母，觸鬚向上延展，半透明形態在藍色光線中拉長", en: "Jellyfish at Sumida Aquarium in Tokyo, tentacles stretching upward, translucent form elongating in blue light", fr: "Méduse à l'aquarium Sumida à Tokyo, tentacules s'étirant vers le haut, forme translucide s'allongeant dans une lumière bleue", ja: "東京すみだ水族館のクラゲ、触手が上へ伸び、半透明の形態が青い光の中で伸びる" },
    width: 4000,
    height: 6000
  }),
  makePhoto({
    id: "skytree",
    title: { zh: "晴空", "zh-Hant": "晴空", en: "Sky", fr: "Ciel", ja: "晴空" },
    date: "2024-08-27",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "东京·晴空塔", "zh-Hant": "東京·晴空塔", en: "Tokyo, Skytree", fr: "Tokyo, Skytree", ja: "東京・スカイツリー" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: { zh: "结构沿竖向展开，线条层层叠加，形态在天空中保持稳定。", "zh-Hant": "結構沿豎向展開，線條層層疊加，形態在天空中保持穩定。", en: "Structure unfolds vertically, lines layered upon lines, form holding steady against the sky.", fr: "La structure se déploie verticalement, lignes superposées, la forme restant stable contre le ciel.", ja: "構造が縦方向に展開し、線が重なり合い、形態が空に対して安定を保つ。" },
    tags: [
      { zh: "塔", "zh-Hant": "塔", en: "Tower", fr: "Tour", ja: "塔" },
      { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" },
      { zh: "线条", "zh-Hant": "線條", en: "Lines", fr: "Lignes", ja: "線" },
      { zh: "竖向", "zh-Hant": "豎向", en: "Vertical", fr: "Vertical", ja: "垂直" }
    ],
    src: "https://live.staticflickr.com/65535/55043176596_d5819d72d0_b.jpg",
    alt: { zh: "东京晴空塔在晴天背景下的塔身细节，钢结构线条沿竖向向上延伸", "zh-Hant": "東京晴空塔在晴天背景下的塔身細節，鋼結構線條沿豎向向上延伸", en: "Tokyo Skytree tower detail against clear sky, steel structure lines extending vertically upward", fr: "Détail de la tour Tokyo Skytree contre un ciel dégagé, lignes de structure en acier s'étendant verticalement vers le haut", ja: "晴れた空を背景にした東京スカイツリーの塔身詳細、鉄骨構造の線が垂直に上へ伸びる" },
    width: 1629,
    height: 3478
  }),
  makePhoto({
    id: "layers",
    title: { zh: "涂鸦", "zh-Hant": "塗鴉", en: "Graffiti", fr: "Graffiti", ja: "グラフィティ" },
    date: "2024-08-28",
    category: { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "ストリート" },
    location: { zh: "东京·下北泽", "zh-Hant": "東京·下北澤", en: "Tokyo, Shimokitazawa", fr: "Tokyo, Shimokitazawa", ja: "東京・下北沢" },
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/3.5 · ISO 4000",
    description: { zh: "涂写与贴纸反复覆盖，颜色与线条在墙面上持续叠加。", "zh-Hant": "塗寫與貼紙反覆覆蓋，顏色與線條在牆面上持續疊加。", en: "Scrawls and stickers repeatedly layered, colors and lines continuously accumulating on the wall.", fr: "Gribouillis et autocollants superposés à répétition, couleurs et lignes s'accumulant continuellement sur le mur.", ja: "落書きとステッカーが繰り返し重ねられ、色と線が壁面に蓄積し続ける。" },
    tags: [
      { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "ストリート" },
      { zh: "涂鸦", "zh-Hant": "塗鴉", en: "Graffiti", fr: "Graffiti", ja: "グラフィティ" },
      { zh: "贴纸", "zh-Hant": "貼紙", en: "Stickers", fr: "Autocollants", ja: "ステッカー" },
      { zh: "表面", "zh-Hant": "表面", en: "Surface", fr: "Surface", ja: "表面" }
    ],
    src: "https://live.staticflickr.com/65535/55043514760_b211af0f87_b.jpg",
    alt: { zh: "东京下北泽街头墙面上的涂鸦与贴纸，多层颜色和线条在表面反复叠加", "zh-Hant": "東京下北澤街頭牆面上的塗鴉與貼紙，多層顏色和線條在表面反覆疊加", en: "Graffiti and stickers on a wall in Shimokitazawa, Tokyo, multiple layers of colors and lines repeatedly overlapping", fr: "Graffitis et autocollants sur un mur à Shimokitazawa, Tokyo, plusieurs couches de couleurs et de lignes se superposant", ja: "東京下北沢の街頭の壁のグラフィティとステッカー、複数の層の色と線が表面に重なり合う" },
    width: 2143,
    height: 3807
  }),
  makePhoto({
    id: "tokyo-tower",
    title: { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" },
    date: "2024-08-29",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "东京·东京塔", "zh-Hant": "東京·東京鐵塔", en: "Tokyo, Tokyo Tower", fr: "Tokyo, Tour de Tokyo", ja: "東京・東京タワー" },
    camera: "Canon Samung S22",
    settings: "1/100 · f/5.6 · ISO 2000",
    description: { zh: "钢架以倾斜角度交错展开，受力路径在结构中被清晰显露。", "zh-Hant": "鋼架以傾斜角度交錯展開，受力路徑在結構中被清晰顯露。", en: "Steel frames crisscross at diagonal angles, load paths clearly revealed in the structure.", fr: "Les cadres en acier se croisent en diagonale, les chemins de charge clairement révélés dans la structure.", ja: "鉄骨が斜めの角度で交差し、構造の中で荷重経路が明確に現れる。" },
    tags: [
      { zh: "塔", "zh-Hant": "塔", en: "Tower", fr: "Tour", ja: "塔" },
      { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" },
      { zh: "钢架", "zh-Hant": "鋼架", en: "Steel Frame", fr: "Cadre en acier", ja: "鉄骨" },
      { zh: "线条", "zh-Hant": "線條", en: "Lines", fr: "Lignes", ja: "線" }
    ],
    src: "https://live.staticflickr.com/65535/55043514715_69361e1566_b.jpg",
    alt: { zh: "东京塔近距离视角下的钢结构细节，橙色钢架以倾斜角度交错展开", "zh-Hant": "東京鐵塔近距離視角下的鋼結構細節，橙色鋼架以傾斜角度交錯展開", en: "Steel structure details of Tokyo Tower from close-up, orange steel frames crisscrossing at diagonal angles", fr: "Détails de la structure en acier de la tour de Tokyo en gros plan, cadres en acier orange se croisant en diagonale", ja: "近距離視点からの東京タワーの鉄骨構造の詳細、オレンジ色の鉄骨が斜めの角度で交差する" },
    width: 1956,
    height: 3475
  }),
  makePhoto({
    id: "hanabi-scatter",
    title: { zh: "散落", "zh-Hant": "散落", en: "Scatter", fr: "Dispersion", ja: "散華" },
    date: "2025-05-28",
    category: { zh: "旅行", "zh-Hant": "旅行", en: "Travel", fr: "Voyage", ja: "旅行" },
    location: { zh: "东京·江户川花火大会", "zh-Hant": "東京·江戶川花火大會", en: "Tokyo, Edogawa Fireworks Festival", fr: "Tokyo, Festival de feux d'artifice d'Edogawa", ja: "東京・江戸川花火大会" },
    camera: "Canon R5",
    lens: "RF 70-200mm f/2.8L IS USM",
    settings: "1/200 · f/2.8 · ISO 100",
    description: { zh: "花火散作一片金雨，夜空把余烬慢慢收拢。", "zh-Hant": "花火散作一片金雨，夜空把餘燼慢慢收攏。", en: "Fireworks scatter into a golden rain, the night sky slowly gathering the embers.", fr: "Les feux d'artifice se dispersent en une pluie dorée, le ciel nocturne rassemblant lentement les braises.", ja: "花火が金色の雨として散り、夜空が余燼をゆっくりと集める。" },
    tags: [
      { zh: "花火", "zh-Hant": "花火", en: "Fireworks", fr: "Feux d'artifice", ja: "花火" },
      { zh: "夜", "zh-Hant": "夜", en: "Night", fr: "Nuit", ja: "夜" },
      { zh: "金", "zh-Hant": "金", en: "Gold", fr: "Or", ja: "金" },
      { zh: "余烬", "zh-Hant": "餘燼", en: "Embers", fr: "Braises", ja: "余燼" }
    ],
    src: "https://live.staticflickr.com/65535/55043010302_4306a5b7f3_b.jpg",
    alt: { zh: "夜空中大片金色烟花与余烬散开，底部可见烟雾与光痕", "zh-Hant": "夜空中大片金色煙花與餘燼散開，底部可見煙霧與光痕", en: "Large golden fireworks and embers scattering in the night sky, smoke and light trails visible at bottom", fr: "Grands feux d'artifice dorés et braises se dispersant dans le ciel nocturne, fumée et traînées lumineuses visibles en bas", ja: "夜空に大きく金色の花火と余燼が散らばり、底部に煙と光跡が見える" },
    width: 6000,
    height: 4000
  }),
makePhoto({
  id: "shinjuku-redlight",
  title: { zh: "红灯", "zh-Hant": "紅燈", en: "Red Light", fr: "Feu rouge", ja: "赤信号" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京·新宿", "zh-Hant": "東京·新宿", en: "Tokyo, Shinjuku", fr: "Tokyo, Shinjuku", ja: "東京・新宿" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "红灯悬在空中，电线与铁架把城市拉紧。", "zh-Hant": "紅燈懸在空中，電線與鐵架把城市拉緊。", en: "Red lights hang in the air, wires and steel frames pulling the city taut.", fr: "Les feux rouges pendent dans l'air, les fils et cadres en acier tirant la ville.", ja: "赤信号が空中に吊るされ、電線と鉄骨が都市を引き締める。" },
  tags: [
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" },
    { zh: "电线", "zh-Hant": "電線", en: "Wires", fr: "Fils", ja: "電線" },
    { zh: "红灯", "zh-Hant": "紅燈", en: "Red Light", fr: "Feu rouge", ja: "赤信号" }
  ],
  src: "https://live.staticflickr.com/65535/55044251290_590220a5c9_b.jpg",
  alt: { zh: "新宿路口的红色交通信号灯悬挂在密集电线与高架结构之间", "zh-Hant": "新宿路口的紅色交通信號燈懸掛在密集電線與高架結構之間", en: "Red traffic lights at Shinjuku intersection hanging among dense wires and elevated structures", fr: "Feux de circulation rouges au carrefour de Shinjuku suspendus parmi fils denses et structures élevées", ja: "新宿交差点の赤い交通信号灯が密集した電線と高架構造の間に吊るされている" },
  width: 8192,
  height: 5464
}),
makePhoto({
  id: "tokyo-facade",
  title: { zh: "立面", "zh-Hant": "立面", en: "Facade", fr: "Façade", ja: "ファサード" },
  date: "2025-05-26",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "建筑在画面一侧停下，天空接管了剩余空间。", "zh-Hant": "建築在畫面一側停下，天空接管了剩餘空間。", en: "The building stops on one side of the frame, sky taking over the remaining space.", fr: "Le bâtiment s'arrête sur un côté du cadre, le ciel prenant le reste de l'espace.", ja: "建物が画面の片側で止まり、空が残りの空間を引き継ぐ。" },
  tags: [
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "建筑", "zh-Hant": "建築", en: "Building", fr: "Bâtiment", ja: "建築" },
    { zh: "立面", "zh-Hant": "立面", en: "Facade", fr: "Façade", ja: "ファサード" },
    { zh: "留白", "zh-Hant": "留白", en: "Negative Space", fr: "Espace négatif", ja: "余白" }
  ],
  src: "https://live.staticflickr.com/65535/55044172949_20cbd93dfd_b.jpg",
  alt: { zh: "东京城市中一栋高层建筑的立面占据画面一侧，另一侧是大面积天空留白", "zh-Hant": "東京城市中一棟高層建築的立面佔據畫面一側，另一側是大面積天空留白", en: "A high-rise building facade in Tokyo occupying one side of frame, large negative space of sky on the other", fr: "La façade d'un gratte-ciel à Tokyo occupant un côté du cadre, grand espace négatif de ciel de l'autre", ja: "東京の高層建築のファサードが画面の片側を占め、もう片側は大きな空の余白" },
  width: 7977,
  height: 5321
}),
makePhoto({
  id: "kabukicho-gate",
  title: { zh: "歌舞伎町", "zh-Hant": "歌舞伎町", en: "Kabukicho", fr: "Kabukicho", ja: "歌舞伎町" },
  date: "2025-05-28",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 歌舞伎町一番街", "zh-Hant": "東京·歌舞伎町一番街", en: "Tokyo, Kabukicho Ichibangai", fr: "Tokyo, Kabukicho Ichibangai", ja: "東京・歌舞伎町一番街" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "城市在这里收紧，灯牌与规则同时亮起。", "zh-Hant": "城市在這裡收緊，燈牌與規則同時亮起。", en: "The city tightens here, signs and rules lighting up together.", fr: "La ville se resserre ici, enseignes et règles s'allumant ensemble.", ja: "都市がここで引き締まり、看板と規則が同時に灯る。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "歌舞伎町", "zh-Hant": "歌舞伎町", en: "Kabukicho", fr: "Kabukicho", ja: "歌舞伎町" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "街道", "zh-Hant": "街道", en: "Street", fr: "Rue", ja: "通り" },
    { zh: "标识", "zh-Hant": "標識", en: "Signs", fr: "Enseignes", ja: "標識" }
  ],
  src: "https://live.staticflickr.com/65535/55044172954_5dc1d2cfc7_b.jpg",
  alt: { zh: "东京歌舞伎町一番街入口，红色拱门与密集招牌构成的城市街景", "zh-Hant": "東京歌舞伎町一番街入口，紅色拱門與密集招牌構成的城市街景", en: "Entrance to Kabukicho Ichibangai in Tokyo, red arch and dense signage forming urban streetscape", fr: "Entrée de Kabukicho Ichibangai à Tokyo, arche rouge et enseignes denses formant le paysage urbain", ja: "東京歌舞伎町一番街の入口、赤いアーチと密集した看板が作る都市の街景" },
  width: 5464,
  height: 8192
}),
makePhoto({
  id: "shibuya-stability",
  title: { zh: "晴空2", "zh-Hant": "晴空2", en: "Clear Sky 2", fr: "Ciel clair 2", ja: "晴空2" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 涩谷 Sky", "zh-Hant": "東京·澀谷Sky", en: "Tokyo, Shibuya Sky", fr: "Tokyo, Shibuya Sky", ja: "東京・渋谷スカイ" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "结构归位，城市保持沉默。", "zh-Hant": "結構歸位，城市保持沉默。", en: "Structure settles in place, the city remains silent.", fr: "La structure se met en place, la ville reste silencieuse.", ja: "構造が所定の位置に収まり、都市は沈黙を保つ。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "涩谷", "zh-Hant": "澀谷", en: "Shibuya", fr: "Shibuya", ja: "渋谷" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "天际线", "zh-Hant": "天際線", en: "Skyline", fr: "Ligne d'horizon", ja: "スカイライン" },
    { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" }
  ],
  src: "https://live.staticflickr.com/65535/55044173069_9d8e5732ee_b.jpg",
  alt: { zh: "东京城市天际线，远处晴天塔立于高楼群中，天空开阔", "zh-Hant": "東京城市天際線，遠處晴空塔立於高樓群中，天空開闊", en: "Tokyo city skyline, Skytree standing among high-rises in the distance, open sky", fr: "Ligne d'horizon de Tokyo, Skytree debout parmi les gratte-ciel au loin, ciel ouvert", ja: "東京の都市のスカイライン、遠くの高層ビル群の中にスカイツリーが立ち、空が開けている" },
  width: 5030,
  height: 7541
}),
makePhoto({
  id: "shibuya-sky-arena",
  title: { zh: "东京折叠", "zh-Hant": "東京摺疊", en: "Folded Tokyo", fr: "Tokyo plié", ja: "東京折り畳み" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 涩谷 Sky", "zh-Hant": "東京·澀谷Sky", en: "Tokyo, Shibuya Sky", fr: "Tokyo, Shibuya Sky", ja: "東京・渋谷スカイ" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "密集建筑向外扩散，场馆位于其中，像一枚被城市包裹的核心。", "zh-Hant": "密集建築向外擴散，場館位於其中，像一枚被城市包裹的核心。", en: "Dense buildings spread outward, the stadium at the center, like a core wrapped by the city.", fr: "Bâtiments denses se dispersant vers l'extérieur, le stade au centre, comme un noyau enveloppé par la ville.", ja: "密集した建物が外へ広がり、スタジアムがその中心にあり、都市に包まれた核のよう。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "涩谷", "zh-Hant": "澀谷", en: "Shibuya", fr: "Shibuya", ja: "渋谷" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "城市结构", "zh-Hant": "城市結構", en: "Urban Structure", fr: "Structure urbaine", ja: "都市構造" },
    { zh: "天际线", "zh-Hant": "天際線", en: "Skyline", fr: "Ligne d'horizon", ja: "スカイライン" }
  ],
  src: "https://live.staticflickr.com/65535/55044090638_f7096439a9_b.jpg",
  alt: { zh: "从高空俯瞰东京城市景观，密集建筑之间，一座大型圆形体育场位于画面中央", "zh-Hant": "從高空俯瞰東京城市景觀，密集建築之間，一座大型圓形體育場位於畫面中央", en: "Aerial view of Tokyo cityscape, large circular stadium at the center among dense buildings", fr: "Vue aérienne du paysage urbain de Tokyo, grand stade circulaire au centre parmi les bâtiments denses", ja: "東京の都市景観を空から俯瞰、密集した建物の中央に大きな円形スタジアムが位置する" },
  width: 4986,
  height: 7475
}),
makePhoto({
  id: "shinjuku-red-light",
  title: { zh: "人流", "zh-Hant": "人流", en: "Flow of People", fr: "Flux de personnes", ja: "人の流れ" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 新宿", "zh-Hant": "東京·新宿", en: "Tokyo, Shinjuku", fr: "Tokyo, Shinjuku", ja: "東京・新宿" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "红灯悬在街口，人群被短暂收拢。街道不说话，只负责把人送往下一个方向。", "zh-Hant": "紅燈懸在街口，人群被短暫收攏。街道不說話，只負責把人送往下一個方向。", en: "Red light hangs at the intersection, crowds briefly gathered. The street says nothing, only sends people toward the next direction.", fr: "Le feu rouge pend au carrefour, les foules brièvement rassemblées. La rue ne dit rien, elle envoie seulement les gens vers la prochaine direction.", ja: "赤信号が交差点に吊るされ、人々が一時的に集まる。通りは何も言わず、ただ人々を次の方向へ送るだけ。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "新宿", "zh-Hant": "新宿", en: "Shinjuku", fr: "Shinjuku", ja: "新宿" },
    { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "街頭" },
    { zh: "人群", "zh-Hant": "人群", en: "Crowd", fr: "Foule", ja: "人混み" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" }
  ],
  src: "https://live.staticflickr.com/65535/55043913291_48fde29d38_b.jpg",
  alt: { zh: "东京新宿街头十字路口，人群在红灯下穿行，城市街道纵深延伸", "zh-Hant": "東京新宿街頭十字路口，人群在紅燈下穿行，城市街道縱深延伸", en: "Shinjuku intersection in Tokyo, crowds crossing under red light, urban streets extending in depth", fr: "Carrefour de Shinjuku à Tokyo, foules traversant sous le feu rouge, rues urbaines s'étendant en profondeur", ja: "東京新宿の街頭交差点、赤信号の下を人々が横断し、都市の通りが奥行きを持って延びる" },
  width: 4805,
  height: 7204
}),
makePhoto({
  id: "yoyogi-raven",
  title: { zh: "停留", "zh-Hant": "停留", en: "Perch", fr: "Perché", ja: "留まる" },
  date: "2025-05-27",
  category: { zh: "自然", "zh-Hant": "自然", en: "Nature", fr: "Nature", ja: "自然" },
  location: { zh: "东京 · 代代木公园", "zh-Hant": "東京·代代木公園", en: "Tokyo, Yoyogi Park", fr: "Tokyo, Parc Yoyogi", ja: "東京・代々木公園" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "黑羽停在木栏上，风声被树叶吸收，时间短暂地放慢。", "zh-Hant": "黑羽停在木欄上，風聲被樹葉吸收，時間短暫地放慢。", en: "Black feathers perch on the wooden fence, wind absorbed by leaves, time briefly slowing.", fr: "Plumes noires perchées sur la clôture en bois, le vent absorbé par les feuilles, le temps ralentissant brièvement.", ja: "黒い羽が木柵に止まり、風の音が葉に吸収され、時間が一瞬遅くなる。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "代代木公园", "zh-Hant": "代代木公園", en: "Yoyogi Park", fr: "Parc Yoyogi", ja: "代々木公園" },
    { zh: "自然", "zh-Hant": "自然", en: "Nature", fr: "Nature", ja: "自然" },
    { zh: "鸟", "zh-Hant": "鳥", en: "Bird", fr: "Oiseau", ja: "鳥" },
    { zh: "静态", "zh-Hant": "靜態", en: "Stillness", fr: "Immobilité", ja: "静止" }
  ],
  src: "https://live.staticflickr.com/65535/55043015232_fbc25b17c1_b.jpg",
  alt: { zh: "代代木公园中，一只黑色乌鸦停在木质围栏上，背景是模糊的绿色植被", "zh-Hant": "代代木公園中，一隻黑色烏鴉停在木質圍欄上，背景是模糊的綠色植被", en: "A black crow perched on wooden fence in Yoyogi Park, blurred green vegetation in background", fr: "Un corbeau noir perché sur une clôture en bois au parc Yoyogi, végétation verte floue en arrière-plan", ja: "代々木公園で木製柵に止まった黒いカラス、背景はぼやけた緑の植生" },
  width: 5349,
  height: 8019
}),
makePhoto({
  id: "tokyo-night-anchor",
  title: { zh: "东京印象", "zh-Hant": "東京印象", en: "Tokyo Impression", fr: "Impression de Tokyo", ja: "東京の印象" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 涩谷 Sky", "zh-Hant": "東京·澀谷Sky", en: "Tokyo, Shibuya Sky", fr: "Tokyo, Shibuya Sky", ja: "東京・渋谷スカイ" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/100 · f/2.8 · ISO 2000",
  description: { zh: "灯光铺开城市，东京塔独一无二。", "zh-Hant": "燈光鋪開城市，東京鐵塔獨一無二。", en: "Lights spread across the city, Tokyo Tower stands unique.", fr: "Les lumières se répandent dans la ville, la tour de Tokyo se tient unique.", ja: "灯りが都市に広がり、東京タワーが唯一無二に立つ。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "涩谷", "zh-Hant": "澀谷", en: "Shibuya", fr: "Shibuya", ja: "渋谷" },
    { zh: "夜景", "zh-Hant": "夜景", en: "Night View", fr: "Vue nocturne", ja: "夜景" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "天际线", "zh-Hant": "天際線", en: "Skyline", fr: "Ligne d'horizon", ja: "スカイライン" }
  ],
  src: "https://live.staticflickr.com/65535/55043913236_6c5e305d75_b.jpg",
  alt: { zh: "夜色中的东京城市天际线，东京塔亮起橙色灯光，周围高楼密集延展", "zh-Hant": "夜色中的東京城市天際線，東京鐵塔亮起橙色燈光，周圍高樓密集延展", en: "Tokyo city skyline at night, Tokyo Tower lit in orange, dense high-rises extending around", fr: "Ligne d'horizon de Tokyo la nuit, tour de Tokyo éclairée en orange, gratte-ciel denses s'étendant autour", ja: "夜の東京の都市のスカイライン、東京タワーがオレンジ色に点灯し、周りに密集した高層ビルが延びる" },
  width: 8098,
  height: 5401
}),
makePhoto({
  id: "shibuya-rail-corridor",
  title: { zh: "轨道切片", "zh-Hant": "軌道切片", en: "Rail Corridor", fr: "Corridor ferroviaire", ja: "軌道断面" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 涩谷 Sky", "zh-Hant": "東京·澀谷Sky", en: "Tokyo, Shibuya Sky", fr: "Tokyo, Shibuya Sky", ja: "東京・渋谷スカイ" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "城市被纵向剖开，流动被压缩为一条可追踪的轨迹。", "zh-Hant": "城市被縱向剖開，流動被壓縮為一條可追蹤的軌跡。", en: "The city sliced lengthwise, flow compressed into a traceable line.", fr: "La ville tranchée dans le sens de la longueur, le flux comprimé en une ligne traçable.", ja: "都市が縦に切り開かれ、流れが追跡可能な一本の軌跡に圧縮される。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "涩谷", "zh-Hant": "澀谷", en: "Shibuya", fr: "Shibuya", ja: "渋谷" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "铁路", "zh-Hant": "鐵路", en: "Railway", fr: "Chemin de fer", ja: "鉄道" },
    { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" },
    { zh: "俯瞰", "zh-Hant": "俯瞰", en: "Aerial View", fr: "Vue aérienne", ja: "俯瞰" }
  ],
  src: "https://live.staticflickr.com/65535/55044173029_fe8a3fc096_b.jpg",
  alt: { zh: "从高空俯瞰东京城市建筑群，铁路纵向贯穿密集街区，结构清晰", "zh-Hant": "從高空俯瞰東京城市建築群，鐵路縱向貫穿密集街區，結構清晰", en: "Aerial view of Tokyo cityscape, railway running lengthwise through dense urban blocks, structure clear", fr: "Vue aérienne du paysage urbain de Tokyo, chemin de fer traversant longitudinalement les quartiers urbains denses, structure claire", ja: "東京の都市景観を空から俯瞰、鉄道が密集した街区を縦方向に貫通し、構造が明確" },
  width: 4028,
  height: 6039
}),
makePhoto({
  id: "shinjuku-crossing-day",
  title: { zh: "通行中", "zh-Hant": "通行中", en: "Crossing", fr: "Traversée", ja: "通行中" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 新宿", "zh-Hant": "東京·新宿", en: "Tokyo, Shinjuku", fr: "Tokyo, Shinjuku", ja: "東京・新宿" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "红灯悬停，时间被短暂按下暂停键，人流继续向前。", "zh-Hant": "紅燈懸停，時間被短暫按下暫停鍵，人流繼續向前。", en: "Red light hovers, time briefly paused, the flow of people continues forward.", fr: "Le feu rouge plane, le temps brièvement mis en pause, le flux de personnes continue.", ja: "赤信号が浮かび、時間が一時停止され、人の流れが前へ続く。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "新宿", "zh-Hant": "新宿", en: "Shinjuku", fr: "Shinjuku", ja: "新宿" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "街头", "zh-Hant": "街頭", en: "Street", fr: "Rue", ja: "街頭" },
    { zh: "人群", "zh-Hant": "人群", en: "Crowd", fr: "Foule", ja: "人混み" },
    { zh: "秩序", "zh-Hant": "秩序", en: "Order", fr: "Ordre", ja: "秩序" }
  ],
  src: "https://live.staticflickr.com/65535/55043913206_e8eb1ca5db_b.jpg",
  alt: { zh: "东京新宿街头白天，人群在斑马线穿行，城市街道与高楼构成背景", "zh-Hant": "東京新宿街頭白天，人群在斑馬線穿行，城市街道與高樓構成背景", en: "Daytime Shinjuku street in Tokyo, crowds crossing at zebra crossing, city streets and high-rises forming background", fr: "Rue de Shinjuku à Tokyo de jour, foules traversant au passage piéton, rues urbaines et gratte-ciel en arrière-plan", ja: "東京新宿の街頭の日中、人々が横断歩道を渡り、都市の通りと高層ビルが背景を形成する" },
  width: 5358,
  height: 8033
}),
makePhoto({
  id: "skytree-night-axis",
  title: { zh: "夜轴", "zh-Hant": "夜軸", en: "Night Axis", fr: "Axe nocturne", ja: "夜の軸" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 涩谷 Sky", "zh-Hant": "東京·澀谷Sky", en: "Tokyo, Shibuya Sky", fr: "Tokyo, Shibuya Sky", ja: "東京・渋谷スカイ" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/100 · f/2.8 · ISO 2000",
  description: { zh: "灯光收束成一条垂直的轴线，城市在其下方缓慢呼吸。", "zh-Hant": "燈光收束成一條垂直的軸線，城市在其下方緩慢呼吸。", en: "Lights converge into a vertical axis, the city breathing slowly beneath.", fr: "Les lumières convergent en un axe vertical, la ville respirant lentement en dessous.", ja: "灯りが垂直の軸に収束し、その下で都市がゆっくりと呼吸する。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "涩谷", "zh-Hant": "澀谷", en: "Shibuya", fr: "Shibuya", ja: "渋谷" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "夜景", "zh-Hant": "夜景", en: "Night View", fr: "Vue nocturne", ja: "夜景" },
    { zh: "天际线", "zh-Hant": "天際線", en: "Skyline", fr: "Ligne d'horizon", ja: "スカイライン" },
    { zh: "结构", "zh-Hant": "結構", en: "Structure", fr: "Structure", ja: "構造" }
  ],
  src: "https://live.staticflickr.com/65535/55044172964_fd5f6f9b51_b.jpg",
  alt: { zh: "东京夜晚城市天际线，晴空塔在远处垂直升起，灯光成为画面中心轴线", "zh-Hant": "東京夜晚城市天際線，晴空塔在遠處垂直升起，燈光成為畫面中心軸線", en: "Tokyo night city skyline, Skytree rising vertically in distance, lights forming central axis of frame", fr: "Ligne d'horizon de Tokyo de nuit, Skytree s'élevant verticalement au loin, lumières formant l'axe central du cadre", ja: "東京の夜の都市スカイライン、遠くにスカイツリーが垂直に立ち上がり、灯りが画面の中心軸を形成する" },
  width: 5098,
  height: 7644
}),
makePhoto({
  id: "tokyo-tower-anchor",
  title: { zh: "夜塔", "zh-Hant": "夜塔", en: "Night Tower", fr: "Tour nocturne", ja: "夜の塔" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 涩谷 Sky", "zh-Hant": "東京·澀谷Sky", en: "Tokyo, Shibuya Sky", fr: "Tokyo, Shibuya Sky", ja: "東京・渋谷スカイ" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "橙色的光把城市钉在夜里，塔是唯一不需要解释的存在。", "zh-Hant": "橙色的光把城市釘在夜裡，塔是唯一不需要解釋的存在。", en: "Orange light pins the city to the night, the tower the only presence needing no explanation.", fr: "La lumière orange épingle la ville à la nuit, la tour la seule présence ne nécessitant aucune explication.", ja: "オレンジの光が都市を夜に固定し、塔は説明を必要としない唯一の存在。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "东京塔", "zh-Hant": "東京鐵塔", en: "Tokyo Tower", fr: "Tour de Tokyo", ja: "東京タワー" },
    { zh: "夜景", "zh-Hant": "夜景", en: "Night View", fr: "Vue nocturne", ja: "夜景" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "天际线", "zh-Hant": "天際線", en: "Skyline", fr: "Ligne d'horizon", ja: "スカイライン" },
    { zh: "中心", "zh-Hant": "中心", en: "Center", fr: "Centre", ja: "中心" }
  ],
  src: "https://live.staticflickr.com/65535/55044090528_f8163ff9ac_b.jpg",
  alt: { zh: "夜晚的东京城市天际线，东京塔在城市中央亮起橙色灯光，周围建筑沉入黑暗", "zh-Hant": "夜晚的東京城市天際線，東京鐵塔在城市中央亮起橙色燈光，周圍建築沉入黑暗", en: "Tokyo night city skyline, Tokyo Tower lit in orange at city center, surrounding buildings sinking into darkness", fr: "Ligne d'horizon de Tokyo de nuit, tour de Tokyo éclairée en orange au centre de la ville, bâtiments environnants plongeant dans l'obscurité", ja: "東京の夜の都市スカイライン、都市の中心で東京タワーがオレンジ色に点灯し、周囲の建物が暗闇に沈む" },
  width: 5042,
  height: 7532
}),
makePhoto({
  id: "night-city-2077",
  title: { zh: "夜之城", "zh-Hant": "夜之城", en: "Night City", fr: "Ville nocturne", ja: "ナイトシティ" },
  date: "2025-05-27",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "东京 · 涩谷 Sky", "zh-Hant": "東京·澀谷Sky", en: "Tokyo, Shibuya Sky", fr: "Tokyo, Shibuya Sky", ja: "東京・渋谷スカイ" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "城市不再属于白天。光源分布决定秩序，夜晚接管一切。", "zh-Hant": "城市不再屬於白天。光源分佈決定秩序，夜晚接管一切。", en: "The city no longer belongs to day. Light distribution determines order, night takes over everything.", fr: "La ville n'appartient plus au jour. La distribution de lumière détermine l'ordre, la nuit prend le contrôle de tout.", ja: "都市はもはや昼に属さない。光源の配置が秩序を決定し、夜がすべてを支配する。" },
  tags: [
    { zh: "东京", "zh-Hant": "東京", en: "Tokyo", fr: "Tokyo", ja: "東京" },
    { zh: "涩谷", "zh-Hant": "澀谷", en: "Shibuya", fr: "Shibuya", ja: "渋谷" },
    { zh: "夜景", "zh-Hant": "夜景", en: "Night View", fr: "Vue nocturne", ja: "夜景" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "天际线", "zh-Hant": "天際線", en: "Skyline", fr: "Ligne d'horizon", ja: "スカイライン" },
    { zh: "夜之城", "zh-Hant": "夜之城", en: "Night City", fr: "Ville nocturne", ja: "ナイトシティ" }
  ],
  src: "https://live.staticflickr.com/65535/55043913191_40263e142f_b.jpg",
  alt: { zh: "夜晚俯瞰东京城市天际线，密集建筑在冷色灯光下延展，呈现出赛博朋克氛围的夜之城", "zh-Hant": "夜晚俯瞰東京城市天際線，密集建築在冷色燈光下延展，呈現出賽博朋克氛圍的夜之城", en: "Aerial night view of Tokyo skyline, dense buildings extending under cool-toned lights, presenting a cyberpunk-atmosphere night city", fr: "Vue aérienne nocturne de la ligne d'horizon de Tokyo, bâtiments denses s'étendant sous des lumières aux tons froids, présentant une ville nocturne à l'atmosphère cyberpunk", ja: "東京のスカイラインを夜に空から俯瞰、密集した建物が冷色の灯りの下に延び、サイバーパンク的雰囲気のナイトシティを呈する" },
  width: 8192,
  height: 5464
}),
makePhoto({
  id: "beijing-ornament-001",
  title: { zh: "檐下", "zh-Hant": "簷下", en: "Under the Eaves", fr: "Sous l'avant-toit", ja: "軒下" },
  date: "2023-08-28",
  category: { zh: "建筑", "zh-Hant": "建築", en: "Architecture", fr: "Architecture", ja: "建築" },
  location: { zh: "北京 · 北海公园", "zh-Hant": "北京·北海公園", en: "Beijing, Beihai Park", fr: "Pékin, Parc Beihai", ja: "北京・北海公園" },
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: { zh: "装饰先于空间存在。结构不为进入而建，而是为被观看而保存。", "zh-Hant": "裝飾先於空間存在。結構不為進入而建，而是為被觀看而保存。", en: "Decoration precedes space. Structure built not for entry, but preserved for observation.", fr: "La décoration précède l'espace. La structure n'est pas construite pour l'entrée, mais préservée pour l'observation.", ja: "装飾が空間に先立つ。構造は入るためではなく、観られるために保存される。" },
  tags: [
    { zh: "北京", "zh-Hant": "北京", en: "Beijing", fr: "Pékin", ja: "北京" },
    { zh: "传统建筑", "zh-Hant": "傳統建築", en: "Traditional Architecture", fr: "Architecture traditionnelle", ja: "伝統建築" },
    { zh: "中式园林", "zh-Hant": "中式園林", en: "Chinese Garden", fr: "Jardin chinois", ja: "中国庭園" },
    { zh: "纹样", "zh-Hant": "紋樣", en: "Patterns", fr: "Motifs", ja: "文様" },
    { zh: "雕刻", "zh-Hant": "雕刻", en: "Carving", fr: "Sculpture", ja: "彫刻" },
    { zh: "屋檐", "zh-Hant": "屋簷", en: "Eaves", fr: "Avant-toit", ja: "軒" }
  ],
  src: "https://live.staticflickr.com/65535/55044091858_464fbbe0fc_b.jpg",
  alt: { zh: "北京传统园林建筑细节，红褐色木石纹样与屋檐结构交错，匾额居中，装饰密集而克制", "zh-Hant": "北京傳統園林建築細節，紅褐色木石紋樣與屋簷結構交錯，匾額居中，裝飾密集而克制", en: "Traditional Chinese garden architecture detail in Beijing, reddish-brown wood and stone patterns interwoven with eave structure, plaque centered, decoration dense yet restrained", fr: "Détail d'architecture de jardin traditionnel chinois à Pékin, motifs de bois et de pierre brun-rouge entrelacés avec la structure de l'avant-toit, plaque centrée, décoration dense mais sobre", ja: "北京の伝統的な庭園建築の詳細、赤褐色の木と石の文様が軒構造と交錯し、扁額が中央にあり、装飾は密集しつつ抑制されている" },
  width: 4815,
  height: 3225
}),
makePhoto({
  id: "beijing-temple-002",
  title: { zh: "皇穹宇", "zh-Hant": "皇穹宇", en: "Imperial Vault of Heaven", fr: "Voûte impériale du ciel", ja: "皇穹宇" },
  date: "2023-08-29",
  category: { zh: "建筑", "zh-Hant": "建築", en: "Architecture", fr: "Architecture", ja: "建築" },
  location: { zh: "北京 · 天坛 · 皇穹宇", "zh-Hant": "北京 · 天壇 · 皇穹宇", en: "Beijing, Temple of Heaven, Imperial Vault of Heaven", fr: "Pékin, Temple du Ciel, Voûte impériale du ciel", ja: "北京・天壇・皇穹宇" },
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: { zh: "穹顶向天收拢，秩序在装饰中完成闭合。", "zh-Hant": "穹頂向天收攏，秩序在裝飾中完成閉合。", en: "The dome converges toward the sky, order completing its closure within decoration.", fr: "Le dôme converge vers le ciel, l'ordre achevant sa fermeture dans la décoration.", ja: "丸屋根が天に向かって収束し、秩序が装飾の中で閉じられる。" },
  tags: [
    { zh: "北京", "zh-Hant": "北京", en: "Beijing", fr: "Pékin", ja: "北京" },
    { zh: "天坛", "zh-Hant": "天壇", en: "Temple of Heaven", fr: "Temple du Ciel", ja: "天壇" },
    { zh: "皇穹宇", "zh-Hant": "皇穹宇", en: "Imperial Vault", fr: "Voûte impériale", ja: "皇穹宇" },
    { zh: "传统建筑", "zh-Hant": "傳統建築", en: "Traditional Architecture", fr: "Architecture traditionnelle", ja: "伝統建築" },
    { zh: "对称", "zh-Hant": "對稱", en: "Symmetry", fr: "Symétrie", ja: "対称" },
    { zh: "穹顶", "zh-Hant": "穹頂", en: "Dome", fr: "Dôme", ja: "丸屋根" }
  ],
  src: "https://live.staticflickr.com/65535/55044252685_dd0f2292d1_b.jpg",
  alt: { zh: "北京天坛皇穹宇建筑仰视视角，圆形屋顶与金色宝顶在阴云天空下形成强烈对比", "zh-Hant": "北京天壇皇穹宇建築仰視視角，圓形屋頂與金色寶頂在陰雲天空下形成強烈對比", en: "Upward view of Imperial Vault of Heaven at Temple of Heaven in Beijing, circular roof and golden finial forming strong contrast against overcast sky", fr: "Vue en contre-plongée de la Voûte impériale du ciel au Temple du Ciel à Pékin, toit circulaire et fleuron doré formant un contraste fort contre le ciel nuageux", ja: "北京天壇皇穹宇の建築を仰ぎ見る視点、円形屋根と金色の宝珠が曇り空に対して強いコントラストを形成する" },
  width: 6000,
  height: 4000
}),
makePhoto({
  id: "beijing-temple-003",
  title: { zh: "敬天", "zh-Hant": "敬天", en: "Revere Heaven", fr: "Révérer le ciel", ja: "天を敬う" },
  date: "2023-08-28",
  category: { zh: "建筑", "zh-Hant": "建築", en: "Architecture", fr: "Architecture", ja: "建築" },
  location: { zh: "北京 · 天坛", "zh-Hant": "北京 · 天壇", en: "Beijing, Temple of Heaven", fr: "Pékin, Temple du Ciel", ja: "北京・天壇" },
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: { zh: "文字被置于结构之后，信仰通过遮挡而成立。", "zh-Hant": "文字被置於結構之後，信仰透過遮擋而成立。", en: "Text placed behind structure, faith established through obstruction.", fr: "Le texte placé derrière la structure, la foi établie par l'obstruction.", ja: "文字が構造の後ろに置かれ、信仰は遮蔽を通じて成立する。" },
  tags: [
    { zh: "北京", "zh-Hant": "北京", en: "Beijing", fr: "Pékin", ja: "北京" },
    { zh: "天坛", "zh-Hant": "天壇", en: "Temple of Heaven", fr: "Temple du Ciel", ja: "天壇" },
    { zh: "敬天", "zh-Hant": "敬天", en: "Revere Heaven", fr: "Révérer le ciel", ja: "天を敬う" },
    { zh: "传统建筑", "zh-Hant": "傳統建築", en: "Traditional Architecture", fr: "Architecture traditionnelle", ja: "伝統建築" },
    { zh: "符号", "zh-Hant": "符號", en: "Symbol", fr: "Symbole", ja: "記号" },
    { zh: "仪式", "zh-Hant": "儀式", en: "Ritual", fr: "Rituel", ja: "儀式" }
  ],
  src: "https://live.staticflickr.com/65535/55044252690_499b14e103_b.jpg",
  alt: { zh: "通过石雕构件框取天坛匾额文字，前景粗粝、背景虚化，形成强烈层次对比", "zh-Hant": "透過石雕構件框取天壇匾額文字，前景粗礪、背景虛化，形成強烈層次對比", en: "Temple of Heaven plaque characters framed through stone carved elements, rough foreground and blurred background forming strong layered contrast", fr: "Caractères de la plaque du Temple du Ciel cadrés à travers des éléments sculptés en pierre, premier plan rugueux et arrière-plan flou formant un contraste de couches fort", ja: "石彫りの構成要素を通して天壇の扁額の文字を額縁のように捉え、粗い前景とぼやけた背景が強い層のコントラストを形成する" },
  width: 6000,
  height: 4000
}),
makePhoto({
  id: "kunming-haigeng-004",
  title: { zh: "冬日", "zh-Hant": "冬日", en: "Winter Day", fr: "Jour d'hiver", ja: "冬の日" },
  date: "2024-01-22",
  category: { zh: "自然", "zh-Hant": "自然", en: "Nature", fr: "Nature", ja: "自然" },
  location: { zh: "昆明 · 海埂大坝", "zh-Hant": "昆明 · 海埂大壩", en: "Kunming, Haigeng Dam", fr: "Kunming, Barrage Haigeng", ja: "昆明・海埂ダム" },
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: { zh: "颜色先于季节抵达，天空为它让出位置。", "zh-Hant": "顏色先於季節抵達，天空為它讓出位置。", en: "Color arrives before season, sky yielding space for it.", fr: "La couleur arrive avant la saison, le ciel lui cédant la place.", ja: "色が季節より先に到着し、空がそのために場所を譲る。" },
  tags: [
    { zh: "昆明", "zh-Hant": "昆明", en: "Kunming", fr: "Kunming", ja: "昆明" },
    { zh: "海埂大坝", "zh-Hant": "海埂大壩", en: "Haigeng Dam", fr: "Barrage Haigeng", ja: "海埂ダム" },
    { zh: "花", "zh-Hant": "花", en: "Flowers", fr: "Fleurs", ja: "花" },
    { zh: "色彩", "zh-Hant": "色彩", en: "Color", fr: "Couleur", ja: "色彩" },
    { zh: "季节错位", "zh-Hant": "季節錯位", en: "Seasonal Shift", fr: "Décalage saisonnier", ja: "季節のずれ" },
    { zh: "天空", "zh-Hant": "天空", en: "Sky", fr: "Ciel", ja: "空" }
  ],
  src: "https://live.staticflickr.com/65535/55044174239_11172e25b1_b.jpg",
  alt: { zh: "深蓝天空下盛开的红色花树，自下而上伸展，占据画面下半部，形成强烈色彩对比", "zh-Hant": "深藍天空下盛開的紅色花樹，自下而上伸展，佔據畫面下半部，形成強烈色彩對比", en: "Red flowering tree in bloom under deep blue sky, stretching upward from below, occupying lower half of frame, forming strong color contrast", fr: "Arbre à fleurs rouges en fleur sous un ciel bleu profond, s'étirant vers le haut depuis le bas, occupant la moitié inférieure du cadre, formant un contraste de couleurs fort", ja: "深い青空の下で咲く赤い花の木、下から上へ伸び、画面の下半分を占め、強い色のコントラストを形成する" },
  width: 4000,
  height: 5225
}),
makePhoto({
  id: "kunming-haigeng-005",
  title: { zh: "向前", "zh-Hant": "向前", en: "Forward", fr: "En avant", ja: "前へ" },
  date: "2023-01-22",
  category: { zh: "自然", "zh-Hant": "自然", en: "Nature", fr: "Nature", ja: "自然" },
  location: { zh: "昆明 · 海埂大坝", "zh-Hant": "昆明 · 海埂大壩", en: "Kunming, Haigeng Dam", fr: "Kunming, Barrage Haigeng", ja: "昆明・海埂ダム" },
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: { zh: "风从湖面来，它短暂停留，随后交还天空。", "zh-Hant": "風從湖面來，它短暫停留，隨後交還天空。", en: "Wind comes from the lake, briefly lingering, then returning to sky.", fr: "Le vent vient du lac, s'attardant brièvement, puis retournant au ciel.", ja: "風が湖面から来て、短く留まり、その後空に戻る。" },
  tags: [
    { zh: "昆明", "zh-Hant": "昆明", en: "Kunming", fr: "Kunming", ja: "昆明" },
    { zh: "海埂大坝", "zh-Hant": "海埂大壩", en: "Haigeng Dam", fr: "Barrage Haigeng", ja: "海埂ダム" },
    { zh: "海鸥", "zh-Hant": "海鷗", en: "Seagull", fr: "Mouette", ja: "カモメ" },
    { zh: "湖面", "zh-Hant": "湖面", en: "Lake", fr: "Lac", ja: "湖面" },
    { zh: "飞翔", "zh-Hant": "飛翔", en: "Flight", fr: "Vol", ja: "飛翔" },
    { zh: "冬季", "zh-Hant": "冬季", en: "Winter", fr: "Hiver", ja: "冬" }
  ],
  src: "https://live.staticflickr.com/65535/55044091848_47b1ce634a_b.jpg",
  alt: { zh: "一只海鸥立于木桩之上，张开双翼，背景为湖面与天空", "zh-Hant": "一隻海鷗立於木樁之上，張開雙翼，背景為湖面與天空", en: "A seagull perched on wooden post, wings spread, lake and sky in background", fr: "Une mouette perchée sur un poteau en bois, ailes déployées, lac et ciel en arrière-plan", ja: "木の杭の上に止まったカモメ、翼を広げ、背景は湖面と空" },
  width: 1421,
  height: 2192
}),
makePhoto({
  id: "rome-alley-dome-006",
  title: { zh: "穹顶之间", "zh-Hant": "穹頂之間", en: "Between Domes", fr: "Entre les dômes", ja: "ドーム間" },
  date: "2023-08",
  category: { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
  location: { zh: "意大利 · 罗马", "zh-Hant": "義大利 · 羅馬", en: "Rome, Italy", fr: "Rome, Italie", ja: "イタリア・ローマ" },
  camera: "Canon 80D",
  lens: "EF 18-200mm f/3.5",
  settings: "1/100 · f/3.5 · ISO 4000",
  description: { zh: "城市收紧视线，只为让穹顶在尽头浮现。", "zh-Hant": "城市收緊視線，只為讓穹頂在盡頭浮現。", en: "The city narrows vision, only to let the dome emerge at the end.", fr: "La ville rétrécit la vision, seulement pour laisser le dôme émerger à la fin.", ja: "都市が視線を絞り込み、ドームが終わりに現れるためだけに。" },
  tags: [
    { zh: "罗马", "zh-Hant": "羅馬", en: "Rome", fr: "Rome", ja: "ローマ" },
    { zh: "意大利", "zh-Hant": "義大利", en: "Italy", fr: "Italie", ja: "イタリア" },
    { zh: "街巷", "zh-Hant": "街巷", en: "Alley", fr: "Ruelle", ja: "路地" },
    { zh: "穹顶", "zh-Hant": "穹頂", en: "Dome", fr: "Dôme", ja: "ドーム" },
    { zh: "建筑", "zh-Hant": "建築", en: "Architecture", fr: "Architecture", ja: "建築" },
    { zh: "历史", "zh-Hant": "歷史", en: "History", fr: "Histoire", ja: "歴史" }
  ],
  src: "https://live.staticflickr.com/65535/55043016452_300e44a2c3_b.jpg",
  alt: { zh: "罗马狭窄街巷之间，尽头显露一座浅色穹顶建筑", "zh-Hant": "羅馬狹窄街巷之間，盡頭顯露一座淺色穹頂建築", en: "Between narrow alleys in Rome, light-colored domed building revealed at the end", fr: "Entre les ruelles étroites de Rome, bâtiment à dôme de couleur claire révélé au bout", ja: "ローマの狭い路地の間、終わりに淡い色のドーム建築が現れる" },
  width: 1000,
  height: 1500
}),
makePhoto({
  id: "vancouver-window-cat-2026",
  title: { zh: "小黑", "zh-Hant": "小黑", en: "Little Black", fr: "Petit Noir", ja: "小黒" },
  date: "2026-01-17",
  category: { zh: "日常", "zh-Hant": "日常", en: "Daily Life", fr: "Quotidien", ja: "日常" },
  location: { zh: "加拿大 · 温哥华", "zh-Hant": "加拿大 · 溫哥華", en: "Vancouver, Canada", fr: "Vancouver, Canada", ja: "カナダ・バンクーバー" },
  camera: "Canon R5",
  lens: "RF 70-200mm f/2.8L IS USM",
  settings: "1/200 · f/2.8 · ISO 100",
  description: { zh: "冬日的光停在窗边，猫占据了时间最安静的位置。", "zh-Hant": "冬日的光停在窗邊，貓佔據了時間最安靜的位置。", en: "Winter light rests by the window, cat occupying time's quietest position.", fr: "La lumière d'hiver repose près de la fenêtre, le chat occupant la position la plus silencieuse du temps.", ja: "冬の光が窓辺に留まり、猫が時間の最も静かな位置を占める。" },
  tags: [
    { zh: "猫", "zh-Hant": "貓", en: "Cat", fr: "Chat", ja: "猫" },
    { zh: "日常", "zh-Hant": "日常", en: "Daily Life", fr: "Quotidien", ja: "日常" },
    { zh: "室内", "zh-Hant": "室內", en: "Indoor", fr: "Intérieur", ja: "室内" },
    { zh: "光影", "zh-Hant": "光影", en: "Light and Shadow", fr: "Lumière et ombre", ja: "光と影" },
    { zh: "温哥华", "zh-Hant": "溫哥華", en: "Vancouver", fr: "Vancouver", ja: "バンクーバー" }
  ],
  src: "https://live.staticflickr.com/65535/55046917474_60edaceb47_b.jpg",
  alt: { zh: "阳光照进窗边，一只蓝眼睛的猫慵懒地躺在桌面上", "zh-Hant": "陽光照進窗邊，一隻藍眼睛的貓慵懶地躺在桌面上", en: "Sunlight streaming through window, a blue-eyed cat lounging lazily on table surface", fr: "La lumière du soleil entrant par la fenêtre, un chat aux yeux bleus se prélassant paresseusement sur la table", ja: "窓から差し込む日光、青い目の猫が机の上でのんびりと横たわる" },
  width: 6812,
  height: 4544
}),
makePhoto({
  id: "vancouver-locarno-pier-2025",
  title: {
    zh: "木与海",
    "zh-Hant": "木與海",
    en: "Wood and Sea",
    fr: "Bois et mer",
    ja: "木と海"
  },
  date: "2025-08-12",
  category: {
    zh: "自然",
    "zh-Hant": "自然",
    en: "Nature",
    fr: "Nature",
    ja: "自然"
  },
  location: {
    zh: "加拿大 · 温哥华 · Locarno Beach",
    "zh-Hant": "加拿大 · 溫哥華 · Locarno Beach",
    en: "Vancouver, Canada, Locarno Beach",
    fr: "Vancouver, Canada, Plage Locarno",
    ja: "カナダ・バンクーバー・ロカルノビーチ"
  },
  camera: "iPhone 16 Pro Max",
  lens: "15.66mm f/2.8",
  settings: "1/100 · f/2.8 · ISO 100",
  description: {
    zh: "风浪反复打磨水面，木纹记录时间留下的方向。",
    "zh-Hant": "風浪反覆打磨水面，木紋記錄時間留下的方向。",
    en: "Wind and waves polish the water's surface, wood grain recording time's direction.",
    fr: "Le vent et les vagues polissent la surface de l'eau, le grain du bois enregistrant la direction du temps.",
    ja: "風と波が水面を磨き、木目が時間が残した方向を記録する。"
  },
  tags: [
    { zh: "温哥华", "zh-Hant": "溫哥華", en: "Vancouver", fr: "Vancouver", ja: "バンクーバー" },
    { zh: "海边", "zh-Hant": "海邊", en: "Seaside", fr: "Bord de mer", ja: "海辺" },
    { zh: "木结构", "zh-Hant": "木結構", en: "Wood Structure", fr: "Structure en bois", ja: "木構造" },
    { zh: "纹理", "zh-Hant": "紋理", en: "Texture", fr: "Texture", ja: "テクスチャ" },
    { zh: "光影", "zh-Hant": "光影", en: "Light and Shadow", fr: "Lumière et ombre", ja: "光と影" }
  ],
  src: "https://live.staticflickr.com/65535/55048463767_0ee76d0ab5_b.jpg",
  alt: {
    zh: "码头木桩被夕阳染成暖色，背景是起伏的海面",
    "zh-Hant": "碼頭木樁被夕陽染成暖色，背景是起伏的海面",
    en: "Pier wooden posts tinted warm by sunset, undulating sea in background",
    fr: "Poteaux en bois du quai teintés de chaud par le coucher du soleil, mer ondulante en arrière-plan",
    ja: "桟橋の木の杭が夕日に暖色に染まり、背景は波打つ海"
  },
  width: 3826,
  height: 3018
}),
makePhoto({
  id: "vancouver-impression-locarno-2025",
  title: {
    zh: "温哥华印象",
    "zh-Hant": "溫哥華印象",
    en: "Vancouver Impression",
    fr: "Impression de Vancouver",
    ja: "バンクーバーの印象"
  },
  date: "2025-08-12",
  category: {
    zh: "自然",
    "zh-Hant": "自然",
    en: "Nature",
    fr: "Nature",
    ja: "自然"
  },
  location: {
    zh: "加拿大 · 温哥华 · Locarno Beach",
    "zh-Hant": "加拿大 · 溫哥華 · Locarno Beach",
    en: "Vancouver, Canada, Locarno Beach",
    fr: "Vancouver, Canada, Plage Locarno",
    ja: "カナダ・バンクーバー・ロカルノビーチ"
  },
  camera: "iPhone 16 Pro Max",
  lens: "15.66mm f/2.8",
  settings: "1/100 · f/2.8 · ISO 100",
  description: {
    zh: "冷色的天空压低地平线，海与城在光线中达成暂时的平衡。",
    "zh-Hant": "冷色的天空壓低地平線，海與城在光線中達成暫時的平衡。",
    en: "Cool-toned sky lowering the horizon, sea and city achieving temporary balance in the light.",
    fr: "Ciel aux tons froids abaissant l'horizon, la mer et la ville atteignant un équilibre temporaire dans la lumière.",
    ja: "冷色調の空が地平線を低くし、海と街が光の中で一時的なバランスを達成する。"
  },
  tags: [
    { zh: "温哥华", "zh-Hant": "溫哥華", en: "Vancouver", fr: "Vancouver", ja: "バンクーバー" },
    { zh: "海岸", "zh-Hant": "海岸", en: "Coast", fr: "Côte", ja: "海岸" },
    { zh: "城市", "zh-Hant": "城市", en: "City", fr: "Ville", ja: "都市" },
    { zh: "天空", "zh-Hant": "天空", en: "Sky", fr: "Ciel", ja: "空" },
    { zh: "光影", "zh-Hant": "光影", en: "Light and Shadow", fr: "Lumière et ombre", ja: "光と影" }
  ],
  src: "https://live.staticflickr.com/65535/55048463752_aa31ba4994_b.jpg",
  alt: {
    zh: "温哥华 Locarno Beach 海岸线，远处城市与海面在冷色天空下展开",
    "zh-Hant": "溫哥華 Locarno Beach 海岸線，遠處城市與海面在冷色天空下展開",
    en: "Vancouver Locarno Beach coastline, distant city and sea unfolding under cool-toned sky",
    fr: "Côte de Locarno Beach à Vancouver, ville lointaine et mer se déployant sous un ciel aux tons froids",
    ja: "バンクーバーのロカルノビーチの海岸線、遠くの街と海が冷色調の空の下に広がる"
  },
  width: 3784,
  height: 2348
})
];
