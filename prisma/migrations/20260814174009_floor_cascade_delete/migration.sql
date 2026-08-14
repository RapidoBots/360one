-- Every restaurant automatically gets a "Main Floor" the moment it's
-- created, so unlike Table (only created on demand), Floor rows always
-- exist for every restaurant. RESTRICT would block deleting a restaurant
-- (including the rollback path in createRestaurantAction when owner-account
-- creation fails) purely because it always has a floor. Floors have no
-- independent existence without their restaurant, so cascade instead.
ALTER TABLE "floor" DROP CONSTRAINT "floor_restaurantId_fkey";

ALTER TABLE "floor" ADD CONSTRAINT "floor_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
