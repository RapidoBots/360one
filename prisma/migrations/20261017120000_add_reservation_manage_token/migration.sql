-- AlterTable: add as nullable first so existing rows can be backfilled
ALTER TABLE "reservation" ADD COLUMN "manageToken" TEXT;

-- Backfill existing rows with a unique random token
UPDATE "reservation" SET "manageToken" = gen_random_uuid()::text WHERE "manageToken" IS NULL;

-- Now enforce NOT NULL and uniqueness
ALTER TABLE "reservation" ALTER COLUMN "manageToken" SET NOT NULL;
CREATE UNIQUE INDEX "reservation_manageToken_key" ON "reservation"("manageToken");
