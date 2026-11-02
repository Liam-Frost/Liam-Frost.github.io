import { tooltipPosition } from "@liam-frost/shared";
import { describe, expect, it } from "vitest";

// The positioning shared by the site's and the admin's Tooltip components.
describe("tooltipPosition", () => {
  const viewport = { width: 400, height: 300 };
  const tip = { width: 100, height: 30 };

  it("centers the tooltip above its anchor", () => {
    expect(tooltipPosition({ top: 100, left: 150, width: 40, height: 20 }, tip, viewport)).toEqual({
      top: 62,
      left: 120,
      placement: "top"
    });
  });

  it("goes below when there is no room above", () => {
    expect(tooltipPosition({ top: 10, left: 150, width: 40, height: 20 }, tip, viewport)).toEqual({
      top: 38,
      left: 120,
      placement: "bottom"
    });
  });

  it("stays inside the viewport at its edges", () => {
    expect(tooltipPosition({ top: 100, left: 0, width: 20, height: 20 }, tip, viewport).left).toBe(
      8
    );
    expect(
      tooltipPosition({ top: 100, left: 390, width: 10, height: 20 }, tip, viewport).left
    ).toBe(292);
  });
});
