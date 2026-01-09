# RealChat Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐           │
│  │   Web App   │  │  Mobile App │  │  Desktop    │           │
│  │  (Next.js)  │  │ (Future)    │  │  (Future)   │           │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘           │
│         │                │                │                   │
│         └────────────────┴────────────────┘                   │
│                          │                                     │
│              ┌───────────▼───────────┐                        │
│              │  Client-Side Crypto   │                        │
│              │  - X25519 Key Pair    │                        │
│              │  - AES-256-GCM        │                        │
│              │  - Message Encryption │                        │
│              └───────────┬───────────┘                        │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           │ HTTPS / WSS
                           │
┌──────────────────────────▼─────────────────────────────────────┐
│                      Server Layer                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐     │
│  │              API Gateway (Fastify)                    │     │
│  │  - Security (Helmet, CORS, CSP)                      │     │
│  │  - Rate Limiting                                     │     │
│  │  - Request Validation                               │     │
│  │  - JWT Authentication                               │     │
│  └──────────┬────────────────────────────────┬──────────┘     │
│             │                                │                   │
│   ┌─────────▼─────────┐          ┌─────────▼─────────┐       │
│   │   HTTP Routes     │          │  WebSocket Server │       │
│   ├───────────────────┤          ├───────────────────┤       │
│   │ - Auth            │          │ - uWebSockets.js  │       │
│   │ - Conversations   │          │ - Real-time       │       │
│   │ - Messages        │          │ - Presence        │       │
│   │ - Reactions       │          │ - Typing          │       │
│   └─────────┬─────────┘          └─────────┬─────────┘       │
│             │                                │                   │
└─────────────┼────────────────────────────────┼───────────────────┘
              │                                │
              │                                │
┌─────────────▼────────────────────────────────▼───────────────┐
│                     Data Layer                                │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   PostgreSQL     │         │      Redis       │          │
│  ├──────────────────┤         ├──────────────────┤          │
│  │ - Users          │         │ - Presence       │          │
│  │ - Conversations  │         │ - Socket Routes  │          │
│  │ - Messages       │         │ - Rate Limits    │          │
│  │ - Reactions      │         │ - Pub/Sub        │          │
│  │ - (Encrypted)    │         │ - Fan-out        │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Data Flow: Sending a Message

```
┌─────────┐                                                 ┌─────────┐
│ User A  │                                                 │ User B  │
└────┬────┘                                                 └────┬────┘
     │                                                          │
     │ 1. User types message                                   │
     ├──────────────────────┐                                   │
     │                      │                                   │
     ▼                      ▼                                   │
┌─────────┐          ┌─────────────┐                            │
│ UI      │          │ Crypto      │                            │
│ Render  │          │ Manager     │                            │
└─────────┘          └──────┬──────┘                            │
                            │                                   │
                            │ 2. Encrypt message                │
                            │    - Get shared key               │
                            │    - AES-256-GCM encrypt          │
                            │                                   │
                            ▼                                   │
                     ┌──────────────┐                          │
                     │ Encrypted    │                          │
                     │ Message      │                          │
                     └──────┬───────┘                          │
                            │                                   │
     │ 3. Send via HTTP   │                                   │
     ├────────────────────┼──────────────────────────────────┐  │
     │                    │                                  │  │
     ▼                    ▼                                  ▼  ▼
┌─────────┐         ┌──────────┐                      ┌─────────┐
│ Client  │         │ Backend  │                      │ Server  │
└────┬────┘         └─────┬────┘                      └────┬────┘
     │                    │                                 │
     │                    │ 4. Store encrypted              │
     │                    │    message in DB                 │
     │                    │                                 │
     │                    ▼                                 │
     │            ┌─────────────┐                           │
     │            │ PostgreSQL  │                           │
     │            │ (encrypted  │                           │
     │            │  content)   │                           │
     │            └──────┬──────┘                           │
     │                   │                                   │
     │                   │ 5. Deliver via WebSocket          │
     │                   │    - Route to User B              │
     │                   │    - Check presence               │
     │                   │    - Send encrypted message       │
     │                   │                                   │
     │                   ▼                                   ▼
     │            ┌─────────────┐                     ┌─────────┐
     │            │  WebSocket  │────────────────────>│ Client  │
     │            │   Server    │                     │         │
     │            └─────────────┘                     └────┬────┘
     │                                                     │
     │                                                     │ 6. Decrypt
     │                                                     │    message
     │                                                     ▼
     │                                              ┌──────────┐
     │                                              │  Crypto  │
     │                                              │  Manager │
     │                                              └─────┬────┘
     │                                                    │
     │                                                    ▼
     │                                              ┌──────────┐
     │                                              │    UI    │
     │                                              │ Display  │
     │                                              └──────────┘
     │                                                    │
     └────────────────────────────────────────────────────┘
```

## Security Architecture

### End-to-End Encryption Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Client A                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ X25519       │    │ X25519       │    │ Shared       │ │
│  │ Key Pair     │───>│ Key Exchange │───>│ Secret       │ │
│  │ (Generated)  │    │ (X3DH)       │    │ (Derived)    │ │
│  └──────────────┘    └──────────────┘    └───────┬──────┘ │
│                                                  │         │
│                                                  ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Message Encryption                       │  │
│  │  Input: "Hello World"                                │  │
│  │  Key: Shared Secret (256 bits)                       │  │
│  │  Algorithm: AES-256-GCM                              │  │
│  │  Output: { ciphertext: "...", nonce: "..." }        │  │
│  └────────────────────────┬─────────────────────────────┘  │
└───────────────────────────┼───────────────────────────────┘
                            │
                            │ Send to Server
                            │ (Encrypted only!)
                            ▼
┌───────────────────────────────────────────────────────────┐
│                      Server                                │
│  ┌───────────────────────────────────────────────────┐    │
│  │              Store Encrypted Message              │    │
│  │  INSERT INTO messages (encrypted_content)         │    │
│  │  VALUES ('{ ciphertext: "...", nonce: "..." }')   │    │
│  │                                                    │    │
│  │  ⚠️  Server CANNOT read plaintext!                │    │
│  └─────────────────────┬─────────────────────────────┘    │
│                        │                                   │
│                        │ Route to Recipient                 │
│                        ▼                                   │
│  ┌───────────────────────────────────────────────────┐    │
│  │              WebSocket Delivery                   │    │
│  │  - Lookup recipient socket                        │    │
│  │  - Send encrypted message                         │    │
│  │  - Server never decrypts!                         │    │
│  └─────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼───────────────────────────────┘
                           │
                           │ Send Encrypted
                           ▼
┌───────────────────────────────────────────────────────────┐
│                        Client B                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Receive Encrypted Message               │  │
│  │  { ciphertext: "...", nonce: "..." }                │  │
│  └─────────────────────┬───────────────────────────────┘  │
│                        │                                   │
│                        ▼                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐ │
│  │ Shared       │    │ AES-256-GCM  │    │ Plaintext    │ │
│  │ Secret       │───>│ Decrypt      │───>│ "Hello       │ │
│  │ (Derived)    │    │              │    │  World"      │ │
│  └──────────────┘    └──────────────┘    └──────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Display Message                         │   │
│  │  UI shows: "Hello World"                             │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

## WebSocket Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebSocket Server                          │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │              uWebSockets.js                         │     │
│  │  - Ultra-low latency                               │     │
│  │  - High performance                                │     │
│  │  - Shared compression                              │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │           Connection Manager                        │     │
│  │  - Active connections map                          │     │
│  │  - User-to-socket mapping                          │     │
│  │  - Subscription management                         │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │           Message Router                            │     │
│  │  ┌──────────────────────────────────────────┐      │     │
│  │  │  Direct Message                          │      │     │
│  │  │  ┌────────────────┐    ┌──────────────┐ │      │     │
│  │  │  │ Lookup Socket  │───>│ Send to User │ │      │     │
│  │  │  └────────────────┘    └──────────────┘ │      │     │
│  │  └──────────────────────────────────────────┘      │     │
│  │                                                     │     │
│  │  ┌──────────────────────────────────────────┐      │     │
│  │  │  Group Message                            │      │     │
│  │  │  ┌────────────────┐                      │      │     │
│  │  │  │ Get Subscribers│───> Fan-out to all   │      │     │
│  │  │  └────────────────┘    (except sender)   │      │     │
│  │  └──────────────────────────────────────────┘      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │           Presence System                            │     │
│  │  - Online/offline tracking                          │     │
│  │  - Typing indicators                                │     │
│  │  - Heartbeat / keepalive                            │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ Redis Pub/Sub
                           │ (for horizontal scaling)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server Instance 2                         │
│                    (Same architecture)                       │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema Relationships

```
┌────────────────────────────────────────────────────────────┐
│                         USERS                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ id (UUID, PK)                                       │  │
│  │ username (unique)                                   │  │
│  │ email (unique)                                      │  │
│  │ public_id (unique, rotatable)                       │  │
│  │ identity_key_public                                 │  │
│  │ identity_key_private_encrypted                       │  │
│  │ signed_pre_key_public                               │  │
│  │ signed_pre_key_signature                            │  │
│  └─────────────────────────────────────────────────────┘  │
└───┬────────────────────────────────────────────────────────┘
    │
    │ ┌──────────────────────────────────────────────────┐
    │ │              one_time_pre_keys                    │
    │ │  user_id (FK)                                    │
    │ │  key_id (unique)                                 │
    │ │  public_key                                      │
    │ └──────────────────────────────────────────────────┘
    │
    │ ┌──────────────────────────────────────────────────┐
    │ │            key_rotation_history                   │
    │ │  user_id (FK)                                    │
    │ │  old_key_id                                      │
    │ │  new_key_id                                      │
    │ └──────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│                   CONVERSATIONS                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ id (UUID, PK)                                       │  │
│  │ name (optional, for groups)                         │  │
│  │ is_direct (boolean)                                 │  │
│  │ created_by (FK -> users.id)                         │  │
│  └─────────────────────────────────────────────────────┘  │
└───┬────────────────────────────────────────────────────────┘
    │
    │ ┌──────────────────────────────────────────────────┐
    │ │        conversation_participants                  │
    │ │  conversation_id (FK)                            │
    │ │  user_id (FK)                                    │
    │ │  role (admin/member)                             │
    │ │  conversation_key_encrypted                      │
    │ │  last_read_message_id                            │
    │ └──────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────────────┐
│                      MESSAGES                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ id (UUID, PK)                                       │  │
│  │ conversation_id (FK)                                │  │
│  │ sender_id (FK -> users.id)                          │  │
│  │ encrypted_content (JSONB) ─────────────┐            │  │
│  │ message_type                              │          │  │
│  │ reply_to_id (FK -> messages.id)          │          │  │
│  │ is_edited, is_deleted                     │          │  │
│  └─────────────────────────────────────────────┘          │  │
│                                                           │  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │            message_reactions                        │  │
│  │  message_id (FK)                                    │  │
│  │  user_id (FK)                                       │  │
│  │  emoji                                              │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           message_receipts                          │  │
│  │  message_id (FK)                                    │  │
│  │  user_id (FK)                                       │  │
│  │  status (sent/delivered/read)                       │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
    │
    │ Encrypted Content Format:
    │ {
    │   "ciphertext": "base64_encoded_encrypted_data",
    │   "nonce": "base64_encoded_12_byte_nonce",
    │   "sender_key": "optional_sender_public_key"
    │ }
    │
    └──────────> Server NEVER sees plaintext!
```

## Scaling Architecture

```
                    ┌──────────────────┐
                    │   Load Balancer  │
                    │   (nginx/HAProxy)│
                    └─────────┬────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌───────────┐       ┌───────────┐       ┌───────────┐
    │  Server 1 │       │  Server 2 │       │  Server 3 │
    │           │       │           │       │           │
    │ Fastify   │       │ Fastify   │       │ Fastify   │
    │ WebSocket │       │ WebSocket │       │ WebSocket │
    └─────┬─────┘       └─────┬─────┘       └─────┬─────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                    ┌─────────▼────────┐
                    │      Redis       │
                    │  - Pub/Sub      │
                    │  - Presence     │
                    │  - Rate Limits  │
                    │  - Socket Route │
                    └──────────────────┘
                              │
                    ┌─────────▼────────┐
                    │   PostgreSQL     │
                    │  (Primary)       │
                    │  + Replicas      │
                    └──────────────────┘
```

## Technology Choices

### Why These Technologies?

**Fastify:**
- 2x faster than Express
- Built-in schema validation
- TypeScript-first
- Low overhead

**uWebSockets.js:**
- 10x faster than ws library
- Minimal memory footprint
- Built-in compression
- Production-hardened

**PostgreSQL:**
- ACID compliance
- JSONB for flexibility
- Advanced indexing
- Mature ecosystem

**Redis:**
- Sub-millisecond ops
- Pub/Sub support
- Data structure variety
- Horizontal scaling

**Next.js 15:**
- Server components
- App Router
- Excellent DX
- SEO-friendly

**X25519 + AES-256-GCM:**
- Industry standard (Signal)
- Modern algorithms
- Fast performance
- No patent issues
