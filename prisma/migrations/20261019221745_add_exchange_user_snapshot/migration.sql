-- AlterTable
ALTER TABLE "shift_exchange" ADD COLUMN     "requesterUserId" TEXT,
ADD COLUMN     "requesterUserName" TEXT,
ADD COLUMN     "targetUserId" TEXT,
ADD COLUMN     "targetUserName" TEXT;
