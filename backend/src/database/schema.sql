-- RealChat Database Schema
-- PostgreSQL 16+

-- Enable pgcrypto for UUID generation and encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS & IDENTITY
-- ============================================================================

CREATE TABLE users (
  -- Primary key: Internal UUID (never exposed externally)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User credentials
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash TEXT,

  -- Keycloak OAuth/OIDC integration (optional)
  keycloak_id TEXT UNIQUE,
  email_verified BOOLEAN DEFAULT false,
  first_name VARCHAR(100),
  last_name VARCHAR(100),

  -- Public user identifier (rotatable, API-key-like)
  -- Format: XXXX-XXXX-XXXX-XXXX (Base32/58, 16-20 chars)
  public_id VARCHAR(255) UNIQUE NOT NULL,

  -- E2EE Identity keys (X25519)
  identity_key_public TEXT NOT NULL,
  identity_key_private_encrypted TEXT NOT NULL, -- Encrypted with password-derived key
  identity_key_id UUID DEFAULT gen_random_uuid(),
  identity_key_created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Signed pre-key for X3DH protocol
  signed_pre_key_public TEXT NOT NULL,
  signed_pre_key_signature TEXT NOT NULL,
  signed_pre_key_private_encrypted TEXT NOT NULL,
  signed_pre_key_id UUID DEFAULT gen_random_uuid(),
  signed_pre_key_created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Account status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_.-]{3,30}$'),
  CONSTRAINT email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes for user lookups
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_public_id ON users(public_id);
CREATE INDEX idx_users_last_seen ON users(last_seen_at DESC);
CREATE INDEX idx_users_keycloak_id ON users(keycloak_id);

-- One-time pre-keys for X3DH protocol
CREATE TABLE one_time_pre_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  key_id UUID NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  private_key_encrypted TEXT NOT NULL,

  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_onetime_keys_user_unused ON one_time_pre_keys(user_id) WHERE is_used = false;
CREATE INDEX idx_onetime_keys_key_id ON one_time_pre_keys(key_id);

-- Key rotation history (audit trail)
CREATE TABLE key_rotation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  key_type VARCHAR(50) NOT NULL, -- 'identity', 'signed_pre'
  old_key_id UUID NOT NULL,
  old_public_key TEXT NOT NULL,
  new_key_id UUID NOT NULL,
  new_public_key TEXT NOT NULL,

  rotated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_key_type CHECK (key_type IN ('identity', 'signed_pre'))
);

CREATE INDEX idx_key_rotation_user ON key_rotation_history(user_id, rotated_at DESC);

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Optional: Group conversation metadata
  name VARCHAR(255),
  description TEXT,
  avatar_url TEXT,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Conversation type
  is_direct BOOLEAN DEFAULT true, -- true = 1:1, false = group
  is_encrypted BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT group_name_required CHECK (
    (is_direct = false AND name IS NOT NULL) OR
    (is_direct = true)
  )
);

-- Index for conversation lookups
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- Conversation participants (many-to-many)
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Participant role
  role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member'
  CONSTRAINT valid_role CHECK (role IN ('admin', 'member')),

  -- Read receipts and watermarks
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ,

  -- E2EE: Conversation key encrypted for this participant
  -- For 1:1: Derived from X25519 key exchange
  -- For groups: Encrypted with user's identity key
  conversation_key_encrypted TEXT,

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,

  -- Unique constraint: One user per conversation
  UNIQUE(conversation_id, user_id)
);

-- Indexes for participant queries
CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_participants_active ON conversation_participants(conversation_id)
  WHERE left_at IS NULL;

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Encrypted message content (server cannot read plaintext)
  -- Format: JSONB { ciphertext: "...", nonce: "...", [sender_key: "..."] }
  encrypted_content JSONB NOT NULL,

  -- Message metadata (unencrypted)
  message_type VARCHAR(50) DEFAULT 'text',
  CONSTRAINT valid_message_type CHECK (message_type IN ('text', 'image', 'file', 'audio', 'video'))

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

-- Indexes for message queries
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Full-text search on message type (not content, which is encrypted)
CREATE INDEX idx_messages_type ON messages(message_type);

-- ============================================================================
-- MESSAGE REACTIONS
-- ============================================================================

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

-- Indexes for reaction queries
CREATE INDEX idx_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_reactions_user ON message_reactions(user_id);

-- ============================================================================
-- MESSAGE RECEIPTS (Delivery & Read Status)
-- ============================================================================

CREATE TABLE message_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Delivery status
  status VARCHAR(50) NOT NULL, -- 'sent', 'delivered', 'read'
  CONSTRAINT valid_status CHECK (status IN ('sent', 'delivered', 'read'))

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  -- Unique: One receipt per user per message
  UNIQUE(message_id, user_id)
);

-- Indexes for receipt queries
CREATE INDEX idx_receipts_message ON message_receipts(message_id);
CREATE INDEX idx_receipts_user ON message_receipts(user_id);
CREATE INDEX idx_receipts_status ON message_receipts(status);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

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

-- ============================================================================
-- VIEWS (Helper Queries)
-- ============================================================================

-- View: User conversations with metadata
CREATE VIEW user_conversations AS
SELECT
  cp.user_id,
  c.id AS conversation_id,
  c.name,
  c.is_direct,
  c.created_at,
  c.updated_at,
  COUNT(DISTINCT cp2.user_id) AS participant_count,
  MAX(m.created_at) AS last_message_at,
  (
    SELECT COUNT(*)
    FROM messages m2
    WHERE m2.conversation_id = c.id
    AND m2.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
  ) AS unread_count
FROM conversation_participants cp
  JOIN conversations c ON c.id = cp.conversation_id
  LEFT JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.left_at IS NULL
  LEFT JOIN messages m ON m.conversation_id = c.id
WHERE cp.left_at IS NULL
GROUP BY cp.user_id, c.id, c.name, c.is_direct, c.created_at, c.updated_at, cp.last_read_at;

-- View: Conversation participants with user details
CREATE VIEW conversation_participants_details AS
SELECT
  cp.conversation_id,
  cp.user_id,
  u.username,
  u.public_id AS user_public_id,
  cp.role,
  cp.joined_at,
  cp.last_read_at,
  u.last_seen_at
FROM conversation_participants cp
  JOIN users u ON u.id = cp.user_id
WHERE cp.left_at IS NULL;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- No initial data needed
-- Users will be created via registration endpoint

-- ============================================================================
-- GRANTS (PostgreSQL)
-- ============================================================================

-- Uncomment and customize for your database user
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO chatuser;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO chatuser;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO chatuser;
