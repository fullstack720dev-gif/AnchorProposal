-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "useMasterPrompt" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "prompt_versions" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "prompt_versions_ownerId_idx" ON "prompt_versions"("ownerId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
