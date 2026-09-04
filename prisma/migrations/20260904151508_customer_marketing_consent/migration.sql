-- Optional consent checkbox on the widget's contact form ("I'd like to
-- receive promotions and special offers").
ALTER TABLE "customer" ADD COLUMN "marketingConsent" BOOLEAN NOT NULL DEFAULT false;
