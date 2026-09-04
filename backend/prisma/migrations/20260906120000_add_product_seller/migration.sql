-- AlterTable: attach the authenticated seller to the product listing (Sell Crop).
-- `sellerUserId` links a posted crop back to the farmer's account so that
-- ownership is enforced server-side (a seller cannot make an offer on their own
-- product) and so a creation flow can set the seller identity from the token.
-- Existing seeded products (no owning user) have NULL, which keeps them intact.
ALTER TABLE `Product` ADD COLUMN `sellerUserId` VARCHAR(64) NULL;

-- AddForeignKey: the farmer who listed this product. Deleting the user clears
-- the link rather than deleting their listings.
ALTER TABLE `Product` ADD CONSTRAINT `Product_sellerUserId_fkey` FOREIGN KEY (`sellerUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
