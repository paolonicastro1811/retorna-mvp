-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "attribution_window_days" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "lifecycle_status" TEXT NOT NULL DEFAULT 'active',
    "total_visits" INTEGER NOT NULL DEFAULT 0,
    "total_spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_ticket" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_visit_at" TIMESTAMP(3),
    "is_frequent" BOOLEAN NOT NULL DEFAULT false,
    "is_high_spender" BOOLEAN NOT NULL DEFAULT false,
    "last_reactivated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_events" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'visit',
    "amount" DOUBLE PRECISION,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "segment_rules" JSONB NOT NULL,
    "template_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_audience_items" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_audience_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "provider_msg_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "fail_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_events" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactivation_attributions" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactivation_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "file_name" TEXT,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_restaurant_id_idx" ON "customers"("restaurant_id");

-- CreateIndex
CREATE INDEX "customers_restaurant_id_lifecycle_status_idx" ON "customers"("restaurant_id", "lifecycle_status");

-- CreateIndex
CREATE INDEX "customers_restaurant_id_is_frequent_idx" ON "customers"("restaurant_id", "is_frequent");

-- CreateIndex
CREATE INDEX "customers_restaurant_id_is_high_spender_idx" ON "customers"("restaurant_id", "is_high_spender");

-- CreateIndex
CREATE UNIQUE INDEX "customers_restaurant_id_phone_key" ON "customers"("restaurant_id", "phone");

-- CreateIndex
CREATE INDEX "customer_events_customer_id_idx" ON "customer_events"("customer_id");

-- CreateIndex
CREATE INDEX "customer_events_restaurant_id_occurred_at_idx" ON "customer_events"("restaurant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "campaigns_restaurant_id_idx" ON "campaigns"("restaurant_id");

-- CreateIndex
CREATE INDEX "campaigns_restaurant_id_status_idx" ON "campaigns"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "campaign_audience_items_campaign_id_idx" ON "campaign_audience_items"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_audience_items_campaign_id_customer_id_key" ON "campaign_audience_items"("campaign_id", "customer_id");

-- CreateIndex
CREATE INDEX "message_templates_restaurant_id_idx" ON "message_templates"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_messages_provider_msg_id_key" ON "outbound_messages"("provider_msg_id");

-- CreateIndex
CREATE INDEX "outbound_messages_campaign_id_idx" ON "outbound_messages"("campaign_id");

-- CreateIndex
CREATE INDEX "outbound_messages_customer_id_idx" ON "outbound_messages"("customer_id");

-- CreateIndex
CREATE INDEX "outbound_messages_restaurant_id_status_idx" ON "outbound_messages"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "outbound_messages_provider_msg_id_idx" ON "outbound_messages"("provider_msg_id");

-- CreateIndex
CREATE INDEX "message_events_message_id_idx" ON "message_events"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactivation_attributions_message_id_key" ON "reactivation_attributions"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactivation_attributions_visit_id_key" ON "reactivation_attributions"("visit_id");

-- CreateIndex
CREATE INDEX "reactivation_attributions_customer_id_idx" ON "reactivation_attributions"("customer_id");

-- CreateIndex
CREATE INDEX "reactivation_attributions_message_id_idx" ON "reactivation_attributions"("message_id");

-- CreateIndex
CREATE INDEX "import_jobs_restaurant_id_idx" ON "import_jobs"("restaurant_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "message_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audience_items" ADD CONSTRAINT "campaign_audience_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_audience_items" ADD CONSTRAINT "campaign_audience_items_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_events" ADD CONSTRAINT "message_events_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "outbound_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactivation_attributions" ADD CONSTRAINT "reactivation_attributions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "outbound_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactivation_attributions" ADD CONSTRAINT "reactivation_attributions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactivation_attributions" ADD CONSTRAINT "reactivation_attributions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "customer_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
