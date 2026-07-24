-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managedByAdminId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_managedByAdminId_idx" ON "users"("managedByAdminId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_managedByAdminId_fkey"
    FOREIGN KEY ("managedByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "GenerationFileKind" AS ENUM ('RESUME', 'COVER_LETTER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "generation_files" ADD COLUMN IF NOT EXISTS "kind" "GenerationFileKind" NOT NULL DEFAULT 'RESUME';
