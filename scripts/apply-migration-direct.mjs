import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure WebSocket for node environment
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const migrationFilePath = path.join(__dirname, '..', 'db', 'migrations', '0010_fix_vitals_index.sql');
if (!fs.existsSync(migrationFilePath)) {
  console.error("Migration file 0010_fix_vitals_index.sql not found at:", migrationFilePath);
  process.exit(1);
}

const migrationSql = fs.readFileSync(migrationFilePath, 'utf8');

// Drizzle migrations split statements with "--> statement-breakpoint"
const statements = migrationSql
  .split('--> statement-breakpoint')
  .map(s => s.trim())
  .filter(s => s.length > 0);

console.log(`Found ${statements.length} migration statements to apply.`);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log("Connected to Neon Database. Applying statements...");
    
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[Statement ${i + 1}/${statements.length}] Executing...`);
      console.log(`SQL: ${stmt.substring(0, 100).replace(/\n/g, ' ')}...`);
      await client.query(stmt);
    }
    
    console.log("✅ Migration successfully applied!");
  } catch (error) {
    console.error("❌ Migration failed!");
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
