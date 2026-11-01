const DAY_MS = 24 * 60 * 60 * 1000;

/** Days and hours in the analytics time zone. Days are "YYYY-MM-DD" strings. */
export class AnalyticsClock {
  private readonly format: Intl.DateTimeFormat;

  constructor(readonly timezone: string) {
    this.format = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit"
    });
  }

  private parts(date: Date) {
    const parts = Object.fromEntries(
      this.format.formatToParts(date).map((part) => [part.type, part.value])
    );
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour)
    };
  }

  /** The local day and hour of an instant. */
  local(date: Date) {
    const p = this.parts(date);
    return {
      day: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
      hour: p.hour
    };
  }
}

/** Calendar arithmetic on "YYYY-MM-DD" days, independent of time zones. */
export function addDays(day: string, n: number) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, date!) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export const isDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && addDays(value, 0) === value;
