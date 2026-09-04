-- CreateTable: persistent buyer-seller messaging for an order (Phase 7).
-- A conversation is scoped to a single order; only the order's two parties may
-- read or send messages (party-scoped access mirroring reviews and logistics).
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(64) NOT NULL,
    `orderId` VARCHAR(64) NOT NULL,
    `senderId` VARCHAR(64) NOT NULL,
    `body` VARCHAR(2000) NOT NULL,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `ChatMessage_orderId_idx`(`orderId`),
    INDEX `ChatMessage_senderId_idx`(`senderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: a chat message belongs to the order it discusses.
-- It is deleted (cascade) with the order.
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: the sending party of the message.
-- It is deleted (cascade) with the user.
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
