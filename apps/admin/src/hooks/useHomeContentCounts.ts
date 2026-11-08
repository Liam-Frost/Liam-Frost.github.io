import { useQuery } from "@tanstack/react-query";
import {
  homeCollectionContentIds,
  type PublicAbout,
  type PublicCollection,
  type PublicStackResponse,
  type ContactContent,
  type HomeSection
} from "@liam-frost/shared";
import { request } from "../lib/api";

export function useHomeContentCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["admin", "home-public-content-counts"],
    enabled,
    queryFn: async () => {
      const jobs: [HomeSection, () => Promise<number>][] = [
        ["top", async () => 1],
        [
          "featured",
          async () =>
            (await request<{ featured: boolean }[]>("/api/photos")).filter((p) => p.featured).length
        ],
        [
          "projects",
          async () =>
            (await request<{ featured: boolean }[]>("/api/projects")).filter((p) => p.featured)
              .length
        ],
        [
          "skills",
          async () =>
            (await request<PublicStackResponse>("/api/stack")).categories.reduce(
              (n, c) => n + c.technologies.length,
              0
            )
        ],
        [
          "about",
          async () => {
            const data = await request<PublicAbout>("/api/about");
            return data.manifestos.length + data.gear.reduce((n, c) => n + c.items.length, 0);
          }
        ],
        [
          "watching",
          async () =>
            homeCollectionContentIds(await request<PublicCollection>("/api/collection")).length
        ],
        [
          "contact",
          async () => {
            const data = await request<ContactContent>("/api/contact");
            return (data.email.trim() ? 1 : 0) + data.links.length;
          }
        ]
      ];
      const results = await Promise.allSettled(jobs.map(([, run]) => run()));
      return Object.fromEntries(
        results.map((result, index) => [
          jobs[index][0],
          result.status === "fulfilled" ? result.value : null
        ])
      ) as Record<HomeSection, number | null>;
    }
  });
}
