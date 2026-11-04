const relative = new Intl.RelativeTimeFormat("zh-CN", { numeric: "auto" });

/** "3 天前", "刚刚". */
export function ago(iso: string) {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  for (const [unit, size] of [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60]
  ] as const) {
    if (abs >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "刚刚";
}

/** A relative time; the exact time is in the title and the datetime attribute. */
export function Time({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString("zh-CN")}>
      {ago(iso)}
    </time>
  );
}
