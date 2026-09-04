-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `phone` VARCHAR(32) NULL,
    `location` VARCHAR(120) NULL,
    `avatarColor` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `grade` VARCHAR(32) NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `pricePerQuintal` DECIMAL(12, 2) NOT NULL,
    `seller` VARCHAR(120) NOT NULL,
    `sellerRating` DECIMAL(3, 2) NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `location` VARCHAR(120) NULL,
    `distanceKm` DECIMAL(10, 2) NULL,
    `transportCost` DECIMAL(12, 2) NULL,
    `otherCosts` DECIMAL(12, 2) NULL,
    `dealScore` INTEGER NULL,
    `imageFile` VARCHAR(255) NULL,
    `description` TEXT NULL,

    INDEX `Product_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Requirement` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NULL,
    `cropName` VARCHAR(120) NOT NULL,
    `grade` VARCHAR(32) NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `maxPricePerQuintal` DECIMAL(12, 2) NOT NULL,
    `location` VARCHAR(120) NOT NULL,
    `postedDate` DATE NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'active',
    `offerCount` INTEGER NOT NULL DEFAULT 0,
    `requiredBy` VARCHAR(32) NULL,
    `notes` VARCHAR(255) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `Requirement_userId_idx`(`userId`),
    INDEX `Requirement_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Offer` (
    `id` VARCHAR(64) NOT NULL,
    `requirementId` VARCHAR(64) NULL,
    `productId` VARCHAR(64) NULL,
    `sellerName` VARCHAR(120) NOT NULL,
    `sellerRating` DECIMAL(3, 2) NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `offeredPricePerQuintal` DECIMAL(12, 2) NOT NULL,
    `distanceKm` DECIMAL(10, 2) NULL,
    `transportCostPerQuintal` DECIMAL(12, 2) NULL,
    `otherCostsPerQuintal` DECIMAL(12, 2) NULL,
    `dealScore` INTEGER NULL,
    `shortlisted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `Offer_requirementId_idx`(`requirementId`),
    INDEX `Offer_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NULL,
    `requirementId` VARCHAR(64) NULL,
    `offerId` VARCHAR(64) NULL,
    `orderDate` DATE NOT NULL,
    `productName` VARCHAR(120) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `pricePerQuintal` DECIMAL(12, 2) NOT NULL,
    `transportCost` DECIMAL(12, 2) NOT NULL,
    `otherCharges` DECIMAL(12, 2) NOT NULL,
    `platformFee` DECIMAL(12, 2) NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `deliveryAddress` VARCHAR(255) NOT NULL,
    `paymentMethod` VARCHAR(64) NOT NULL DEFAULT 'Bank Transfer',
    `sellerName` VARCHAR(120) NOT NULL,
    `status` VARCHAR(32) NOT NULL,
    `timeline` JSON NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `Order_requirementId_idx`(`requirementId`),
    INDEX `Order_offerId_idx`(`offerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Requirement` ADD CONSTRAINT `Requirement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `Requirement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Offer` ADD CONSTRAINT `Offer_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_requirementId_fkey` FOREIGN KEY (`requirementId`) REFERENCES `Requirement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `Offer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
