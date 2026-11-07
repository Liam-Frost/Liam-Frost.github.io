CREATE TABLE "AdminAuditEvent" (
 "id" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "actor" TEXT, "action" TEXT NOT NULL, "method" TEXT NOT NULL, "resource" TEXT NOT NULL,
 "status" INTEGER NOT NULL, "ip" TEXT NOT NULL,
 CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminAuditEvent_createdAt_id_idx" ON "AdminAuditEvent"("createdAt", "id");
CREATE INDEX "AdminAuditEvent_action_createdAt_idx" ON "AdminAuditEvent"("action", "createdAt");
