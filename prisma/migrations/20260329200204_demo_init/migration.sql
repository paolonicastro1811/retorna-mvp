-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "contactable_status" TEXT NOT NULL DEFAULT 'contactable',
ADD COLUMN     "whatsapp_opt_in_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_opt_in_status" TEXT NOT NULL DEFAULT 'unknown';

-- CreateIndex
CREATE INDEX "customers_restaurant_id_whatsapp_opt_in_status_idx" ON "customers"("restaurant_id", "whatsapp_opt_in_status");
