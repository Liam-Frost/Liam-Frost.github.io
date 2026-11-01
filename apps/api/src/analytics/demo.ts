/** Only databases meant for demos: the database name or ?schema= must say so. */
export function isDemoDatabase(url: string) {
  try {
    const parsed = new URL(url);
    const name = decodeURIComponent(parsed.pathname.slice(1));
    const schema = parsed.searchParams.get("schema") ?? "";
    return /demo/i.test(name) || /demo/i.test(schema);
  } catch {
    return false;
  }
}
