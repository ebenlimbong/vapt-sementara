import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: datasource URL untuk CLI (migrate/introspect) dikonfigurasi di sini,
// sedangkan koneksi runtime PrismaClient memakai driver adapter (lihat src/lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
