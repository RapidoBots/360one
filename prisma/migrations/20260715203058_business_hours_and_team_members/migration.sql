-- AlterTable
ALTER TABLE "restaurant" ADD COLUMN     "defaultReservationDurationMinutes" INTEGER NOT NULL DEFAULT 90;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime" TEXT,
    "closeTime" TEXT,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_restaurantId_dayOfWeek_key" ON "business_hours"("restaurantId", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
