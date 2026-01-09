#!/usr/bin/env tsx
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env from backend directory
config({ path: resolve(process.cwd(), '.env') });

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createTables() {
  const client = await pool.connect();
  try {
    console.log('Checking and creating missing tables...');

    // Check if messages table exists
    const messagesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'messages'
      );
    `);

    if (!messagesCheck.rows[0].exists) {
      console.log('Creating messages table...');
      await client.query(`
        CREATE TABLE messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          -- Encrypted message content (server cannot read plaintext)
          -- Format: JSONB { ciphertext: "...", nonce: "...", [sender_key: "..."] }
          encrypted_content JSONB NOT NULL,

          -- Message metadata (unencrypted)
          message_type VARCHAR(50) DEFAULT 'text',
          CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video')),

          -- Threading
          reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,

          -- Message status
          is_deleted BOOLEAN DEFAULT false,
          is_edited BOOLEAN DEFAULT false,
          edited_at TIMESTAMPTZ,

          -- Timestamps
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

          -- Content hash for deduplication (SHA-256)
          content_hash VARCHAR(64),

          -- Constraints
          CONSTRAINT reply_to_in_same_conversation CHECK (
            reply_to_id IS NULL OR
            EXISTS (
              SELECT 1 FROM messages m
              WHERE m.id = messages.reply_to_id
              AND m.conversation_id = messages.conversation_id
            )
          )
        );
      `);

      // Create indexes
      await client.query(`CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);`);
      await client.query(`CREATE INDEX idx_messages_sender ON messages(sender_id);`);
      await client.query(`CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);`);
      await client.query(`CREATE INDEX idx_messages_created_at ON messages(created_at DESC);`);
      await client.query(`CREATE INDEX idx_messages_type ON messages(message_type);`);
      console.log('✅ Messages table created');
    } else {
      console.log('ℹ️  Messages table already exists');
    }

    // Check if message_reactions table exists
    const reactionsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'message_reactions'
      );
    `);

    if (!reactionsCheck.rows[0].exists) {
      console.log('Creating message_reactions table...');
      await client.query(`
        CREATE TABLE message_reactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          -- Emoji reaction (e.g., "👍", "❤️", "😂")
          emoji VARCHAR(100) NOT NULL,

          created_at TIMESTAMPTZ DEFAULT NOW(),

          -- Unique: One reaction per user per message per emoji
          UNIQUE(message_id, user_id, emoji)
        );
      `);

      await client.query(`CREATE INDEX idx_reactions_message ON message_reactions(message_id);`);
      await client.query(`CREATE INDEX idx_reactions_user ON message_reactions(user_id);`);
      console.log('✅ Message reactions table created');
    } else {
      console.log('ℹ️  Message reactions table already exists');
    }

    // Check if message_receipts table exists
    const receiptsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'message_receipts'
      );
    `);

    if (!receiptsCheck.rows[0].exists) {
      console.log('Creating message_receipts table...');
      await client.query(`
        CREATE TABLE message_receipts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

          -- Delivery status
          status VARCHAR(50) NOT NULL,
          CONSTRAINT valid_status CHECK (status IN ('sent', 'delivered', 'read')),

          -- Timestamps
          sent_at TIMESTAMPTZ DEFAULT NOW(),
          delivered_at TIMESTAMPTZ,
          read_at TIMESTAMPTZ,

          -- Unique: One receipt per user per message
          UNIQUE(message_id, user_id)
        );
      `);

      await client.query(`CREATE INDEX idx_receipts_message ON message_receipts(message_id);`);
      await client.query(`CREATE INDEX idx_receipts_user ON message_receipts(user_id);`);
      await client.query(`CREATE INDEX idx_receipts_status ON message_receipts(status);`);
      console.log('✅ Message receipts table created');
    } else {
      console.log('ℹ️  Message receipts table already exists');
    }

    // Create triggers for messages table
    const triggerCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table = 'messages'
        AND trigger_name = 'trigger_conversation_message_update'
      );
    `);

    if (!triggerCheck.rows[0].exists) {
      console.log('Creating triggers for messages table...');
      await client.query(`
        -- Function to update conversation updated_at when message is created
        CREATE OR REPLACE FUNCTION update_conversation_on_message()
        RETURNS TRIGGER AS $$
        BEGIN
          UPDATE conversations
          SET updated_at = NOW()
          WHERE id = NEW.conversation_id;
          RETURN NEW;
        END;
        $$ language 'plpgsql';

        CREATE TRIGGER trigger_conversation_message_update
          AFTER INSERT ON messages
          FOR EACH ROW
          EXECUTE FUNCTION update_conversation_on_message();
      `);
      console.log('✅ Triggers created');
    } else {
      console.log('ℹ️  Triggers already exist');
    }

    console.log('✅ All tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to create tables:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();
