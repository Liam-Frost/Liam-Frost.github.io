import { Star } from "lucide-react";

/** Five-star rating; clicking the current rating clears it. Read-only when onChange is omitted. */
export function StarRating({ value, onChange, size = "md" }: { value: number | null; onChange?: (value: number | null) => void; size?: "sm" | "md" }) {
  const icon = size === "sm" ? "size-3.5" : "size-5";
  if (!onChange) {
    return (
      <span className="inline-flex items-center gap-0.5" role="img" aria-label={value ? `${value} 星` : "未评分"}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} aria-hidden="true" className={`${icon} ${value && n <= value ? "fill-rating text-rating" : "text-line-strong"}`} />
        ))}
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="评分">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} 星`}
          title={value === n ? "再点一次清除评分" : `${n} 星`}
          onClick={() => onChange(value === n ? null : n)}
          className="rounded p-0.5 transition-transform hover:scale-110"
        >
          <Star aria-hidden="true" className={`${icon} ${value && n <= value ? "fill-rating text-rating" : "text-line-strong"}`} />
        </button>
      ))}
      <span className="ml-1 text-[12px] text-subtle">{value ? `${value} / 5` : "未评分"}</span>
    </div>
  );
}
