#!/usr/bin/env tsx
/**
 * Database migration script
 * Run with: npm run migrate
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  let pool: any;
  try {
    console.log('Starting database migration...');

    // Read schema file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Create pool
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // Split by semicolon and filter out comments and empty lines
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        const lines = s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
        return lines.trim().length > 0;
      })
      .map(s => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').trim())
      .filter(s => s.length > 0);

    console.log(`Executing ${statements.length} statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;

      try {
        await pool.query(statement);
      } catch (error: any) {
        console.error(`Error at statement ${i + 1}:`, error.message);
        console.error('Statement:', statement.substring(0, 150));
        throw error;
      }
    }

    await pool.end();

    console.log('✅ Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (pool) await pool.end();
    process.exit(1);
  }
}

// Run migration
migrate();
