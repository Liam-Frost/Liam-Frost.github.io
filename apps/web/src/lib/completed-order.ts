/** Missing completion dates are unknown, not the date an entry was imported or edited. */
export function compareCompleted(
  a: { id: string; watchedOn: string | null; updatedAt: string },
  b: { id: string; watchedOn: string | null; updatedAt: string }
) {
  return (
    (b.watchedOn || "").localeCompare(a.watchedOn || "") ||
    b.updatedAt.localeCompare(a.updatedAt) ||
    a.id.localeCompare(b.id)
  );
}
