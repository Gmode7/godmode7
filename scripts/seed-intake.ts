import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const existing = await p.agentIdentity.findFirst({ where: { role: 'intake' } });
if (existing) {
  console.log('Intake agent already exists:', existing.id);
} else {
  const a = await p.agentIdentity.create({
    data: { name: 'Intake / Account Manager', role: 'intake', plan: 'business', isActive: true },
  });
  console.log('Created intake agent:', a.id);
}
await p.$disconnect();
