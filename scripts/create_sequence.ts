import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  const sql = neon(process.env.DATABASE_URL);
  console.log("Creating surgical_case_seq...");
  await sql`CREATE SEQUENCE IF NOT EXISTS surgical_case_seq START 1;`;
  console.log("Sequence created successfully.");
}

main().catch((err) => {
  console.error("Failed to create sequence:", err);
  process.exit(1);
});
