-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MASTER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
