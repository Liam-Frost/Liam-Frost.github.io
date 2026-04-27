export type SkillGroup = "frontend" | "backend" | "creative";

export type SkillLevel = "core" | "strong" | "working";

export type Skill = {
  id: string;
  name: string;
  group: SkillGroup;
  level: SkillLevel;
};

export const skills: Skill[] = [
  { id: "react", name: "React", group: "frontend", level: "core" },
  { id: "router", name: "React Router", group: "frontend", level: "strong" },
  { id: "vite", name: "Vite", group: "frontend", level: "working" },
  { id: "ts", name: "TypeScript", group: "frontend", level: "working" },
  { id: "css", name: "CSS", group: "frontend", level: "working" },

  { id: "java", name: "Java", group: "backend", level: "core" },
  { id: "springboot", name: "SpringBoot", group: "backend", level: "working" },
  { id: "python", name: "Python", group: "backend", level: "strong" },
  { id: "cpp", name: "C++", group: "backend", level: "strong" },

  { id: "lightroom", name: "Lightroom", group: "creative", level: "core" },
  { id: "photoshop", name: "Photoshop", group: "creative", level: "strong" },
  { id: "premiere", name: "Premiere", group: "creative", level: "working" },
  { id: "ae", name: "After Effects", group: "creative", level: "working" },
  { id: "davinci", name: "DaVinci Resolve", group: "creative", level: "working" },

];
