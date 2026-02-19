import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// All 8 agents for the GM7 AI software agency
const AGENTS = [
  { name: 'Intake / Account Manager', role: 'intake', provider: 'openai' },
  { name: 'Product Manager', role: 'pm', provider: 'openai' },
  { name: 'Tech Lead / Architect', role: 'architect', provider: 'claude' },
  { name: 'Software Engineer', role: 'engineer', provider: 'claude' },
  { name: 'QA Engineer', role: 'qa', provider: 'openai' },
  { name: 'Security Auditor', role: 'security', provider: 'openai' },
  { name: 'DevOps / Release', role: 'devops', provider: 'kimi' },
  { name: 'Tech Writer', role: 'techwriter', provider: 'kimi' },
];

async function bootstrap() {
  console.log('🚀 AI-Native Backend Bootstrap\n');
  
  // Ensure admin agent exists
  let adminAgent = await prisma.agentIdentity.findFirst({ where: { role: 'admin' } });
  
  if (!adminAgent) {
    adminAgent = await prisma.agentIdentity.create({
      data: { name: 'System Admin', role: 'admin', provider: 'none' }
    });
    console.log('✅ Created admin agent');
  } else {
    console.log('✅ Admin exists');
  }

  // Seed all 8 agents for the registry
  console.log('\n📋 Seeding Agent Registry...');
  for (const agentDef of AGENTS) {
    const existing = await prisma.agentIdentity.findFirst({ 
      where: { role: agentDef.role } 
    });
    
    if (!existing) {
      await prisma.agentIdentity.create({
        data: {
          name: agentDef.name,
          role: agentDef.role,
          provider: agentDef.provider,
          isActive: true,
          isReady: false,
        }
      });
      console.log(`  ✅ Created ${agentDef.name} (${agentDef.provider})`);
    } else {
      // Update provider if not set
      if (existing.provider === 'none' || !existing.provider) {
        await prisma.agentIdentity.update({
          where: { id: existing.id },
          data: { provider: agentDef.provider }
        });
        console.log(`  🔄 Updated ${agentDef.name} provider to ${agentDef.provider}`);
      } else {
        console.log(`  ✅ ${agentDef.name} exists`);
      }
    }
  }
  console.log('');

  // Create bootstrap API key only if none exists with admin scope
  const existingKey = await prisma.apiKey.findFirst({
    where: { agentId: adminAgent.id }
  });

  if (!existingKey) {
    const apiKey = `ainb_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    await prisma.apiKey.create({
      data: { agentId: adminAgent.id, name: 'Bootstrap Key', keyHash, scopes: 'projects:read,projects:write,jobs:read,jobs:write,chat:read,chat:write,artifacts:read,artifacts:write,admin:read,admin:write' }
    });

    console.log('\n════════════════════════════════════════════════════════════');
    console.log('🔑 ADD THIS TO REPLIT SECRETS AS "API_KEY":');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log(`${apiKey}\n`);
    console.log('════════════════════════════════════════════════════════════\n');
  } else {
    console.log('✅ Bootstrap API key exists');
  }
}

bootstrap().catch(console.error).finally(() => prisma.$disconnect());
