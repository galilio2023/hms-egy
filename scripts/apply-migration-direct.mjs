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

async function run() {
  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} total migration files.`);

    const targetFile = process.argv[2];
    const filesToRun = targetFile ? [targetFile] : files.slice(-3);

    for (const file of filesToRun) {
      const migrationFilePath = path.join(migrationsDir, file);
      console.log(`\n--- Applying Migration: ${file} ---`);
      
      const migrationSql = fs.readFileSync(migrationFilePath, 'utf8');
      const statements = migrationSql
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log(`Found ${statements.length} statements.`);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          console.log(`[Statement ${i + 1}/${statements.length}] Executing...`);
          await client.query(stmt);
        } catch (err) {
          // 42701: column already exists
          // 42704: undefined_object (index, policy, etc)
          // 42710: duplicate_object (index, constraint, etc)
          // 42P07: duplicate_table/relation (index name exists)
          const isSkipable = 
            err.code === '42701' || 
            (stmt.toUpperCase().startsWith('DROP') && err.code === '42704') || 
            (stmt.toUpperCase().startsWith('ALTER POLICY') && err.code === '42704') ||
            err.code === '42710' || 
            err.code === '42P07';

          if (isSkipable) {
            console.warn(`[Warning] ${err.message}. Skipping.`);
          } else {
            throw err;
          }
        }
      }
      console.log(`✅ Successfully applied ${file}`);
    }

    console.log("\n✨ All selected migrations successfully applied!");
  } catch (error) {
    console.error("\n❌ Migration failed!");
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
