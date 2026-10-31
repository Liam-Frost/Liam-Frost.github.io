-- The player no longer syncs a playlist at runtime; drop its cached copy.
DELETE FROM "Setting" WHERE "key" = 'spotify.playlist';
