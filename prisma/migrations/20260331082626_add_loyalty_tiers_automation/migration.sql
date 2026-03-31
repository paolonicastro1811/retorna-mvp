-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "birthday" DATE,
ADD COLUMN     "current_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_reactivation_sent_at" TIMESTAMP(3),
ADD COLUMN     "next_surprise_at" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "streak_updated_at" TIMESTAMP(3),
ADD COLUMN     "surprise_counter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" TEXT NOT NULL DEFAULT 'novo',
ADD COLUMN     "tier_upgraded_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "discount_frequente" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "discount_ouro" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "discount_prata" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "reactivation_after_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "streak_target_visits" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "streak_window_days" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "surprise_every_max_visits" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "surprise_every_min_visits" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "tier_frequente_min_visits" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "tier_ouro_min_visits" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN     "tier_prata_min_visits" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "automation_logs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "provider_msg_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_logs_restaurant_id_template_key_idx" ON "automation_logs"("restaurant_id", "template_key");

-- CreateIndex
CREATE INDEX "automation_logs_customer_id_idx" ON "automation_logs"("customer_id");

-- CreateIndex
CREATE INDEX "automation_logs_restaurant_id_created_at_idx" ON "automation_logs"("restaurant_id", "created_at");

-- AddForeignKey
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_logs" ADD CONSTRAINT "automation_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
