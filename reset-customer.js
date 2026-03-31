const dotenv = require('dotenv');
dotenv.config({ override: true });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const c = await p.customer.update({
    where: { id: 'cmnd50csj0005ry6h9p550uhv' },
    data: { marketingNudgeSentAt: null, marketingOptInAt: null }
  });
  console.log('Reset OK:', c.id, 'nudge:', c.marketingNudgeSentAt, 'optIn:', c.marketingOptInAt);
  await p.$disconnect();
}
main();
