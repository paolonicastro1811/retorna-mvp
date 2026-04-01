-- AlterTable
ALTER TABLE "restaurant_tables" ADD COLUMN     "height" DOUBLE PRECISION DEFAULT 10,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "pos_x" DOUBLE PRECISION,
ADD COLUMN     "pos_y" DOUBLE PRECISION,
ADD COLUMN     "width" DOUBLE PRECISION DEFAULT 10;

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "room_layout" JSONB;
