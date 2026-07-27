-- AlterTable
ALTER TABLE "restaurant" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "mapsEmbedUrl" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'America/Toronto';
