/**
 * Checks if the database has been seeded (any Venue exists) and runs
 * prisma/seed.ts only if the database is empty. Used by the compose
 * migrate one-shot service to make `docker compose up` idempotent.
 */

import { getRawPrisma } from "../src/server/db";

async function main() {
  const prisma = getRawPrisma();
  try {
    const count = await prisma.venue.count();
    if (count > 0) {
      console.log("[docker-migrate] Already seeded — skipping.");
      return;
    }
  } catch {
    // Table may not exist yet on a truly fresh DB — treat as empty
  } finally {
    await prisma.$disconnect();
  }

  console.log("[docker-migrate] Database empty — seeding...");
  const { execSync } = await import("node:child_process");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  console.log("[docker-migrate] Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
