import type { StoredVariant } from "../photos/types";

export type AssetOwnerType = "photo" | "project" | "media" | "person" | "branding" | "stack";

/** One site-hosted image folder as registered, independent of Prisma. */
export type AssetRow = {
  id: string;
  storageKey: string;
  ownerType: AssetOwnerType;
  ownerId: string;
  role: string;
  originalName: string | null;
  format: string;
  bytes: number;
  totalBytes: number;
  width: number;
  height: number;
  variants: StoredVariant[];
  sha256: string | null;
  uploadId: string | null;
  status: "ready" | "trashed";
  trashedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NewAsset = Omit<AssetRow, "id" | "status" | "trashedAt" | "createdAt" | "updatedAt">;

export interface AssetRepository {
  /** Registers a folder; registering the same key again replaces the entry. */
  register(asset: NewAsset): Promise<AssetRow>;
  getByKey(storageKey: string): Promise<AssetRow | null>;
  removeByKey(storageKey: string): Promise<void>;
  /** Marks a folder as in the trash (with when) or back in use. */
  setStatus(storageKey: string, status: AssetRow["status"], at: Date | null): Promise<void>;
  /** Ready assets whose original has one of these hashes. */
  findBySha256(hashes: string[], ownerType?: AssetOwnerType): Promise<AssetRow[]>;
  findByUploadIds(uploadIds: string[]): Promise<AssetRow[]>;
  /** Every registered key of an owner type. */
  keys(ownerType: AssetOwnerType): Promise<string[]>;
}
