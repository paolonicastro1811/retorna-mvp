-- AlterTable
ALTER TABLE "message_templates" ADD COLUMN     "hsm_language" TEXT NOT NULL DEFAULT 'pt_BR',
ADD COLUMN     "hsm_template_name" TEXT;

-- AlterTable
ALTER TABLE "outbound_messages" ADD COLUMN     "hsm_language" TEXT,
ADD COLUMN     "hsm_template_name" TEXT;
