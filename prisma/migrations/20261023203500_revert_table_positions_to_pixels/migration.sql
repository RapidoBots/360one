-- Reverting the Floor Manager 3D rebuild back to the old 2D canvas: inverts
-- the one-time metres conversion from
-- 20261022200106_convert_table_positions_to_metres so Table.posX/posY/
-- width/height are pixel coordinates in the 1600x700px canvas again, using
-- each table's floor's width/depth (left in the schema, just unused by the
-- app again after this revert) the same way the forward conversion did.
UPDATE "table" t
SET "posX" = (("posX" + f."width" / 2.0) / f."width") * 1600.0,
    "posY" = (("posY" + f."depth" / 2.0) / f."depth") * 700.0
FROM "floor" f
WHERE t."floorId" = f."id" AND t."posX" IS NOT NULL AND t."posY" IS NOT NULL;

UPDATE "table"
SET "width" = "width" * 80.0
WHERE "width" IS NOT NULL;

UPDATE "table"
SET "height" = "height" * 80.0
WHERE "height" IS NOT NULL;
