-- AlterTable
ALTER TABLE `User` ADD COLUMN `passwordHash` VARCHAR(255) NOT NULL,
    MODIFY `phone` VARCHAR(32) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_phone_key` ON `User`(`phone`);
