-- AlterTable: track the seller's user identity so ratings can be linked and
-- server-side ownership enforced for both rating directions.
ALTER TABLE `Offer` ADD COLUMN `sellerUserId` VARCHAR(64) NULL;

ALTER TABLE `Order` ADD COLUMN `sellerUserId` VARCHAR(64) NULL;

-- CreateTable: ratings & reviews attached to a completed order.
CREATE TABLE `Review` (
    `id` VARCHAR(64) NOT NULL,
    `orderId` VARCHAR(64) NOT NULL,
    `reviewerId` VARCHAR(64) NOT NULL,
    `reviewedUserId` VARCHAR(64) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(1200) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Review_orderId_reviewerId_key`(`orderId`, `reviewerId`),
    INDEX `Review_reviewedUserId_idx`(`reviewedUserId`),
    INDEX `Review_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: a review is tied to the completed order it rates; cascade with it.
ALTER TABLE `Review` ADD CONSTRAINT `Review_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: the reviewer (who wrote the review); cascade with the user.
ALTER TABLE `Review` ADD CONSTRAINT `Review_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: the reviewed user (the trading partner being rated); cascade with the user.
ALTER TABLE `Review` ADD CONSTRAINT `Review_reviewedUserId_fkey` FOREIGN KEY (`reviewedUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
