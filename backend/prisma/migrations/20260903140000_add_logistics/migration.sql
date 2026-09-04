-- CreateTable: order-level logistics/delivery status (Phase 3). Each row is tied
-- to exactly one order via a unique orderId (no duplicate order identifiers).
-- `status` follows a fixed lifecycle: pending -> pickup -> in_transit ->
-- delivered, with `cancelled` allowed from any non-terminal state. Only an
-- authorized party (the buying user) may change status; both parties may view.
CREATE TABLE `Logistics` (
    `id` VARCHAR(64) NOT NULL,
    `orderId` VARCHAR(64) NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
    `updatedBy` VARCHAR(64) NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updatedAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `Logistics_orderId_key`(`orderId`),
    INDEX `Logistics_orderId_idx`(`orderId`),
    INDEX `Logistics_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: logistics belongs to an order; cascade-delete with the order.
ALTER TABLE `Logistics` ADD CONSTRAINT `Logistics_orderId_fkey`
FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
