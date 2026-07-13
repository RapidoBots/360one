-- CreateEnum
CREATE TYPE "ContactChannel" AS ENUM ('EMAIL', 'SMS', 'CALL');

-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "preferredContact" "ContactChannel" NOT NULL DEFAULT 'EMAIL';
