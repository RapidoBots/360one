-- One-time data fix: Table.posX/posY were pixel coordinates in the old 2D
-- floor-plan canvas (1600x700px); the 3D floor manager uses real-world
-- metres instead. Converts every placed table's position into the metre
-- space of its own floor's room (Floor.width/depth), and any freeform
-- width/height override (also previously pixels) into metres at the same
-- 80px-per-metre ratio the 3D view already renders at. Runs once -- from
-- here on, posX/posY/width/height on "table" are always metres.
UPDATE "table" t
SET "posX" = ("posX" / 1600.0) * f."width" - f."width" / 2.0,
    "posY" = ("posY" / 700.0) * f."depth" - f."depth" / 2.0
FROM "floor" f
WHERE t."floorId" = f."id" AND t."posX" IS NOT NULL AND t."posY" IS NOT NULL;

UPDATE "table"
SET "width" = "width" / 80.0
WHERE "width" IS NOT NULL;

UPDATE "table"
SET "height" = "height" / 80.0
WHERE "height" IS NOT NULL;
