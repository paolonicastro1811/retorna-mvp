-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "wa_access_token" TEXT,
ADD COLUMN     "wa_connected_at" TIMESTAMP(3),
ADD COLUMN     "wa_phone_number" TEXT,
ADD COLUMN     "wa_phone_number_id" TEXT,
ADD COLUMN     "waba_id" TEXT;
