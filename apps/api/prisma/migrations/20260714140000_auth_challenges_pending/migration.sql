-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AuthChallengePurpose" AS ENUM ('SIGNUP', 'LOGIN', 'RESET');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "auth_challenges" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "AuthChallengePurpose" NOT NULL,
    "codeHash" TEXT,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "auth_challenges_email_purpose_idx" ON "auth_challenges"("email", "purpose");
CREATE INDEX IF NOT EXISTS "auth_challenges_tokenHash_idx" ON "auth_challenges"("tokenHash");
