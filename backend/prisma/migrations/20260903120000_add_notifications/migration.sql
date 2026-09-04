-- CreateTable: in-app notifications (Phase 2). Each row targets one user and
-- records an app event (offer received, order placed, review received). The
-- `read` flag drives the unread badge on the home bell.
CREATE TABLE `Notification` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(64) NOT NULL,
    `type` VARCHAR(32) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `refType` VARCHAR(32) NULL,
    `refId` VARCHAR(64) NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `Notification_userId_idx`(`userId`),
    INDEX `Notification_read_idx`(`read`),
    INDEX `Notification_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: notification belongs to a user; cascade-delete with the user.
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
