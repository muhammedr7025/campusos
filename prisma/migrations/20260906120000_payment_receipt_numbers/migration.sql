-- Human-readable receipt numbers for payments.
-- Added nullable so existing rows can be backfilled in place, then made
-- unique per tenant. New payments get their number from logPayment.

ALTER TABLE "payments" ADD COLUMN "receiptNumber" TEXT;

-- Backfill 1: real payments, numbered per tenant oldest-first.
WITH numbered AS (
  SELECT
    id,
    'RCP-' || LPAD((ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id))::text, 4, '0') AS rcp
  FROM "payments"
  WHERE "correctionOfId" IS NULL
)
UPDATE "payments" p
SET "receiptNumber" = n.rcp
FROM numbered n
WHERE p.id = n.id;

-- Backfill 2: corrections carry the original's number with an -R suffix.
-- The row_number guard only matters for historical rows: correctPayment now
-- refuses to reverse the same payment twice.
WITH corrections AS (
  SELECT
    id,
    "correctionOfId",
    ROW_NUMBER() OVER (PARTITION BY "correctionOfId" ORDER BY "createdAt", id) AS rn
  FROM "payments"
  WHERE "correctionOfId" IS NOT NULL
)
UPDATE "payments" p
SET "receiptNumber" = o."receiptNumber" || '-R' || CASE WHEN c.rn > 1 THEN c.rn::text ELSE '' END
FROM corrections c
JOIN "payments" o ON o.id = c."correctionOfId"
WHERE p.id = c.id AND o."receiptNumber" IS NOT NULL;

CREATE UNIQUE INDEX "payments_tenantId_receiptNumber_key" ON "payments"("tenantId", "receiptNumber");
