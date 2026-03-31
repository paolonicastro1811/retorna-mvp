-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'manual';

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "table_number" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_hours" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "restaurant_hours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restaurant_tables_restaurant_id_idx" ON "restaurant_tables"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_restaurant_id_table_number_key" ON "restaurant_tables"("restaurant_id", "table_number");

-- CreateIndex
CREATE INDEX "restaurant_hours_restaurant_id_idx" ON "restaurant_hours"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_hours_restaurant_id_day_of_week_key" ON "restaurant_hours"("restaurant_id", "day_of_week");

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_hours" ADD CONSTRAINT "restaurant_hours_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
