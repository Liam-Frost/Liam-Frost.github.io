-- CreateTable
CREATE TABLE "AnalyticsContentName" (
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsContentName_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AnalyticsRequestDaily" (
    "day" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requests" INTEGER NOT NULL,
    "serverErrors" INTEGER NOT NULL,
    "clientErrors" INTEGER NOT NULL,
    "totalMs" DOUBLE PRECISION NOT NULL,
    "histogram" JSONB NOT NULL,

    CONSTRAINT "AnalyticsRequestDaily_pkey" PRIMARY KEY ("day","route")
);

-- CreateTable
CREATE TABLE "AnalyticsSystemEvent" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "message" TEXT,

    CONSTRAINT "AnalyticsSystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsFlag" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "AnalyticsFlag_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AnalyticsSystemEvent_at_idx" ON "AnalyticsSystemEvent"("at");

-- CreateIndex
CREATE INDEX "AnalyticsSystemEvent_kind_name_at_idx" ON "AnalyticsSystemEvent"("kind", "name", "at");
