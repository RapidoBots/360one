-- CreateTable
CREATE TABLE "closed_date" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "closed_date_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_slot" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_slot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closed_date_restaurantId_date_key" ON "closed_date"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_slot_restaurantId_date_time_key" ON "blocked_slot"("restaurantId", "date", "time");

-- AddForeignKey
ALTER TABLE "closed_date" ADD CONSTRAINT "closed_date_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_slot" ADD CONSTRAINT "blocked_slot_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
