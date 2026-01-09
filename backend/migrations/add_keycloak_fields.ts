#!/usr/bin/env tsx
/**
 * Migration: Add Keycloak OAuth fields to users table
 * Run this after updating schema.sql to add Keycloak support
 */
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from backend directory
config({ path: resolve(process.cwd(), '.env') });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Adding Keycloak fields to users table...');

    // Check if keycloak_id column exists
    const columnCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'keycloak_id'
      );
    `);

    if (columnCheck.rows[0].exists) {
      console.log('ℹ️  Keycloak fields already exist, skipping...');
      process.exit(0);
    }

    // Add Keycloak columns
    console.log('  Adding keycloak_id column...');
    await client.query(`ALTER TABLE users ADD COLUMN keycloak_id TEXT UNIQUE`);

    console.log('  Making email nullable...');
    await client.query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`);

    console.log('  Making password_hash nullable...');
    await client.query(`ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`);

    console.log('  Adding email_verified column...');
    await client.query(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false`);

    console.log('  Adding first_name column...');
    await client.query(`ALTER TABLE users ADD COLUMN first_name VARCHAR(100)`);

    console.log('  Adding last_name column...');
    await client.query(`ALTER TABLE users ADD COLUMN last_name VARCHAR(100)`);

    console.log('  Creating index on keycloak_id...');
    await client.query(`CREATE INDEX idx_users_keycloak_id ON users(keycloak_id)`);

    console.log('✅ Keycloak fields added successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Start Keycloak: docker-compose up keycloak -d');
    console.log('  2. Configure realm and clients in Keycloak admin');
    console.log('  3. Update .env with KEYCLOAK_CLIENT_SECRET');
    console.log('  4. Test authentication flow');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
