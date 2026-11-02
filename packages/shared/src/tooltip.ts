/** A box on screen, in viewport pixels. */
export type TooltipRect = { top: number; left: number; width: number; height: number };

/**
 * Where a tooltip goes: centered above its anchor, or below when there is no room above, and kept
 * `margin` pixels inside the viewport. Shared by the site's and the admin's Tooltip components.
 */
export function tooltipPosition(
  anchor: TooltipRect,
  tip: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 8,
  margin = 8
) {
  const above = anchor.top - gap - tip.height;
  const placement: "top" | "bottom" = above >= margin ? "top" : "bottom";
  const top = placement === "top" ? above : anchor.top + anchor.height + gap;
  const centered = anchor.left + anchor.width / 2 - tip.width / 2;
  const left = Math.min(
    Math.max(centered, margin),
    Math.max(margin, viewport.width - tip.width - margin)
  );
  return { top: Math.round(top), left: Math.round(left), placement };
}
