-- CreateTable
CREATE TABLE "floor" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "floor_restaurantId_name_key" ON "floor"("restaurantId", "name");

-- AddForeignKey
ALTER TABLE "floor" ADD CONSTRAINT "floor_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing restaurant gets a default "Main Floor" so
-- Table.floorId can become required below without leaving any restaurant
-- unable to add a table.
INSERT INTO "floor" ("id", "restaurantId", "name", "order", "createdAt")
SELECT 'floor_' || r."id", r."id", 'Main Floor', 0, CURRENT_TIMESTAMP
FROM "restaurant" r;

-- AlterTable: add floorId nullable first so it can be backfilled
ALTER TABLE "table" ADD COLUMN "floorId" TEXT;

-- Backfill existing tables onto their restaurant's default floor
UPDATE "table" SET "floorId" = 'floor_' || "restaurantId";

-- AlterTable: now that every row has a value, require it going forward
ALTER TABLE "table" ALTER COLUMN "floorId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "table" ADD CONSTRAINT "table_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
