import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixConstraint() {
  try {
    console.log('Updating username constraint...');

    // Drop old constraint
    await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS username_format');
    console.log('✓ Dropped old constraint');

    // Add new constraint that allows dots
    await pool.query("ALTER TABLE users ADD CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_.-]{3,30}$')");
    console.log('✓ Added new constraint with dots support');

    console.log('✅ Constraint updated successfully!');

    // Test the constraint
    const test = await pool.query("SELECT 'rayen.b' ~ '^[a-zA-Z0-9_.-]{3,30}$' as valid");
    console.log('Test validation:', test.rows[0].valid === true ? 'PASS' : 'FAIL');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixConstraint();
