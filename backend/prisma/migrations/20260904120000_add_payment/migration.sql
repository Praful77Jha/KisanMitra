-- AlterTable: attach payment state handling to the existing order (Phase 5).
-- `paymentState` follows: pending -> paid / failed / cancelled; `failed` may
-- retry to pending/paid/cancelled; `paid` and `cancelled` are terminal. The
-- payable amount is always derived from the existing `totalAmount` server-side.
ALTER TABLE `Order` ADD COLUMN `paymentState` VARCHAR(32) NOT NULL DEFAULT 'pending',
    ADD COLUMN `paymentRef` VARCHAR(128) NULL,
    ADD COLUMN `paidAt` TIMESTAMP(0) NULL;
