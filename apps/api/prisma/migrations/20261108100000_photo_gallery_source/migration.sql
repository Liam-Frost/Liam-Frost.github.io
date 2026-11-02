-- Gallery photos are one source type with a provider: {"type":"flickr"} becomes
-- {"type":"gallery","provider":"flickr"}, keeping the reference and the import time.
UPDATE "Photo"
SET "source" = jsonb_set("source", '{type}', '"gallery"') || '{"provider": "flickr"}'::jsonb
WHERE "source" ->> 'type' = 'flickr';
