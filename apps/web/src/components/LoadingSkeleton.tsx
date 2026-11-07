import "./loading-skeleton.css";
export default function LoadingSkeleton({
  label,
  variant = "cards",
  count = 3
}: {
  label: string;
  variant?: "cards" | "detail" | "rows" | "form";
  count?: number;
}) {
  return (
    <div
      className={`loadingSkeleton loadingSkeleton-${variant}`}
      aria-busy="true"
      role="status"
      aria-label={label}
    >
      <span className="loadingSkeleton-label">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div className="loadingSkeleton-item" key={i} aria-hidden="true">
          <span className="loadingSkeleton-block loadingSkeleton-media" />
          <div>
            <span className="loadingSkeleton-block loadingSkeleton-title" />
            <span className="loadingSkeleton-block loadingSkeleton-line" />
            <span className="loadingSkeleton-block loadingSkeleton-line loadingSkeleton-short" />
          </div>
        </div>
      ))}
    </div>
  );
}
