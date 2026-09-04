-- Per-restaurant override for the widget's post-submit screen text.
ALTER TABLE "restaurant" ADD COLUMN "successMessage" TEXT;
ALTER TABLE "restaurant" ADD COLUMN "successButtonText" TEXT;
