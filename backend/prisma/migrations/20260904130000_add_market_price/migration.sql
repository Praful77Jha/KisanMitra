-- CreateTable
CREATE TABLE `MarketPrice` (
    `id` VARCHAR(64) NOT NULL,
    `cropName` VARCHAR(120) NOT NULL,
    `marketName` VARCHAR(120) NOT NULL,
    `pricePerQtl` DECIMAL(12, 2) NOT NULL,
    `referenceDate` DATE NOT NULL,
    `source` VARCHAR(64) NOT NULL DEFAULT 'MSAMB',
    `unit` VARCHAR(32) NOT NULL DEFAULT 'Quintal',
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `MarketPrice_cropName_marketName_referenceDate_key`(`cropName`, `marketName`, `referenceDate`),
    INDEX `MarketPrice_cropName_idx`(`cropName`),
    INDEX `MarketPrice_marketName_idx`(`marketName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
