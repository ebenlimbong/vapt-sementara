import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function hash(pw: string) {
  return bcrypt.hash(pw, 12);
}

const DEMO_PASSWORD = "Password123!";

async function main() {
  console.log("Seeding database...");

  // --- Users (2 peran global: admin, pentester) ---
  const usersData = [
    { email: "admin@itera.ac.id", name: "Admin ITERA", role: "admin" as const },
    { email: "pentester@itera.ac.id", name: "Pentester Sari", role: "pentester" as const },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: {
        email: u.email,
        name: u.name,
        passwordHash: await hash(DEMO_PASSWORD),
        role: u.role,
        status: "active",
      },
    });
  }

  // --- Target lab apps + target "web asli" tanpa Docker ---
  const labApps = [
    { name: "OWASP Juice Shop (lab)", baseUrl: "http://juice-shop:3000", category: "web" as const, environment: "lab" as const },
    { name: "DVWA (lab)", baseUrl: "http://dvwa", category: "web" as const, environment: "lab" as const },
    { name: "VAmPI (lab)", baseUrl: "http://vampi:5000", category: "api" as const, environment: "lab" as const },
    { name: "crAPI Identity (lab)", baseUrl: "http://crapi-api:8080", category: "api" as const, environment: "lab" as const },
    // Target "web asli" yang bisa diuji TANPA Docker: demo publik resmi OWASP
    // untuk Juice Shop (app rentan yang sama, dihost online untuk latihan
    // security testing) — legal untuk diuji, tidak perlu izin tambahan.
    { name: "OWASP Juice Shop Demo (publik, resmi OWASP)", baseUrl: "https://demo.owasp-juice.shop", category: "web" as const, environment: "staging" as const },
  ];

  for (const la of labApps) {
    const existing = await prisma.application.findFirst({ where: { name: la.name } });
    if (!existing) {
      await prisma.application.create({
        data: {
          name: la.name,
          baseUrl: la.baseUrl,
          category: la.category,
          environment: la.environment,
        },
      });
    }
  }

  console.log("\nSeed selesai. Akun demo (password sama semua): " + DEMO_PASSWORD);
  for (const u of usersData) console.log(` - ${u.role.padEnd(10)} ${u.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
