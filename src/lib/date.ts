export function formatYear(isoDate: string) {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return String(d.getFullYear());
}
