-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BIDDER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'READY_TO_APPLY', 'APPLIED', 'RECRUITER_CONTACTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN', 'CLOSED');
CREATE TYPE "GenerationStatus" AS ENUM ('QUEUED', 'VALIDATING', 'GENERATING', 'RENDERING', 'UPLOADING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "WarningSeverity" AS ENUM ('INFO', 'CONFIRM', 'ADMIN_REVIEW', 'BLOCK');
CREATE TYPE "WarningBehavior" AS ENUM ('WARN', 'CONFIRM', 'ADMIN_REVIEW', 'BLOCK');
CREATE TYPE "WarningCategory" AS ENUM ('REMOTE_CONFLICT', 'CLEARANCE', 'TRUST_BACKGROUND', 'CITIZENSHIP', 'TRAVEL_LOCATION', 'DUPLICATE');
CREATE TYPE "FileType" AS ENUM ('PDF', 'DOCX', 'TXT');
CREATE TYPE "WorkArrangement" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BIDDER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLogin" TIMESTAMP(3),
    "canCreateApplications" BOOLEAN NOT NULL DEFAULT true,
    "canGenerateResumes" BOOLEAN NOT NULL DEFAULT true,
    "canDownloadDocuments" BOOLEAN NOT NULL DEFAULT true,
    "refreshToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "profileTitle" TEXT,
    "summary" TEXT,
    "workAuthorization" TEXT,
    "remoteOnly" BOOLEAN NOT NULL DEFAULT true,
    "preferredRoles" TEXT,
    "archivedAt" TIMESTAMP(3),
    "defaultTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_experiences" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "workArrangement" "WorkArrangement" NOT NULL DEFAULT 'UNKNOWN',
    "startDate" TEXT,
    "endDate" TEXT,
    "responsibilities" TEXT,
    "achievements" TEXT,
    "technologies" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "profile_experiences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_education" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "major" TEXT,
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "profile_education_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_skills" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "profile_skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_certifications" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" TEXT,
    "expirationDate" TEXT,
    "credentialId" TEXT,
    "credentialUrl" TEXT,
    CONSTRAINT "profile_certifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_links" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "profile_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeTo" TIMESTAMP(3),
    CONSTRAINT "profile_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "profile_assignments_userId_profileId_key" ON "profile_assignments"("userId", "profileId");
CREATE INDEX "profile_assignments_userId_idx" ON "profile_assignments"("userId");

CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "bidderId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "normalizedCompany" TEXT NOT NULL,
    "location" TEXT,
    "workArrangement" "WorkArrangement" NOT NULL DEFAULT 'UNKNOWN',
    "source" TEXT,
    "jobUrl" TEXT,
    "jobDescription" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "applications_normalizedCompany_profileId_idx" ON "applications"("normalizedCompany", "profileId");
CREATE INDEX "applications_status_idx" ON "applications"("status");
CREATE INDEX "applications_bidderId_idx" ON "applications"("bidderId");

CREATE TABLE "application_status_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "actorId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_notes" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_warnings" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "category" "WarningCategory" NOT NULL,
    "matchedText" TEXT NOT NULL,
    "severity" "WarningSeverity" NOT NULL,
    "behavior" "WarningBehavior" NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "overrideReason" TEXT,
    "overriddenById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_warnings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preset" TEXT,
    "configJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resume_generations" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "promptVersionId" TEXT,
    "templateVersionId" TEXT,
    "profileSnapshotJson" JSONB,
    "structuredOutputJson" JSONB,
    "tokenUsage" INTEGER,
    "costEstimate" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "resume_generations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resume_generations_idempotencyKey_key" ON "resume_generations"("idempotencyKey");
CREATE INDEX "resume_generations_applicationId_idx" ON "resume_generations"("applicationId");

CREATE TABLE "generation_files" (
    "id" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "type" "FileType" NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generation_files_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "warning_rules" (
    "id" TEXT NOT NULL,
    "category" "WarningCategory" NOT NULL,
    "pattern" TEXT NOT NULL,
    "severity" "WarningSeverity" NOT NULL,
    "behavior" "WarningBehavior" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "warning_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "changesJson" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_action_idx" ON "audit_events"("action");
CREATE INDEX "audit_events_targetType_targetId_idx" ON "audit_events"("targetType", "targetId");

CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "profile_experiences" ADD CONSTRAINT "profile_experiences_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_education" ADD CONSTRAINT "profile_education_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_skills" ADD CONSTRAINT "profile_skills_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_certifications" ADD CONSTRAINT "profile_certifications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_links" ADD CONSTRAINT "profile_links_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_assignments" ADD CONSTRAINT "profile_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_assignments" ADD CONSTRAINT "profile_assignments_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "applications" ADD CONSTRAINT "applications_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_warnings" ADD CONSTRAINT "application_warnings_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resume_generations" ADD CONSTRAINT "resume_generations_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "generation_files" ADD CONSTRAINT "generation_files_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "resume_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
