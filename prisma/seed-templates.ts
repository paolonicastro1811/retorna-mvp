// ============================================================
// Seed: 7 pre-configured HSM templates for loyalty automation
// Run: npx tsx prisma/seed-templates.ts
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// These are the 7 standard loyalty templates.
// hsmTemplateName must match what's registered on Meta Business Manager.
// The restaurant owner toggles them ON/OFF via isActive in Settings.

const LOYALTY_TEMPLATES = [
  {
    name: "Boas-vindas + Consentimento",
    templateKey: "welcome_consent",
    body: "Oi {{nome}}! 😊 Obrigado por falar com a gente. Posso te enviar novidades e ofertas exclusivas pelo WhatsApp? Responda SIM para aceitar ou NAO se preferir nao receber.",
    hsmTemplateName: "welcome_consent_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Obrigado pela visita",
    templateKey: "post_visit_thanks",
    body: "Oi {{nome}}! Obrigado pela visita de hoje 😊 Voce ja tem {{visitas}} visitas! {{progresso_tier}} Responda VER para conferir seus beneficios.",
    hsmTemplateName: "post_visit_thanks_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Recompensa desbloqueada",
    templateKey: "reward_earned",
    body: "Parabens {{nome}}! 🎉 Voce completou {{visitas}} visitas e ganhou {{desconto}}% de desconto na proxima visita! Mostre essa mensagem no caixa. Te esperamos!",
    hsmTemplateName: "reward_earned_v1",
    hsmLanguage: "pt_BR",
    isActive: false, // Owner ativa quando quiser
  },
  {
    name: "Upgrade de nivel",
    templateKey: "tier_upgrade",
    body: "{{nome}}, voce subiu de nivel! {{tier_emoji}} Agora voce e cliente {{tier_nome}}! Isso significa: {{beneficios}}. Obrigado pela fidelidade!",
    hsmTemplateName: "tier_upgrade_v1",
    hsmLanguage: "pt_BR",
    isActive: false,
  },
  {
    name: "Lembrete de sequencia",
    templateKey: "streak_reminder",
    body: "Oi {{nome}}! 🔥 Voce esta com {{streak}} visitas seguidas esta semana! Volte mais {{faltam}}x ate {{prazo}} e ganhe pontos em dobro!",
    hsmTemplateName: "streak_reminder_v1",
    hsmLanguage: "pt_BR",
    isActive: false,
  },
  {
    name: "Reativacao",
    templateKey: "reactivation",
    body: "Oi {{nome}}, faz tempo! Temos saudade 😊 Volta e ganha {{desconto}}% de desconto na proxima visita. Te esperamos!",
    hsmTemplateName: "reactivation_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Recompensa surpresa",
    templateKey: "surprise_reward",
    body: "Oi {{nome}}! 🎁 Voce ganhou uma recompensa surpresa! Venha ao restaurante e mostre essa mensagem no caixa para descobrir o que e. Vale ate amanha!",
    hsmTemplateName: "surprise_reward_v1",
    hsmLanguage: "pt_BR",
    isActive: false,
  },
];

async function main() {
  // Find all restaurants
  const restaurants = await prisma.restaurant.findMany();

  if (restaurants.length === 0) {
    console.log("No restaurants found. Create a restaurant first.");
    return;
  }

  for (const restaurant of restaurants) {
    console.log(`\nSeeding templates for: ${restaurant.name} (${restaurant.id})`);

    for (const tpl of LOYALTY_TEMPLATES) {
      // Upsert: update if exists (by restaurant + hsmTemplateName), create if not
      const existing = await prisma.messageTemplate.findFirst({
        where: {
          restaurantId: restaurant.id,
          hsmTemplateName: tpl.hsmTemplateName,
        },
      });

      if (existing) {
        console.log(`  [skip] ${tpl.name} — already exists`);
        continue;
      }

      await prisma.messageTemplate.create({
        data: {
          restaurantId: restaurant.id,
          name: tpl.name,
          body: tpl.body,
          hsmTemplateName: tpl.hsmTemplateName,
          hsmLanguage: tpl.hsmLanguage,
          isActive: tpl.isActive,
          channel: "whatsapp",
        },
      });

      console.log(`  [created] ${tpl.name} (active: ${tpl.isActive})`);
    }
  }

  console.log("\nDone!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
