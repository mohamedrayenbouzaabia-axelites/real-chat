const pg = require('pg');
const Pool = pg.Pool;
const pool = new Pool({
  connectionString: 'postgresql://chatuser:changeme@localhost:5432/realchat',
});

(async () => {
  const client = await pool.connect();
  try {
    console.log('Creating messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        encrypted_content JSONB NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        is_deleted BOOLEAN DEFAULT false,
        is_edited BOOLEAN DEFAULT false,
        edited_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        content_hash VARCHAR(64)
      );
    `);

    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_id);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);');

    console.log('✅ Messages table created successfully!');
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
})();
