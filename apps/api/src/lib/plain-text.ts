/**
 * Extracts display text from provider markup in one pass. This is not an HTML
 * sanitizer: callers must still render the result as text, never as raw HTML.
 * Nested or unclosed brackets cannot leave a new tag in the output.
 */
export function stripMarkup(value: string): string {
  const text: string[] = [];
  let insideTag = false;
  for (const character of value) {
    if (character === "<") insideTag = true;
    else if (character === ">") insideTag = false;
    else if (!insideTag) text.push(character);
  }
  return text.join("");
}
