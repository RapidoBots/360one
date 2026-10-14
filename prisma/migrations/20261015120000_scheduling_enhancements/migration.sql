-- Premium feature flag
ALTER TABLE "restaurant" ADD COLUMN "schedulingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Custom position support
ALTER TABLE "user" ADD COLUMN "customPosition" TEXT;
ALTER TABLE "shift" ADD COLUMN "customPosition" TEXT;

-- Shift exchange
CREATE TYPE "ExchangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "shift_exchange" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "requesterShiftId" TEXT NOT NULL,
    "targetShiftId" TEXT NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_exchange_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "shift_exchange" ADD CONSTRAINT "shift_exchange_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_exchange" ADD CONSTRAINT "shift_exchange_requesterShiftId_fkey" FOREIGN KEY ("requesterShiftId") REFERENCES "shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shift_exchange" ADD CONSTRAINT "shift_exchange_targetShiftId_fkey" FOREIGN KEY ("targetShiftId") REFERENCES "shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
