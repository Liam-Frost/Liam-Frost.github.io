-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "source" JSONB;

-- Existing photos: uploads, Flickr (a gallery) and other links. When they were added is not known.
UPDATE "Photo" SET "source" = CASE
  WHEN "storage" = 'local' THEN jsonb_build_object('type', 'upload', 'ref', NULL::text, 'importedAt', NULL::text)
  WHEN "src" LIKE 'https://live.staticflickr.com/%' THEN jsonb_build_object('type', 'gallery', 'provider', 'flickr', 'ref', "src", 'importedAt', NULL::text)
  ELSE jsonb_build_object('type', 'url', 'ref', "src", 'importedAt', NULL::text)
END;
