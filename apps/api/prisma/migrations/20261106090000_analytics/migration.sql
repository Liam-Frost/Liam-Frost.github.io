-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "contentType" TEXT,
    "contentId" TEXT,
    "target" TEXT,
    "detail" TEXT,
    "value" DOUBLE PRECISION,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsSession" (
    "id" TEXT NOT NULL,
    "visitor" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "entryPath" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "country" TEXT,
    "lang" TEXT,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,

    CONSTRAINT "AnalyticsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "day" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("day","metric","key")
);

-- CreateTable
CREATE TABLE "AnalyticsRollupDay" (
    "day" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsRollupDay_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "AnalyticsSalt" (
    "day" TEXT NOT NULL,
    "salt" TEXT NOT NULL,

    CONSTRAINT "AnalyticsSalt_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_day_idx" ON "AnalyticsEvent"("day");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsSession_day_idx" ON "AnalyticsSession"("day");

-- CreateIndex
CREATE INDEX "AnalyticsSession_lastSeenAt_idx" ON "AnalyticsSession"("lastSeenAt");

-- CreateIndex
CREATE INDEX "AnalyticsDaily_metric_day_idx" ON "AnalyticsDaily"("metric", "day");
