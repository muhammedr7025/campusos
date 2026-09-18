-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RECEIVED';

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "requiredKycDocs" "KycDocType"[] DEFAULT ARRAY['ID_PROOF', 'PHOTO', 'ADDRESS_PROOF', 'PREVIOUS_MARKSHEET']::"KycDocType"[];

-- Backfill: students admitted to (or moved into) a division after an
-- assignment was posted there never got a submission row, so the work never
-- reached them. Give every enrolled student one for each assignment in their
-- current division.
INSERT INTO "submissions" ("id", "tenantId", "assignmentId", "studentId", "status", "createdAt", "updatedAt")
SELECT 'bf' || replace(gen_random_uuid()::text, '-', ''), a."tenantId", a."id", s."id", 'MISSING', now(), now()
FROM "assignments" a
JOIN "students" s ON s."divisionId" = a."divisionId" AND s."tenantId" = a."tenantId"
WHERE s."status" IN ('KYC_PENDING', 'ACTIVE')
  AND NOT EXISTS (
    SELECT 1 FROM "submissions" x WHERE x."assignmentId" = a."id" AND x."studentId" = s."id"
  );

-- Timetable rooms were stored as "" when left blank, which the room-clash
-- check then treated as a real room everyone shared.
UPDATE "timetables" SET "room" = NULL WHERE "room" IS NOT NULL AND btrim("room") = '';
