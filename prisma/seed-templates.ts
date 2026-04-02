// ============================================================
// Seed: 7 pre-configured HSM templates for loyalty automation
// Run: npx tsx prisma/seed-templates.ts
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// These are the 7 standard loyalty templates.
// hsmTemplateName must match what's registered on Meta Business Manager.
// The restaurant owner toggles them ON/OFF via isActive in Settings.

// Only templates that exist on Meta Business Manager (6 approved HSMs)
const LOYALTY_TEMPLATES = [
  {
    name: "Pos-visita + Consentimento",
    templateKey: "post_visit_thanks",
    body: "Oi {{customer_name}}, obrigado por ter nos visitado! 😊 Foi um prazer te receber.\n\nGostaria de receber ofertas exclusivas e novidades do nosso restaurante? Sem spam, so coisas boas — enviaremos apenas quando tivermos algo especial para voce.\n\nResponda *SIM* para receber ou simplesmente ignore esta mensagem. 🍽️",
    hsmTemplateName: "post_visit_thanks_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Recompensa 10 visitas",
    templateKey: "reward_earned",
    body: "Oi {{customer_name}}, parabens! 🎉 Voce completou 10 visitas conosco!\n\nComo agradecimento, voce ganhou 10% de desconto na sua proxima visita. Mostre esta mensagem ao garcom para resgatar. Valido por 7 dias.\n\nObrigado pela fidelidade! 🍽️\n\nResponda SAIR se nao deseja mais receber nossas mensagens.",
    hsmTemplateName: "reward_earned_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Desconto surpresa",
    templateKey: "surprise_discount",
    body: "Oi {{customer_name}}! 🎉 Temos uma surpresa para voce: 10% de desconto na sua proxima visita! Mostre essa mensagem no caixa. Valido por 7 dias.\n\nResponda *SAIR* se nao deseja mais receber nossas mensagens.",
    hsmTemplateName: "surprise_discount_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Metade do caminho",
    templateKey: "milestone_halfway",
    body: "Oi {{customer_name}}! 🔥 Voce ja tem {{visit_count}} visitas! Esta na metade do caminho para desbloquear um desconto exclusivo. Continue assim!\n\nResponda *SAIR* se nao deseja mais receber nossas mensagens.",
    hsmTemplateName: "milestone_halfway_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Reativacao",
    templateKey: "reactivation",
    body: "Oi {{customer_name}}, tudo bem? 😊 Faz um tempinho que voce nao aparece por aqui e nos sentimos sua falta!\n\nQue tal nos fazer uma visita? Estamos te esperando de bracos abertos! 🍽️\n\nResponda *SAIR* se nao deseja mais receber nossas mensagens.",
    hsmTemplateName: "reactivation_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
  {
    name: "Cliente VIP — 20% desconto",
    templateKey: "loyalty_vip",
    body: "Oi {{customer_name}}, voce e incrivel! 🏆 Completou {{visit_count}} visitas conosco!\n\nVoce ganhou 20% de desconto na sua proxima visita. Mostre esta mensagem ao garcom para resgatar. Valido por 7 dias.\n\nObrigado por ser um cliente tao especial! 🍽️\n\nResponda *SAIR* se nao deseja mais receber nossas mensagens.",
    hsmTemplateName: "loyalty_vip_v1",
    hsmLanguage: "pt_BR",
    isActive: true,
  },
];

async function main() {
  // Find all restaurants
  const restaurants = await prisma.restaurant.findMany();

  if (restaurants.length === 0) {
    console.log("No restaurants found. Create a restaurant first.");
    return;
  }

  const validHsmNames = LOYALTY_TEMPLATES.map(t => t.hsmTemplateName);

  for (const restaurant of restaurants) {
    console.log(`\nSeeding templates for: ${restaurant.name} (${restaurant.id})`);

    // Delete templates not in the seed (old/orphaned)
    const deleted = await prisma.messageTemplate.deleteMany({
      where: {
        restaurantId: restaurant.id,
        isCustom: false,
        hsmTemplateName: { notIn: validHsmNames },
      },
    });
    if (deleted.count > 0) {
      console.log(`  [cleaned] Removed ${deleted.count} old template(s)`);
    }

    for (const tpl of LOYALTY_TEMPLATES) {
      const existing = await prisma.messageTemplate.findFirst({
        where: {
          restaurantId: restaurant.id,
          hsmTemplateName: tpl.hsmTemplateName,
        },
      });

      if (existing) {
        // Update name and body to match seed
        await prisma.messageTemplate.update({
          where: { id: existing.id },
          data: { name: tpl.name, body: tpl.body },
        });
        console.log(`  [updated] ${tpl.name}`);
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
