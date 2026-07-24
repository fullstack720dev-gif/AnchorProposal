-- CreateTable
CREATE TABLE IF NOT EXISTS "template_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateVersionId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeTo" TIMESTAMP(3),

    CONSTRAINT "template_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "template_assignments_userId_templateVersionId_key" ON "template_assignments"("userId", "templateVersionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "template_assignments_userId_idx" ON "template_assignments"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "template_assignments" ADD CONSTRAINT "template_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "template_assignments" ADD CONSTRAINT "template_assignments_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
