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
    id: "neon-rain",
    title: "霓虹雨夜 / Neon Rain",
    date: "2025-10-08",
    category: "街头",
    location: "Shanghai",
    camera: "Fujifilm X-T5",
    lens: "35mm f/1.4",
    settings: "1/125 · f/2 · ISO 1600",
    description: "雨后的街道，霓虹在水面上拉出一条条彩色的脉络。",
    tags: ["夜景", "霓虹", "雨"],
    width: 1800,
    height: 1200
  }),
  makePhoto({
    id: "coastline",
    title: "海岸线 / Coastline",
    date: "2025-06-21",
    category: "风光",
    location: "Qingdao",
    camera: "Sony A7 IV",
    lens: "24-70mm f/2.8",
    settings: "1/500 · f/5.6 · ISO 100",
    description: "潮汐退去，岩石与浪花把海岸切成明暗两面。",
    tags: ["海", "清晨", "蓝"],
    width: 1600,
    height: 1200
  }),
  makePhoto({
    id: "mist-ridge",
    title: "雾中山脊 / Mist Ridge",
    date: "2024-11-02",
    category: "风光",
    location: "Yunnan",
    camera: "Canon R6",
    lens: "70-200mm f/2.8",
    settings: "1/800 · f/4 · ISO 200",
    description: "雾像一层薄纱，把山脊的轮廓留在空气里。",
    tags: ["山", "雾", "留白"],
    width: 1920,
    height: 1080
  }),
  makePhoto({
    id: "glass-shadow",
    title: "玻璃与影 / Glass & Shadow",
    date: "2025-03-18",
    category: "建筑",
    location: "Shenzhen",
    camera: "Nikon Z6",
    lens: "50mm f/1.8",
    settings: "1/320 · f/3.2 · ISO 200",
    description: "玻璃幕墙把光线折成几何的影子。",
    tags: ["几何", "极简", "结构"],
    width: 1200,
    height: 1600
  }),
  makePhoto({
    id: "afternoon-portrait",
    title: "午后肖像 / Afternoon Portrait",
    date: "2025-04-09",
    category: "人像",
    location: "Studio",
    camera: "Sony A7 III",
    lens: "85mm f/1.8",
    settings: "1/200 · f/1.8 · ISO 160",
    description: "柔光从侧面进入，表情和质感都更松弛。",
    tags: ["人像", "柔光", "情绪"],
    width: 1200,
    height: 1500
  }),
  makePhoto({
    id: "window-seat",
    title: "列车窗外 / Window Seat",
    date: "2024-08-12",
    category: "旅行",
    location: "On the train",
    camera: "iPhone",
    lens: "Main",
    settings: "Auto",
    description: "路过的风景是一帧帧不回头的电影。",
    tags: ["旅途", "移动", "瞬间"],
    width: 1800,
    height: 1200
  }),
  makePhoto({
    id: "dunes",
    title: "沙丘 / Dunes",
    date: "2025-01-27",
    category: "旅行",
    location: "Dunhuang",
    camera: "Fujifilm X100V",
    lens: "23mm",
    settings: "1/1600 · f/8 · ISO 160",
    description: "风把纹理写在沙面上，光线让线条有了方向。",
    tags: ["沙漠", "纹理", "光影"],
    width: 1920,
    height: 1200
  }),
  makePhoto({
    id: "old-alley",
    title: "老城巷口 / Old Alley",
    date: "2024-05-03",
    category: "街头",
    location: "Suzhou",
    camera: "Ricoh GR III",
    lens: "28mm",
    settings: "1/250 · f/2.8 · ISO 400",
    description: "巷口转角处，总有一束光在等人经过。",
    tags: ["巷子", "光", "生活"],
    width: 1200,
    height: 1800
  }),
  makePhoto({
    id: "wind",
    title: "风起 / Wind",
    date: "2024-09-15",
    category: "风光",
    location: "Inner Mongolia",
    camera: "Canon R5",
    lens: "24-105mm",
    settings: "1/1000 · f/5.6 · ISO 100",
    description: "草原的风像一双手，把远处的云推向更远。",
    tags: ["草原", "云", "辽阔"],
    width: 1800,
    height: 1200
  }),
  makePhoto({
    id: "morning-light",
    title: "晨光 / Morning Light",
    date: "2025-07-02",
    category: "风光",
    location: "Hangzhou",
    camera: "Sony A7C",
    lens: "35mm f/1.8",
    settings: "1/800 · f/4 · ISO 100",
    description: "清晨的光很轻，但能把一切照得很清楚。",
    tags: ["清晨", "暖色", "静"],
    width: 1600,
    height: 1200
  }),
  makePhoto({
    id: "city-lines",
    title: "线条城市 / City Lines",
    date: "2025-02-14",
    category: "建筑",
    location: "Beijing",
    camera: "Nikon Zf",
    lens: "40mm",
    settings: "1/640 · f/4 · ISO 200",
    description: "线条与节奏，是城市的另一种表情。",
    tags: ["线条", "秩序", "城市"],
    width: 1800,
    height: 1200
  }),
  makePhoto({
    id: "still-life",
    title: "静物一角 / Still Life",
    date: "2024-12-30",
    category: "静物",
    location: "Home",
    camera: "Sony A6400",
    lens: "30mm macro",
    settings: "1/100 · f/4 · ISO 320",
    description: "日常的一角，也能成为一张照片的理由。",
    tags: ["静物", "质感", "日常"],
    width: 1400,
    height: 1800
  })
];
