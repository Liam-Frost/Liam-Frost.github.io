// Links projects' plain technology names to the technologies of the stack, with the same rules as the
// migration that first did it (src/projects/technology-matching.ts), and lists what still needs a
// decision. Safe to run any number of times: an existing link is never added twice.
//
//   npm run db:link-project-technologies            report only
//   npm run db:link-project-technologies -- --apply link what matches
import "dotenv/config";

import { PrismaProjectRepository } from "../projects/prisma-repository";
import { matchTechnologies } from "../projects/technology-matching";
import { PrismaStackRepository } from "../stack/prisma-repository";
import { createPrismaClient } from "./client";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required (see apps/api/.env.example)");

const prisma = createPrismaClient(databaseUrl);
const projects = new PrismaProjectRepository(prisma);
const stack = new PrismaStackRepository(prisma);

try {
  const technologies = (await stack.list()).flatMap((c) => c.technologies);
  let linked = 0;
  let pending = 0;
  for (const project of await projects.list({ includePrivate: true })) {
    if (!project.techStack.length) continue;
    const label = project.title.zh ?? project.title.en ?? project.slug;
    const match = matchTechnologies(project.techStack, technologies);
    // Names of technologies the project is already linked to only need to leave the plain list.
    const known = new Set(project.technologies.map((t) => t.id));
    const added = match.linked.filter((m) => !known.has(m.technologyId));
    for (const m of match.linked)
      console.log(`${known.has(m.technologyId) ? "keep " : "link "} ${label}: ${m.name}`);
    for (const name of match.unmatched)
      console.log(
        `left  ${label}: ${name} (not in the stack: add it there, or keep it as a plain name)`
      );
    for (const name of match.ambiguous)
      console.log(
        `left  ${label}: ${name} (several technologies have this name: link it in the admin)`
      );
    linked += added.length;
    pending += match.unmatched.length + match.ambiguous.length;
    if (apply && match.linked.length) {
      await projects.update(project.id, {
        technologyIds: [
          ...project.technologies.map((t) => t.id),
          ...added.map((m) => m.technologyId)
        ],
        techStack: [...match.unmatched, ...match.ambiguous].sort(
          (a, b) => project.techStack.indexOf(a) - project.techStack.indexOf(b)
        )
      });
    }
  }
  console.log(
    `${apply ? "Linked" : "Would link"} ${linked} technolog${linked === 1 ? "y" : "ies"}; ` +
      `${pending} name${pending === 1 ? "" : "s"} left for the admin.` +
      (apply || !linked ? "" : " Run with --apply to link them.")
  );
} finally {
  await prisma.$disconnect();
}
