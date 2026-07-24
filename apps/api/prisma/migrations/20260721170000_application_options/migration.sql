-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ApplicationOptionType" AS ENUM ('LOCATION', 'SOURCE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "application_options" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ApplicationOptionType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "application_options_userId_type_normalizedValue_key"
  ON "application_options"("userId", "type", "normalizedValue");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "application_options_userId_type_idx"
  ON "application_options"("userId", "type");

-- One default per user/type
CREATE UNIQUE INDEX IF NOT EXISTS "application_options_one_default"
  ON "application_options"("userId", "type")
  WHERE "isDefault" = true;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "application_options"
    ADD CONSTRAINT "application_options_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed US / Builtin defaults for existing Admin and Bidder users
INSERT INTO "application_options" ("id", "userId", "type", "value", "normalizedValue", "isDefault", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'LOCATION', 'US', 'us', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE u."role" IN ('ADMIN', 'BIDDER')
  AND NOT EXISTS (
    SELECT 1 FROM "application_options" ao
    WHERE ao."userId" = u."id" AND ao."type" = 'LOCATION'
  );

INSERT INTO "application_options" ("id", "userId", "type", "value", "normalizedValue", "isDefault", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", 'SOURCE', 'Builtin', 'builtin', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "users" u
WHERE u."role" IN ('ADMIN', 'BIDDER')
  AND NOT EXISTS (
    SELECT 1 FROM "application_options" ao
    WHERE ao."userId" = u."id" AND ao."type" = 'SOURCE'
  );
