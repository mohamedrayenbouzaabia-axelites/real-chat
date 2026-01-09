# RealChat - Quick Start Guide

## Project Status

**Foundation Complete!** ✅

The backend and frontend foundations are fully implemented with:
- ✅ Complete backend with Fastify + uWebSockets.js
- ✅ PostgreSQL database with comprehensive schema
- ✅ Redis for presence and rate limiting
- ✅ JWT authentication with registration/login
- ✅ WebSocket server for real-time communication
- ✅ Next.js 15 frontend with TypeScript + Tailwind
- ✅ Docker Compose for easy local development

## Quick Start

### 1. Start Infrastructure (PostgreSQL + Redis)

```bash
docker-compose up postgres redis -d
```

### 2. Initialize Database

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your settings
npm run migrate
```

### 3. Start Backend

```bash
npm run dev
```

Backend will run on http://localhost:3001

### 4. Start Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend will run on http://localhost:3000

## What's Implemented

### Backend ✅

**Infrastructure:**
- ✅ Fastify HTTP server with security plugins
- ✅ uWebSockets.js WebSocket server
- ✅ PostgreSQL connection pool with comprehensive schema
- ✅ Redis client with pub/sub support
- ✅ Environment validation with Zod
- ✅ TypeScript strict mode
- ✅ Docker Compose configuration

**Authentication:**
- ✅ User registration with unique public IDs
- ✅ User login with JWT tokens
- ✅ Token refresh mechanism
- ✅ Argon2 password hashing
- ✅ API-key-like public identifiers (XXXX-XXXX-XXXX-XXXX)

**Real-Time:**
- ✅ WebSocket server with authentication
- ✅ Connection management
- ✅ Presence system (online/offline)
- ✅ Message routing
- ✅ Cross-server communication support

**Security:**
- ✅ Helmet for security headers
- ✅ CORS configuration
- ✅ Rate limiting (Redis-backed)
- ✅ Input validation with Zod
- ✅ JWT authentication middleware

**Database:**
- ✅ Complete schema with 8 tables
- ✅ Indexes for performance
- ✅ Foreign key constraints
- ✅ Triggers for auto-updates
- ✅ Views for common queries

### Frontend ✅

**Foundation:**
- ✅ Next.js 15 with App Router
- ✅ TypeScript configuration
- ✅ Tailwind CSS with custom theme
- ✅ Responsive design system
- ✅ Environment configuration
- ✅ Home page with feature overview

## Project Structure

```
real-chat/
├── backend/
│   ├── src/
│   │   ├── app.ts              # Fastify app configuration
│   │   ├── server.ts           # HTTP server entry point
│   │   ├── index.ts            # Main entry (HTTP + WebSocket)
│   │   ├── config/             # Environment configuration
│   │   ├── database/           # PostgreSQL connection & schema
│   │   ├── redis/              # Redis client & managers
│   │   │   ├── client.ts       # Redis connection
│   │   │   ├── presence.ts     # Online/offline tracking
│   │   │   ├── socketRouter.ts # Cross-server routing
│   │   │   └── rateLimit.ts    # Rate limiting
│   │   ├── lib/
│   │   │   ├── auth/           # JWT & password hashing
│   │   │   └── identity/       # Public ID generation
│   │   ├── middleware/         # Auth, validation, rate limiting
│   │   ├── routes/
│   │   │   └── auth/           # Auth endpoints
│   │   ├── schemas/            # Zod validation schemas
│   │   └── websocket/          # WebSocket server & manager
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/                # Next.js app router
│   │   ├── components/         # React components
│   │   ├── lib/                # Utilities, API, crypto
│   │   └── styles/             # Global styles
│   ├── package.json
│   └── tsconfig.json
│
└── docker-compose.yml          # PostgreSQL + Redis
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

### Health

- `GET /health` - Health check endpoint

## WebSocket Protocol

### Connection

Connect to: `ws://localhost:3001/?token=<jwt_token>`

### Message Types

```typescript
{
  type: 'ping' | 'subscribe' | 'typing' | 'message',
  payload: { ... },
  timestamp: number
}
```

### Examples

**Ping/Pong:**
```json
{
  "type": "ping",
  "payload": {},
  "timestamp": 1234567890
}
```

**Subscribe to conversation:**
```json
{
  "type": "subscribe",
  "payload": {
    "conversationId": "uuid"
  },
  "timestamp": 1234567890
}
```

**Typing indicator:**
```json
{
  "type": "typing",
  "payload": {
    "conversationId": "uuid",
    "isTyping": true
  },
  "timestamp": 1234567890
}
```

## Database Schema Highlights

**Users:**
- Internal UUID (private)
- Public ID (API-key-like, rotatable)
- E2EE identity keys
- Signed pre-keys for X3DH

**Conversations:**
- Direct and group conversations
- Deterministic IDs for 1:1 chats
- Participant management

**Messages:**
- Encrypted content only (JSONB)
- Reply threading
- Edit/delete tracking
- Reactions support

## Testing the API

### Register a User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

Response will include:
- User info with public ID
- Access token (7 days)
- Refresh token (30 days)

### Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "securepassword123"
  }'
```

### Health Check

```bash
curl http://localhost:3001/health
```

## Next Steps (To Complete Sprint 1)

### Priority 1: Core Features
1. **Conversation Routes** - Create/list conversations
2. **Message Routes** - Send/receive/edit/delete messages
3. **Frontend Auth Pages** - Login/register UI
4. **WebSocket Message Handler** - Real-time message delivery

### Priority 2: Cryptography
1. **Key Management** - Client-side X25519 key generation
2. **Encryption** - AES-256-GCM message encryption
3. **Key Exchange** - X3DH protocol implementation

### Priority 3: Chat UI
1. **Conversation List** - Show all user conversations
2. **Message List** - Virtualized message display
3. **Message Input** - Text input with encryption
4. **Real-time Updates** - WebSocket integration

### Priority 4: Polish
1. **Error Handling** - Proper error messages
2. **Loading States** - Better UX
3. **Responsive Design** - Mobile-friendly
4. **Testing** - Manual testing checklist

## Development Notes

### Backend

- Uses ES modules (`"type": "module"`)
- Path aliases configured in tsconfig.json
- `tsx watch` for hot-reloading in development
- Strict TypeScript enabled

### Frontend

- Next.js 15 App Router
- Server components by default
- Client components with `'use client'` directive
- Tailwind CSS for styling

### Environment Variables

**Backend (.env):**
```
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
CORS_ORIGIN=http://localhost:3000
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## Troubleshooting

### Database Connection Failed

1. Ensure PostgreSQL is running: `docker-compose ps`
2. Check DATABASE_URL in .env
3. Run migrations: `npm run migrate`

### WebSocket Connection Failed

1. Ensure backend is running
2. Check token is valid
3. Verify WS_URL in frontend .env

### Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

## Contributing

When adding new features:
1. Update this README
2. Follow existing code patterns
3. Use TypeScript strict mode
4. Add input validation with Zod
5. Handle errors gracefully
6. Test with curl/frontend

## License

MIT
