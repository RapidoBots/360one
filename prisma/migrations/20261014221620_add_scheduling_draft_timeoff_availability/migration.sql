-- CreateEnum
CREATE TYPE "TimeOffStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- AlterTable
ALTER TABLE "shift" ADD COLUMN     "draft" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "availabilityOff" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- CreateTable
CREATE TABLE "time_off_request" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "reason" TEXT,
    "status" "TimeOffStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_off_request_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "time_off_request" ADD CONSTRAINT "time_off_request_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_off_request" ADD CONSTRAINT "time_off_request_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
