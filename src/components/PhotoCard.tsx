import { getPhotoField, getPhotoTags, type Photo } from "../data/photos";
import { formatYear } from "../lib/date";
import { useI18n } from "../lib/i18n";

import ResponsiveFlickrImage from "./ResponsiveFlickrImage";

type Props = {
  photo: Photo;
  onOpen: (id: string) => void;
  priority?: boolean;
};

export default function PhotoCard({ photo, onOpen, priority = false }: Props) {
  const { lang, t } = useI18n();
  const year = formatYear(photo.date);

  const title = getPhotoField(photo.title, lang);
  const category = getPhotoField(photo.category, lang);
  const location = getPhotoField(photo.location, lang);
  const alt = getPhotoField(photo.alt, lang);
  const tags = getPhotoTags(photo.tags, lang);

  return (
    <button
      type="button"
      className="photoCard"
      onClick={() => onOpen(photo.id)}
      aria-label={t("photo.open", { title })}
    >
      <ResponsiveFlickrImage
        className="photoImg"
        baseUrl={photo.src}
        originalWidth={photo.width}
        originalHeight={photo.height}
        variant="grid"
        alt={alt}
        priority={priority}
      />

      <div className="photoOverlay">
        <h3 className="photoTitle">{title}</h3>
        <div className="photoMeta">
          {category}
          {location ? ` · ${location}` : ""}
          {year ? ` · ${year}` : ""}
        </div>

        {tags.length ? (
          <div className="tags" aria-label="Tags">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}
