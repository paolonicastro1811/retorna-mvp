-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "acquisition_source" TEXT;

-- CreateTable
CREATE TABLE "inbound_messages" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "message_text" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'whatsapp',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_messages_customer_id_idx" ON "inbound_messages"("customer_id");

-- CreateIndex
CREATE INDEX "inbound_messages_restaurant_id_received_at_idx" ON "inbound_messages"("restaurant_id", "received_at");

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
