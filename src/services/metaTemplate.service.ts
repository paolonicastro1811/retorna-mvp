// ============================================================
// Meta Template API Service
// Submits custom templates to Meta Business Manager for approval,
// and polls status updates.
//
// Uses WhatsApp Business Management API:
//   POST /{waba_id}/message_templates — create template
//   GET  /{waba_id}/message_templates?name=xxx — check status
//   DELETE /{waba_id}/message_templates?name=xxx — delete template
// ============================================================

import { prisma } from "../database/client";

export interface MetaTemplateResult {
  success: boolean;
  metaTemplateId?: string;
  status?: string;
  error?: string;
}

/**
 * Submit a custom template to Meta for approval.
 * Generates a unique hsmTemplateName from restaurant + template name.
 */
export async function submitTemplateToMeta(templateId: string): Promise<MetaTemplateResult> {
  const template = await prisma.messageTemplate.findUnique({
    where: { id: templateId },
    include: { restaurant: true },
  });

  if (!template) return { success: false, error: "Template not found" };
  if (!template.restaurant.wabaId) return { success: false, error: "Restaurant has no WABA ID. Connect WhatsApp first." };
  if (!template.restaurant.waAccessToken) return { success: false, error: "Restaurant has no WhatsApp access token." };

  // Generate unique template name for Meta (lowercase, underscores, max 512 chars)
  const hsmName = template.hsmTemplateName || generateHsmName(template.name);

  // Extract variables from body: {{customer_name}} → component parameter
  const bodyText = template.body;
  const variables = bodyText.match(/\{\{(\w+)\}\}/g) || [];
  const exampleValues = variables.map((v) => {
    if (v === "{{customer_name}}") return "Maria";
    return "exemplo";
  });

  // Replace {{customer_name}} with {{1}} for Meta format
  let metaBody = bodyText;
  variables.forEach((v, i) => {
    metaBody = metaBody.replace(v, `{{${i + 1}}}`);
  });

  const components: any[] = [
    {
      type: "BODY",
      text: metaBody,
      ...(variables.length > 0
        ? {
            example: {
              body_text: [exampleValues],
            },
          }
        : {}),
    },
  ];

  const payload = {
    name: hsmName,
    language: template.hsmLanguage || "pt_BR",
    category: template.metaCategory || "MARKETING",
    components,
  };

  try {
    const url = `https://graph.facebook.com/v21.0/${template.restaurant.wabaId}/message_templates`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${template.restaurant.waAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as any;

    if (response.ok && data.id) {
      // Update template in DB
      await prisma.messageTemplate.update({
        where: { id: templateId },
        data: {
          hsmTemplateName: hsmName,
          metaStatus: "submitted",
          submittedToMetaAt: new Date(),
          metaRejectedReason: null,
        },
      });

      console.log(`[MetaTemplate] Submitted "${hsmName}" for restaurant ${template.restaurantId} → Meta ID: ${data.id}`);
      return { success: true, metaTemplateId: data.id, status: data.status };
    }

    const errorMsg = data.error?.message || `HTTP ${response.status}`;
    console.error(`[MetaTemplate] Submit failed for "${hsmName}":`, errorMsg);

    await prisma.messageTemplate.update({
      where: { id: templateId },
      data: {
        metaStatus: "rejected",
        metaRejectedReason: errorMsg,
      },
    });

    return { success: false, error: errorMsg };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[MetaTemplate] Network error submitting "${hsmName}":`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Poll Meta for status of all submitted templates.
 * Called by cron job every 30 minutes.
 */
export async function pollMetaTemplateStatuses(): Promise<{ updated: number; errors: number }> {
  let updated = 0;
  let errors = 0;

  // Find all templates in "submitted" state
  const pendingTemplates = await prisma.messageTemplate.findMany({
    where: { metaStatus: "submitted", isCustom: true },
    include: { restaurant: true },
  });

  for (const template of pendingTemplates) {
    if (!template.restaurant.wabaId || !template.restaurant.waAccessToken || !template.hsmTemplateName) continue;

    try {
      const url = `https://graph.facebook.com/v21.0/${template.restaurant.wabaId}/message_templates?name=${template.hsmTemplateName}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${template.restaurant.waAccessToken}`,
        },
      });

      const data = (await response.json()) as any;
      const metaTemplate = data.data?.[0];

      if (!metaTemplate) continue;

      const metaStatus = metaTemplate.status?.toLowerCase();
      let newStatus = template.metaStatus;
      let rejectedReason: string | null = null;
      let isActive = template.isActive;

      if (metaStatus === "approved") {
        newStatus = "approved";
        isActive = true;
      } else if (metaStatus === "rejected") {
        newStatus = "rejected";
        isActive = false;
        rejectedReason = metaTemplate.rejected_reason || "Rejeitado pela Meta. Revise o conteudo e tente novamente.";
      }

      if (newStatus !== template.metaStatus) {
        await prisma.messageTemplate.update({
          where: { id: template.id },
          data: {
            metaStatus: newStatus,
            isActive,
            metaRejectedReason: rejectedReason,
          },
        });
        updated++;
        console.log(`[MetaTemplate] Status update: "${template.hsmTemplateName}" → ${newStatus}`);
      }
    } catch (err) {
      errors++;
      console.error(`[MetaTemplate] Poll error for "${template.hsmTemplateName}":`, err);
    }
  }

  return { updated, errors };
}

/**
 * Delete a custom template from Meta.
 */
export async function deleteTemplateFromMeta(templateId: string): Promise<MetaTemplateResult> {
  const template = await prisma.messageTemplate.findUnique({
    where: { id: templateId },
    include: { restaurant: true },
  });

  if (!template || !template.hsmTemplateName || !template.restaurant.wabaId || !template.restaurant.waAccessToken) {
    return { success: false, error: "Template or credentials not found" };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${template.restaurant.wabaId}/message_templates?name=${template.hsmTemplateName}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${template.restaurant.waAccessToken}`,
      },
    });

    const data = (await response.json()) as any;

    if (response.ok && data.success) {
      await prisma.messageTemplate.delete({ where: { id: templateId } });
      console.log(`[MetaTemplate] Deleted "${template.hsmTemplateName}"`);
      return { success: true };
    }

    return { success: false, error: data.error?.message || "Delete failed" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// --- Helpers ---

function generateHsmName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 512);
}
