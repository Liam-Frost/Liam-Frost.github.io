-- Position of a home-page featured entry when the site uses a fixed order; null when never ordered.
ALTER TABLE "MediaItem" ADD COLUMN "featuredOrder" INTEGER;
