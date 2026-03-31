-- CreateTable
CREATE TABLE "conversation_replies" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "message_text" TEXT NOT NULL,
    "intent" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_replies_customer_id_idx" ON "conversation_replies"("customer_id");

-- CreateIndex
CREATE INDEX "conversation_replies_restaurant_id_sent_at_idx" ON "conversation_replies"("restaurant_id", "sent_at");

-- AddForeignKey
ALTER TABLE "conversation_replies" ADD CONSTRAINT "conversation_replies_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_replies" ADD CONSTRAINT "conversation_replies_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
