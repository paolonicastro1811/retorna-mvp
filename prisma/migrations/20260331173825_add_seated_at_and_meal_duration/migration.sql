-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "seated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "avg_meal_duration_minutes" INTEGER NOT NULL DEFAULT 90;
