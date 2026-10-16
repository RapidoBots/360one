-- CreateEnum
CREATE TYPE "FeatureAccess" AS ENUM ('NONE', 'VIEW', 'EDIT');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "customersAccess" "FeatureAccess" NOT NULL DEFAULT 'EDIT',
ADD COLUMN     "floorManagerAccess" "FeatureAccess" NOT NULL DEFAULT 'EDIT',
ADD COLUMN     "reportsAccess" "FeatureAccess" NOT NULL DEFAULT 'EDIT',
ADD COLUMN     "reservationsAccess" "FeatureAccess" NOT NULL DEFAULT 'EDIT',
ADD COLUMN     "waitlistAccess" "FeatureAccess" NOT NULL DEFAULT 'EDIT';
