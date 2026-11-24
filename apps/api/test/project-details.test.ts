import {
  EMPTY_PROJECT_DETAILS,
  normalizeProjectDetails,
  projectCollaborators,
  projectLines,
  projectOutcomes
} from "@liam-frost/shared";
import { describe, expect, it } from "vitest";

describe("project details", () => {
  it("reads a project saved before the details existed, and ignores what it does not know", () => {
    expect(normalizeProjectDetails({})).toEqual(EMPTY_PROJECT_DETAILS);
    expect(normalizeProjectDetails(null)).toEqual(EMPTY_PROJECT_DETAILS);
    expect(
      normalizeProjectDetails({
        kind: "hobby",
        teamSize: "4",
        role: { en: "Lead", zh: "", fr: 3 },
        ownTechnologies: ["Java", 7],
        captions: { a: { en: "Shot" }, b: {} }
      })
    ).toEqual({
      ...EMPTY_PROJECT_DETAILS,
      role: { en: "Lead" },
      ownTechnologies: ["Java"],
      captions: { a: { en: "Shot" } }
    });
  });

  it("splits list fields into their lines", () => {
    expect(projectLines("- one\n\n  two  \r\n* three")).toEqual(["one", "two", "three"]);
    expect(projectOutcomes("40% | faster | than before\nShipped")).toEqual([
      { value: "40%", label: "faster | than before" },
      { value: "", label: "Shipped" }
    ]);
    expect(
      projectCollaborators(
        "Ada | frontend | https://example.com/ada\nBo\n | nobody\nCy | javascript:alert(1)"
      )
    ).toEqual([
      { name: "Ada", role: "frontend", url: "https://example.com/ada" },
      { name: "Bo", role: "", url: null },
      { name: "Cy", role: "javascript:alert(1)", url: null }
    ]);
  });
});
