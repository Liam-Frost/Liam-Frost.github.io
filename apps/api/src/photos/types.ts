import type { LocalizedText, PhotoVisibility } from "@liam-frost/shared";

export type StoredVariant = { width: number; height: number };

/** A photo as stored, independent of Prisma. */
export type PhotoRow = {
  id: string;
  slug: string;
  title: LocalizedText;
  date: string;
  category: LocalizedText;
  location: LocalizedText | null;
  camera: string | null;
  lens: string | null;
  settings: string | null;
  description: LocalizedText | null;
  tags: LocalizedText[];
  alt: LocalizedText;
  width: number;
  height: number;
  /** External URL for remote photos; empty for uploaded ones. */
  src: string;
  storage: "remote-url" | "local";
  /** Folder of an uploaded photo's files, e.g. "photos/<id>". */
  storageKey: string | null;
  /** Generated sizes for uploaded photos, smallest first. */
  variants: StoredVariant[] | null;
  visibility: PhotoVisibility;
  featured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

export type NewPhoto = Omit<PhotoRow, "createdAt" | "updatedAt" | "sortOrder"> & { sortOrder?: number };

export type PhotoPatch = Partial<
  Pick<
    PhotoRow,
    | "title"
    | "date"
    | "category"
    | "location"
    | "camera"
    | "lens"
    | "settings"
    | "description"
    | "tags"
    | "alt"
    | "visibility"
    | "featured"
  >
>;

export interface PhotoRepository {
  /** Ordered by sortOrder, then newest date. */
  list(options?: { includePrivate?: boolean }): Promise<PhotoRow[]>;
  get(id: string): Promise<PhotoRow | null>;
  /** Without an explicit sortOrder the photo goes first. */
  create(photo: NewPhoto): Promise<PhotoRow>;
  update(id: string, patch: PhotoPatch): Promise<PhotoRow | null>;
  delete(id: string): Promise<PhotoRow | null>;
  /** Sets sortOrder to each id's position. */
  reorder(ids: string[]): Promise<void>;
}
