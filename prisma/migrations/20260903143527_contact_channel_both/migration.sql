-- Widget's "preferred way of communication" now offers Email / SMS / Both,
-- replacing "phone call" (kept in the enum for existing rows, no longer offered).
ALTER TYPE "ContactChannel" ADD VALUE 'BOTH';
