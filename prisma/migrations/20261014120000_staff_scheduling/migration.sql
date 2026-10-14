-- CreateEnum
CREATE TYPE "StaffPosition" AS ENUM ('SERVER', 'HOST', 'CHEF', 'BARTENDER', 'MANAGER', 'OTHER');

-- AlterTable: add position to user
ALTER TABLE "user" ADD COLUMN "position" "StaffPosition";

-- CreateTable
CREATE TABLE "shift" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "position" "StaffPosition" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_userId_date_startTime_key" ON "shift"("userId", "date", "startTime");

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift" ADD CONSTRAINT "shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
