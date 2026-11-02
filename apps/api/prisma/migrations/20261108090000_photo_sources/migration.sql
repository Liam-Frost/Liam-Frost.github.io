-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "source" JSONB;

-- Existing photos: uploads, Flickr links and other links. When they were added is not known.
UPDATE "Photo" SET "source" = CASE
  WHEN "storage" = 'LOCAL' THEN jsonb_build_object('type', 'upload', 'ref', NULL, 'importedAt', NULL)
  WHEN "src" LIKE 'https://live.staticflickr.com/%' THEN jsonb_build_object('type', 'flickr', 'ref', "src", 'importedAt', NULL)
  ELSE jsonb_build_object('type', 'url', 'ref', "src", 'importedAt', NULL)
END;
