const pg = require('pg');
const Pool = pg.Pool;
const pool = new Pool({
  connectionString: 'postgresql://chatuser:changeme@localhost:5432/realchat',
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Creating triggers...');

    await client.query(`
      CREATE OR REPLACE FUNCTION update_conversation_on_message()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE conversations
        SET updated_at = NOW()
        WHERE id = NEW.conversation_id;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    try {
      await client.query(`
        CREATE TRIGGER trigger_conversation_message_update
          AFTER INSERT ON messages
          FOR EACH ROW
          EXECUTE FUNCTION update_conversation_on_message();
      `);
      console.log('✅ Trigger created');
    } catch(e) {
      if (!e.message.includes('already exists')) {
        console.error('Trigger error:', e.message);
      } else {
        console.log('✅ Trigger already exists');
      }
    }

    console.log('✅ All done!');
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
})();
