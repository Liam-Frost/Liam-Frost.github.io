import type { Photo } from "../data/photos";
import { formatYear } from "../lib/date";
import { useI18n } from "../lib/i18n";

type Props = {
  photo: Photo;
  onOpen: (id: string) => void;
};

export default function PhotoCard({ photo, onOpen }: Props) {
  const { t } = useI18n();
  const year = formatYear(photo.date);

  return (
    <button
      type="button"
      className="photoCard"
      onClick={() => onOpen(photo.id)}
      aria-label={t("photo.open", { title: photo.title })}
    >
      <img
        className="photoImg"
        src={photo.src}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      />

      <div className="photoOverlay">
        <h3 className="photoTitle">{photo.title}</h3>
        <div className="photoMeta">
          {photo.category}
          {photo.location ? ` · ${photo.location}` : ""}
          {year ? ` · ${year}` : ""}
        </div>

        {photo.tags?.length ? (
          <div className="tags" aria-label="Tags">
            {photo.tags.slice(0, 3).map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
