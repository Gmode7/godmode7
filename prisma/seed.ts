import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

function generateApiKey(): string {
  const random = crypto.randomBytes(24).toString("hex");
  return "gm7_" + random;
}

async function main() {
  console.log("Seeding database...\n");

  // Admin agent
  let adminAgent = await prisma.agentIdentity.findFirst({ where: { role: "admin" } });
  if (!adminAgent) {
    adminAgent = await prisma.agentIdentity.create({
      data: { name: "GM7 Admin", role: "admin", plan: "business", isActive: true },
    });
  }
  console.log("Admin agent: " + adminAgent.name + " (" + adminAgent.id + ")");

  // Check existing admin keys
  const existingKeys = await prisma.apiKey.findMany({
    where: { agentId: adminAgent.id, isActive: true },
  });

  if (existingKeys.length > 0) {
    console.log("Admin already has " + existingKeys.length + " active key(s). Skipping key creation.");
  } else {
    const plaintext = generateApiKey();
    const keyHash = hashApiKey(plaintext);
    await prisma.apiKey.create({
      data: {
        keyHash,
        name: "admin-bootstrap",
        scopes: "projects:read,projects:write,jobs:read,jobs:write,chat:read,chat:write,artifacts:read,artifacts:write,admin:read,admin:write",
        agentId: adminAgent.id,
      },
    });
    console.log("\n============================================================");
    console.log("  ADMIN API KEY (save this - shown ONCE):");
    console.log("  " + plaintext);
    console.log("============================================================\n");
    console.log("  Add to your .env: DEV_API_KEY=" + plaintext + "\n");
  }

  // Basic test agent
  let basicAgent = await prisma.agentIdentity.findFirst({ where: { role: "basic-test" } });
  if (!basicAgent) {
    basicAgent = await prisma.agentIdentity.create({
      data: { name: "Test Basic Agent", role: "basic-test", plan: "basic", isActive: true },
    });
  }
  console.log("Basic agent: " + basicAgent.name + " (" + basicAgent.id + ")");

  const basicKeys = await prisma.apiKey.findMany({
    where: { agentId: basicAgent.id, isActive: true },
  });

  if (basicKeys.length === 0) {
    const basicPlaintext = generateApiKey();
    const basicHash = hashApiKey(basicPlaintext);
    await prisma.apiKey.create({
      data: {
        keyHash: basicHash,
        name: "basic-test",
        scopes: "projects:read,projects:write,jobs:read,jobs:write,chat:read,chat:write,artifacts:read,artifacts:write",
        agentId: basicAgent.id,
      },
    });
    console.log("\n============================================================");
    console.log("  BASIC (non-admin) API KEY:");
    console.log("  " + basicPlaintext);
    console.log("============================================================\n");
  }

  console.log("Seed complete!\n");
}

main()
  .catch((e) => { console.error("Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
