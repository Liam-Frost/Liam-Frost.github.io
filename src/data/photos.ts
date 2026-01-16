import { photoPlaceholder } from "../lib/placeholder";

export type Photo = {
  id: string;
  title: string;
  date: string; // ISO date string
  category: string;
  location?: string;
  camera?: string;
  lens?: string;
  settings?: string;
  description?: string;
  tags: string[];
  src: string;
  alt: string;
  width: number;
  height: number;
};

function makePhoto(p: Omit<Photo, "src" | "alt"> & { alt?: string; src?: string }) {
  const src =
    p.src ??
    photoPlaceholder({
      title: p.title,
      seed: p.id,
      width: p.width,
      height: p.height
    });

  return {
    ...p,
    src,
    alt: p.alt ?? p.title
  } satisfies Photo;
}

export const photos: Photo[] = [
  makePhoto({
    id: "glico-night-icon",
    title: "奔跑",
    date: "2024-08-21",
    category: "街头",
    location: "大阪·道顿堀",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "格力高跑男，城市记忆锚点。",
    tags: ["霓虹", "城市符号", "日本"],
    src: "https://live.staticflickr.com/65535/55042276542_8c2b03588c_b.jpg",
    alt: "大阪道顿堀夜晚的格力高跑男广告牌，周围被密集的霓虹招牌包围",
    width: 5210,
    height: 3150
  }),
  makePhoto({
    id: "donki-ferris-wheel",
    title: "黄色摩天轮",
    date: "2024-08-21",
    category: "街头",
    location: "大阪·道顿堀",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "黄色摩天轮，红色座舱，框架中依然能窥见美好的晴天",
    tags: ["摩天轮", "结构", "色彩", "城市"],
    src: "https://live.staticflickr.com/65535/55043514690_4cc7141906_b.jpg",
    alt: "大阪道顿堀的黄色摩天轮结构，红色座舱沿着钢架排列，背景为晴朗天空",
    width: 3837,
    height: 5602
  }),
  makePhoto({
    id: "dotonbori-street-light",
    title: "灯与线",
    date: "2024-08-21",
    category: "街头",
    location: "大阪·道顿堀",
    camera: "Canon 80D",
    lens: "EF 18-200mm f/3.5",
    settings: "1/100 · f/4 · ISO 800",
    description: "密集的线交错成网，昏黄路灯包被其中。",
    tags: ["街灯", "电线", "秩序与杂乱", "城市", "夜前"],
    src: "https://live.staticflickr.com/65535/55043176501_dd83d5e978_b.jpg",
    alt: "大阪道顿堀街头，密集电线之间悬挂的一盏路灯，背景为城市建筑",
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
  })
];
