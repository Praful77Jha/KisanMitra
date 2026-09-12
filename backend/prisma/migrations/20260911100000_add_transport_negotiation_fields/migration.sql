-- Transport & Logistics Redesign (Phase 1): negotiation-aware offers, capacity
-- matching, request budgeting/coordinates, and requester-transporter chat.
-- TransporterProfile.vehicleCapacity records max load in quintals so transport
-- requests can be matched against compatible transporters.
-- TransportRequest gains an optional expectedBudget, server-computed distanceKm,
-- and optional pickup/drop coordinates for automatic distance estimation.
-- TransportOffer becomes a negotiation thread: parentOfferId links a counter
-- offer to the quote it answers, offerType is INITIAL|COUNTER|FINAL, and
-- negotiationRound tracks depth in the thread.
-- New TransportChatMessage model: persistent requester-transporter messaging
-- scoped to a single transport request, kept SEPARATE from the order-scoped
-- ChatMessage to avoid a breaking change to existing order chat.

-- AlterTable
ALTER TABLE `TransporterProfile` ADD COLUMN `vehicleCapacity` DECIMAL(8, 2) NULL;

-- AlterTable
ALTER TABLE `TransportOffer` ADD COLUMN `parentOfferId` VARCHAR(64) NULL,
    ADD COLUMN `offerType` VARCHAR(16) NOT NULL DEFAULT 'INITIAL',
    ADD COLUMN `negotiationRound` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `TransportRequest` ADD COLUMN `expectedBudget` DECIMAL(12, 2) NULL,
    ADD COLUMN `distanceKm` DECIMAL(10, 2) NULL,
    ADD COLUMN `pickupLat` DECIMAL(9, 6) NULL,
    ADD COLUMN `pickupLng` DECIMAL(9, 6) NULL,
    ADD COLUMN `dropLat` DECIMAL(9, 6) NULL,
    ADD COLUMN `dropLng` DECIMAL(9, 6) NULL;

-- CreateTable
CREATE TABLE `TransportChatMessage` (
    `id` VARCHAR(64) NOT NULL,
    `transportRequestId` VARCHAR(64) NOT NULL,
    `senderId` VARCHAR(64) NOT NULL,
    `body` VARCHAR(2000) NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `TransportChatMessage_transportRequestId_idx`(`transportRequestId`),
    INDEX `TransportChatMessage_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `TransportOffer_parentOfferId_idx` ON `TransportOffer`(`parentOfferId`);

-- AddForeignKey
ALTER TABLE `TransportOffer` ADD CONSTRAINT `TransportOffer_parentOfferId_fkey` FOREIGN KEY (`parentOfferId`) REFERENCES `TransportOffer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportChatMessage` ADD CONSTRAINT `TransportChatMessage_transportRequestId_fkey` FOREIGN KEY (`transportRequestId`) REFERENCES `TransportRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransportChatMessage` ADD CONSTRAINT `TransportChatMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;