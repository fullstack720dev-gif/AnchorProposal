-- Remap deprecated application statuses onto the canonical pipeline.
UPDATE "applications" SET "status" = 'SAVED' WHERE "status" = 'READY_TO_APPLY';
UPDATE "applications" SET "status" = 'APPLIED' WHERE "status" = 'RECRUITER_CONTACTED';

UPDATE "application_status_history" SET "fromStatus" = 'SAVED' WHERE "fromStatus" = 'READY_TO_APPLY';
UPDATE "application_status_history" SET "fromStatus" = 'APPLIED' WHERE "fromStatus" = 'RECRUITER_CONTACTED';
UPDATE "application_status_history" SET "toStatus" = 'SAVED' WHERE "toStatus" = 'READY_TO_APPLY';
UPDATE "application_status_history" SET "toStatus" = 'APPLIED' WHERE "toStatus" = 'RECRUITER_CONTACTED';
