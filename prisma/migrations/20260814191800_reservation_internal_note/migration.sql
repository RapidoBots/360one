-- Staff-only note, distinct from the guest-facing specialRequests field.
ALTER TABLE "reservation" ADD COLUMN "internalNote" TEXT;
