import { describe, expect, it } from "vitest";

import { stripMarkup } from "../src/lib/plain-text";

describe("provider markup display text", () => {
  it.each([
    ["<p>Hello <b>world</b>.</p>", "Hello world."],
    ["Hello <<script>script>alert(1)<</script>/script> world", "Hello scriptalert(1)/script world"],
    ["Text<unclosed", "Text"],
    ["plain & readable", "plain & readable"]
  ])("extracts text from %s", (input, expected) => {
    expect(stripMarkup(input)).toBe(expected);
    expect(stripMarkup(input)).not.toMatch(/[<>]/);
  });
});
