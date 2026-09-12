-- AlterTable: store the URL (relative path) of a farmer-uploaded crop photo
-- (Crop Image Upload V1). The value is served back by the API's static /api/uploads
-- route, e.g. '/uploads/crop-<ts>-<rand>.jpg'. Nullable and additive so existing
-- seeded products keep working untouched; the legacy `imageFile` column remains
-- for the bundled placeholder tile images.
ALTER TABLE `Product` ADD COLUMN `imageUrl` VARCHAR(500) NULL;