-- Transporter Feature (Phase 2A): schema for the Transport & Logistics module.
-- Adds User.role (default FARMER; existing users migrate safely).
-- New models: TransporterProfile, TransportRequest, TransportOffer, TransportJob,
-- TransportReview. Kept separate from Logistics/Offer/Review per the approved
-- architecture (logistics is order-unique & buyer-driven; offers are
-- requirement-owner scoped; reviews are order-based).

-- AlterTable
ALTER TABLE `User` ADD COLUMN `role` VARCHAR(32) NOT NULL DEFAULT 'FARMER';

-- CreateTable
CREATE TABLE `TransporterProfile` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `vehicleTypes` VARCHAR(255) NOT NULL,
    `baseLocation` VARCHAR(120) NOT NULL,
    `description` VARCHAR(500) NULL,
    `avgRating` DECIMAL(3, 2) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `TransporterProfile_userId_key`(`userId`),
    INDEX `TransporterProfile_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportRequest` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NULL,
    `cropName` VARCHAR(120) NOT NULL,
    `quantity` DECIMAL(12, 2) NOT NULL,
    `unit` VARCHAR(32) NOT NULL,
    `pickupLocation` VARCHAR(120) NOT NULL,
    `dropLocation` VARCHAR(120) NOT NULL,
    `requiredBy` VARCHAR(32) NULL,
    `vehicleType` VARCHAR(32) NULL,
    `notes` VARCHAR(500) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    `orderId` VARCHAR(64) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `TransportRequest_userId_idx`(`userId`),
    INDEX `TransportRequest_status_idx`(`status`),
    INDEX `TransportRequest_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportOffer` (
    `id` VARCHAR(64) NOT NULL,
    `transportRequestId` VARCHAR(64) NOT NULL,
    `transporterId` VARCHAR(64) NOT NULL,
    `transporterName` VARCHAR(120) NOT NULL,
    `quotedAmount` DECIMAL(12, 2) NOT NULL,
    `vehicleType` VARCHAR(32) NOT NULL,
    `distanceKm` DECIMAL(10, 2) NULL,
    `notes` VARCHAR(500) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `TransportOffer_transportRequestId_idx`(`transportRequestId`),
    INDEX `TransportOffer_transporterId_idx`(`transporterId`),
    INDEX `TransportOffer_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportJob` (
    `id` VARCHAR(64) NOT NULL,
    `transportRequestId` VARCHAR(64) NOT NULL,
    `transportOfferId` VARCHAR(64) NOT NULL,
    `transporterId` VARCHAR(64) NOT NULL,
    `orderId` VARCHAR(64) NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'BOOKED',
    `updatedBy` VARCHAR(64) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    UNIQUE INDEX `TransportJob_transportOfferId_key`(`transportOfferId`),
    INDEX `TransportJob_transportRequestId_idx`(`transportRequestId`),
    INDEX `TransportJob_transporterId_idx`(`transporterId`),
    INDEX `TransportJob_status_idx`(`status`),
    INDEX `TransportJob_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportReview` (
    `id` VARCHAR(64) NOT NULL,
    `jobId` VARCHAR(64) NOT NULL,
    `reviewerId` VARCHAR(64) NOT NULL,
    `transporterId` VARCHAR(64) NOT NULL,
    `rating` INTEGER NOT NULL,
    `comment` VARCHAR(1200) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL,

    INDEX `TransportReview_transporterId_idx`(`transporterId`),
    INDEX `TransportReview_jobId_idx`(`jobId`),
    UNIQUE INDEX `TransportReview_jobId_reviewerId_key`(`jobId`, `reviewerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TransporterProfile` ADD CONSTRAINT `TransporterProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportRequest` ADD CONSTRAINT `TransportRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportRequest` ADD CONSTRAINT `TransportRequest_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportOffer` ADD CONSTRAINT `TransportOffer_transportRequestId_fkey` FOREIGN KEY (`transportRequestId`) REFERENCES `TransportRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportOffer` ADD CONSTRAINT `TransportOffer_transporterId_fkey` FOREIGN KEY (`transporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportJob` ADD CONSTRAINT `TransportJob_transportRequestId_fkey` FOREIGN KEY (`transportRequestId`) REFERENCES `TransportRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportJob` ADD CONSTRAINT `TransportJob_transportOfferId_fkey` FOREIGN KEY (`transportOfferId`) REFERENCES `TransportOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportJob` ADD CONSTRAINT `TransportJob_transporterId_fkey` FOREIGN KEY (`transporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportJob` ADD CONSTRAINT `TransportJob_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportReview` ADD CONSTRAINT `TransportReview_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `TransportJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportReview` ADD CONSTRAINT `TransportReview_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportReview` ADD CONSTRAINT `TransportReview_transporterId_fkey` FOREIGN KEY (`transporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;