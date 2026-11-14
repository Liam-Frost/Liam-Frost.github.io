import type { LocalizedText, PhotoSource, PhotoVisibility } from "@liam-frost/shared";

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
  /** Where the image came from; null before sources were recorded. */
  source: PhotoSource | null;
  visibility: PhotoVisibility;
  featured: boolean;
  sortOrder: number;
  /** The version the image fields are a copy of; unset for a photo that has no versions yet. */
  currentVersionId?: string | null;
  /** When the photo was moved to the trash; unset or null while it is in use. */
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewPhoto = Omit<PhotoRow, "createdAt" | "updatedAt" | "sortOrder"> & {
  sortOrder?: number;
};

/** Editable fields, and (set by the server only, never from a request body) the image itself. */
export type PhotoPatch = Partial<
  Pick<
    PhotoRow,
    | "src"
    | "storage"
    | "storageKey"
    | "variants"
    | "source"
    | "width"
    | "height"
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
    | "currentVersionId"
  >
>;

/** Every method but the trash ones leaves photos in the trash out, as if they were deleted. */
export interface PhotoRepository {
  /** Ordered by sortOrder, then newest date. */
  list(options?: { includePrivate?: boolean }): Promise<PhotoRow[]>;
  get(id: string): Promise<PhotoRow | null>;
  /** The photo whose site-hosted files are under this key. */
  findByStorageKey(key: string): Promise<PhotoRow | null>;
  /** Without an explicit sortOrder the photo goes first. */
  create(photo: NewPhoto): Promise<PhotoRow>;
  update(id: string, patch: PhotoPatch): Promise<PhotoRow | null>;
  /** Removes the photo for good, whether or not it is in the trash. */
  delete(id: string): Promise<PhotoRow | null>;
  /** Moves the photo to the trash. */
  trash(id: string, at: Date): Promise<PhotoRow | null>;
  /** Takes the photo back out of the trash. */
  restore(id: string): Promise<PhotoRow | null>;
  /** Photos in the trash, most recently deleted first. */
  listTrashed(): Promise<PhotoRow[]>;
  getTrashed(id: string): Promise<PhotoRow | null>;
  /** Sets sortOrder to each id's position. */
  reorder(ids: string[]): Promise<void>;
}
