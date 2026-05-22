import { db } from "./src/lib/db";
import { hospitals } from "./db/schema/core";

async function main() {
  const allHospitals = await db.select().from(hospitals);
  console.log("Hospitals in database:", JSON.stringify(allHospitals, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
