# RealChat - AI Agent Development Guide

This guide helps AI agents (Claude, Copilot, etc.) understand the codebase architecture, conventions, and patterns for effective development.

## Project Overview

**RealChat** is an end-to-end encrypted messaging platform with real-time WebSocket communication. It uses a modern stack: Next.js 14 (frontend), Fastify (backend), PostgreSQL, Redis, and native WebSockets.

## Architecture Summary

### Frontend (`/frontend`)
- **Framework**: Next.js 14 with App Router (not Pages Router)
- **Styling**: TailwindCSS with custom inline styles for dynamic values
- **State**: React hooks (useState, useEffect, useRef) - no external state library
- **Real-time**: Native WebSocket API (single persistent connection, no polling)
- **Authentication**: Simple JWT-based auth (access tokens + refresh tokens)
- **Storage**: localStorage for tokens, custom event system for state sync
- **UI Pattern**: WhatsApp-inspired interface with resizable components

### Backend (`/backend`)
- **Framework**: Fastify (not Express)
- **Language**: TypeScript with strict type checking
- **Database**: PostgreSQL with `pg` library (not Prisma/TypeORM)
- **Real-time**: Fastify WebSocket plugin (`@fastify/websocket`)
- **Authentication**: JWT with access tokens (15min) + refresh tokens (7 days)
- **Password Hashing**: Argon2 (not bcrypt)
- **User Discovery**: Public ID system (XXXX-XXXX-XXXX-XXXX), username, or email

### Key Architectural Decisions

1. **No Polling**: Real-time updates via WebSocket only
2. **Single WebSocket Connection**: One persistent connection per client
3. **Global WebSocket Persistence**: Connection stored in `window.globalWebSocket` to survive route changes
4. **No ORM**: Direct SQL queries with prepared statements
5. **Conversation Subscriptions**: Clients subscribe to specific conversation IDs
6. **JSONB for Encrypted Content**: Messages stored as encrypted JSONB
7. **JWT-based Authentication**: Simple token-based auth without OAuth2/OIDC
8. **Public ID System**: Users can find each other by public ID, username, or email

## Critical Conventions

### File Organization

**Backend Route Structure:**
```
backend/src/routes/
├── auth/
│   ├── index.ts          # Route registration
│   ├── register.ts
│   ├── login.ts
│   └── refresh.ts
└── conversations/
    ├── index.ts          # Route registration & schema
    ├── create.ts         # Create conversation
    ├── list.ts           # List conversations
    ├── getDetail.ts      # Get conversation details
    ├── getMessages.ts    # Get conversation messages
    ├── sendMessage.ts    # Send message & broadcast
    └── reactMessage.ts   # React to message & broadcast
```

**Frontend Page Structure:**
```
frontend/src/app/
├── auth/
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
└── conversations/
    └── [id]/
        └── page.tsx      # Main chat interface (WebSocket here)
```

### Backend Route Pattern

Every route follows this pattern:

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '@/database/connection.js';
import { wsManager } from '@/websocket/manager.js';

interface RouteParams {
  // Typed params
}

interface RequestBody {
  // Typed body
}

export async function routeHandler(
  request: FastifyRequest<{
    Params: RouteParams;
    Body: RequestBody;
  }>,
  reply: FastifyReply
) {
  // 1. Extract user from request.user
  const userId = (request.user as any)?.userId;

  // 2. Validate input
  if (!param) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Param is required',
    });
  }

  // 3. Database operations
  try {
    const result = await db.query('SELECT * FROM table WHERE id = $1', [param]);

    // 4. Broadcast via WebSocket (if needed)
    wsManager.broadcastNewMessage(conversationId, result.rows[0]);

    // 5. Return response
    return reply.status(200).send({ data: result.rows });
  } catch (error) {
    request.log.error(error, 'Operation failed');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Operation failed',
    });
  }
}
```

### Frontend WebSocket Pattern

**CRITICAL**: The WebSocket uses a global singleton pattern to persist across Next.js route changes:

```typescript
// Use ref to avoid stale closures
const selectedConversationRef = useRef<Conversation | null>(null);
const wsRef = useRef<WebSocket | null>(null);

useEffect(() => {
  // Use global WebSocket to persist across route changes
  if (!(window as any).globalWebSocket) {
    const token = localStorage.getItem('access_token');
    const ws = new WebSocket(`ws://localhost:3001/ws?token=${token}`);

    // Store in global scope
    (window as any).globalWebSocket = ws;
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'new_message':
          // ALWAYS use ref, not state (avoid stale closure)
          if (selectedConversationRef.current?.id === data.payload.conversationId) {
            setMessages(prev => [...prev, data.payload.message]);
          }
          break;
        case 'new_reaction':
          // Update reactions
          break;
      }
    };
  } else {
    // Reuse existing global WebSocket
    wsRef.current = (window as any).globalWebSocket;
  }

  // Don't close WebSocket on unmount
  return () => {
    wsRef.current = null;
  };
}, []); // Empty deps = connect once
```

**Keep ref in sync with state:**
```typescript
const setSelectedConversation = (conv: Conversation) => {
  setSelectedConversation(conv);
  selectedConversationRef.current = conv; // Sync ref!
};
```

### Authentication Flow (JWT-based)

**Critical**: The system uses simple JWT authentication, NOT Keycloak OAuth2/OIDC.

**Frontend Auth Utilities** (`frontend/src/lib/keycloak.ts`):
```typescript
// Login with username/password
const { login, logout, isAuthenticated, getAccessToken } = await import('@/lib/keycloak');
const user = await login(username, password);

// Token storage in localStorage
localStorage.setItem('access_token', accessToken);
localStorage.setItem('refresh_token', refreshToken);
localStorage.setItem('user', JSON.stringify(userInfo));

// IMPORTANT: Dispatch event after login/register
window.dispatchEvent(new Event('auth-change'));
```

**AuthProvider Pattern** (`frontend/src/providers/AuthProvider.tsx`):
```typescript
// AuthProvider listens for storage changes and custom events
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'access_token' || e.key === 'refresh_token' || e.key === 'user') {
      updateAuthState();
    }
  };
  const handleAuthChange = () => {
    updateAuthState();
  };
  window.addEventListener('storage', handleStorageChange);
  window.addEventListener('auth-change', handleAuthChange);
  return () => {
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener('auth-change', handleAuthChange);
  };
}, []);
```

**Backend JWT Middleware**:
```typescript
// Verify JWT token on protected routes
export const authMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    request.user = { userId: decoded.userId };
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid token' });
  }
};
```

**Token Refresh Flow**:
```typescript
// Frontend: Auto-refresh token periodically
useEffect(() => {
  if (!authenticated) return;
  const refreshInterval = setInterval(async () => {
    const success = await updateToken();
    if (success) {
      setToken(getAccessToken());
      setUser(getUserInfo());
    } else {
      handleLogout();
    }
  }, 5 * 60 * 1000); // Every 5 minutes
  return () => clearInterval(refreshInterval);
}, [authenticated]);
```

**IMPORTANT**: After login/register, ALWAYS dispatch `window.dispatchEvent(new Event('auth-change'))` to notify AuthProvider.

### User Discovery & Public ID System

**Starting Conversations**:

Users can find each other by three methods:
1. **Public ID**: Format `XXXX-XXXX-XXXX-XXXX` (case-insensitive)
2. **Username**: Case-insensitive username lookup
3. **Email**: Case-insensitive email lookup

**Backend Conversation Creation** (`backend/src/routes/conversations/create.ts`):
```typescript
interface CreateConversationBody {
  identifier: string; // Can be public ID, username, or email
}

// Normalize identifier
const normalizedIdentifier = identifier.trim().toUpperCase();
const isPublicId = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalizedIdentifier);

if (isPublicId) {
  // Search by public_id
  otherUserResult = await db.query(
    'SELECT id, username, email, public_id FROM users WHERE public_id = $1',
    [normalizedIdentifier]
  );
} else {
  // Search by username OR email
  otherUserResult = await db.query(
    'SELECT id, username, email, public_id FROM users WHERE username = $1 OR email = $2',
    [normalizedIdentifier.toLowerCase(), identifier.toLowerCase()]
  );
}
```

**Frontend Conversation Creation**:
```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/conversations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    identifier: otherUserIdentifier // Public ID, username, or email
  }),
});
```

**IMPORTANT**: The identifier is flexible - accept any of the three formats and let the backend determine which it is.

### Database Query Patterns

**Always use parameterized queries:**
```typescript
// ✅ CORRECT
await db.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ WRONG - SQL injection risk
await db.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

**JSONB operations:**
```typescript
// Encrypted content stored as JSONB
const encryptedContent = {
  ciphertext: encryptedData,
  nonce: randomNonce,
};

await db.query(
  'INSERT INTO messages (encrypted_content) VALUES ($1)',
  [encryptedContent] // pg automatically handles JSONB
);
```

### WebSocket Message Broadcasting

When adding new WebSocket events:

1. **Add message type to backend** (`backend/src/websocket/types.ts`):
```typescript
export type WSMessageType =
  | 'message'
  | 'new_message'
  | 'new_reaction'
  | 'your_new_type'  // Add here
  | 'typing'
  | 'receipt'
  | 'error'
  | 'ping'
  | 'pong';
```

2. **Add broadcast function** (`backend/src/websocket/manager.ts`):
```typescript
broadcastYourEvent(conversationId: string, data: any): void {
  const subscribers = this.getConversationSubscribers(conversationId);
  const wsMessage: WSMessage = {
    type: 'your_new_type',
    payload: { conversationId, data },
    timestamp: Date.now(),
  };

  // Send to ALL subscribers (including sender)
  for (const subscriber of subscribers) {
    this.sendToSocket(subscriber.data.socketId, wsMessage);
  }
}
```

3. **Call broadcast in route handler**:
```typescript
import { wsManager } from '@/websocket/manager.js';

// After database operation
wsManager.broadcastYourEvent(conversationId, eventData);
```

4. **Handle in frontend** (`frontend/src/app/conversations/[id]/page.tsx`):
```typescript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'your_new_type':
      // Handle the event
      break;
  }
};
```

## Common Tasks

### Adding a New API Route

1. Create handler file in `backend/src/routes/[category]/`
2. Export route handler function
3. Register in `backend/src/routes/[category]/index.ts` with schema
4. Add authentication middleware if needed

Example:
```typescript
// backend/src/routes/conversations/newFeature.ts
export async function newFeatureHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { data: string };
  }>,
  reply: FastifyReply
) {
  const userId = (request.user as any)?.userId;
  const conversationId = request.params.id;
  const { data } = request.body;

  // Implementation

  return reply.status(200).send({ success: true });
}
```

### Adding a New Database Table

1. Create migration in `backend/create-tables.ts`
2. Run migration: `npx tsx create-tables.ts`
3. Create query functions as needed

```sql
-- Example migration
CREATE TABLE your_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_your_table_user_id ON your_table(user_id);
```

### Frontend State Management

**No external state library!** Use React hooks:

```typescript
// Simple state
const [messages, setMessages] = useState<Message[]>([]);

// Derived state - compute from existing state
const unreadCount = messages.filter(m => !m.read).length;

// Ref for non-rendering values (use for WebSocket callbacks!)
const selectedConversationRef = useRef<Conversation | null>(null);
const wsRef = useRef<WebSocket | null>(null);
```

### Styling Conventions

**Use TailwindCSS classes, custom inline styles for dynamic values:**

```typescript
// ✅ CORRECT - Tailwind for static values
<div className="bg-blue-500 text-white p-4 rounded-lg">

// ✅ CORRECT - Inline styles for dynamic values
<div style={{ backgroundColor: userColor, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>

// ✅ CORRECT - Resizable sidebar with state
<div style={{ width: `${sidebarWidth}px`, minWidth: '250px' }}>

// ❌ WRONG - Don't use arbitrary values if Tailwind has utilities
<div className="bg-[#rgb(22,163,74)]">
// Instead use: <div style={{ backgroundColor: 'rgb(22 163 74)' }}>
```

### UI Components

**Resizable Sidebar Pattern:**
```typescript
const [sidebarWidth, setSidebarWidth] = useState(350);
const [isResizing, setIsResizing] = useState(false);

// Mouse handlers
const handleMouseDown = (e: React.MouseEvent) => {
  setIsResizing(true);
  e.preventDefault();
};

useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
      setSidebarWidth(newWidth);
    }
  };

  if (isResizing) {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', () => setIsResizing(false));
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }
}, [isResizing]);
```

**Reaction Grouping Pattern:**
```typescript
// Group reactions by emoji
const reactionGroups = reactions.reduce((acc, reaction) => {
  if (!acc[reaction.emoji]) {
    acc[reaction.emoji] = { emoji: reaction.emoji, count: 0, users: [] };
  }
  acc[reaction.emoji].count++;
  acc[reaction.emoji].users.push(reaction.user_id);
  return acc;
}, {} as Record<string, { emoji: string; count: number; users: string[] }>);

const groupedReactions = Object.values(reactionGroups);
const visibleReactions = groupedReactions.slice(0, 5); // Max 5 visible
const remainingCount = groupedReactions.length - 5;
```

## Security Best Practices

### Always Do:
- ✅ Use parameterized database queries
- ✅ Validate JWT tokens on protected routes
- ✅ Use HTTPS/WSS in production
- ✅ Hash passwords with Argon2
- ✅ Sanitize user input
- ✅ Use environment variables for secrets
- ✅ Implement rate limiting
- ✅ Use refs for WebSocket callbacks (avoid stale closures)

### Never Do:
- ❌ Trust client-side input
- ❌ Store passwords in plain text
- ❌ Expose sensitive data in logs
- ❌ Use `eval()` or similar dangerous functions
- ❌ Hardcode credentials
- ❌ Ignore error handling
- ❌ Use stale state in WebSocket callbacks
- ❌ Close WebSocket on component unmount (use global pattern)

## WebSocket Debugging

**Check these things in order:**

1. **WebSocket connected?** Look for `WebSocket opened: <socketId>` in backend logs
2. **Subscribed to conversation?** Look for `Socket <id> subscribed to <conversationId>`
3. **Broadcast called?** Add `console.log` to verify
4. **Subscribers found?** Check subscriber count in logs
5. **Message sent?** Check for successful send logs
6. **Using ref?** Verify WebSocket callbacks use `selectedConversationRef.current` not `selectedConversation`

**Common issues:**
- Connection closes immediately → Check JWT token validity
- No subscribers → Client didn't send subscribe message
- Message not received → Check conversation ID matches, verify using ref
- Stale connection → Check if using `selectedConversationRef.current`
- Messages require refresh → Removed `fetchMessages()` calls after send

## Database Schema Reference

### Tables

**users:**
- `id` (UUID, PK)
- `username` (text, unique)
- `public_id` (text, unique, format: XXXX-XXXX-XXXX-XXXX)
- `password_hash` (text)
- `created_at` (timestamp)

**conversations:**
- `id` (UUID, PK)
- `is_direct` (boolean)
- `name` (text, nullable)
- `created_at` (timestamp)
- `updated_at` (timestamp)

**messages:**
- `id` (UUID, PK)
- `conversation_id` (UUID, FK)
- `sender_id` (UUID, FK)
- `encrypted_content` (JSONB) - Format: `{ciphertext, nonce}`
- `message_type` (text)
- `reply_to_id` (UUID, FK, nullable)
- `is_deleted` (boolean)
- `created_at` (timestamp)

**message_reactions:**
- `id` (UUID, PK)
- `message_id` (UUID, FK)
- `user_id` (UUID, FK)
- `emoji` (text)
- `created_at` (timestamp)
- **Unique constraint**: (message_id, user_id, emoji)

**conversation_participants:**
- `id` (UUID, PK)
- `conversation_id` (UUID, FK)
- `user_id` (UUID, FK)
- `last_read_at` (timestamp, nullable)
- `left_at` (timestamp, nullable)

## Important Files Reference

### Backend Core
- `backend/src/index.ts` - Entry point, server initialization
- `backend/src/app.ts` - Fastify app configuration, middleware
- `backend/src/server.ts` - HTTP server startup
- `backend/src/database/connection.ts` - PostgreSQL connection pool
- `backend/src/redis/client.ts` - Redis client singleton

### WebSocket
- `backend/src/websocket/server.ts` - WebSocket route & connection handling
- `backend/src/websocket/manager.ts` - Connection manager, broadcast logic
- `backend/src/websocket/types.ts` - TypeScript types for WebSocket messages

### Routes
- `backend/src/routes/conversations/index.ts` - All conversation routes
- `backend/src/routes/conversations/sendMessage.ts` - Message sending & broadcasting
- `backend/src/routes/conversations/reactMessage.ts` - Reaction handling & toggling

### Frontend
- `frontend/src/app/conversations/[id]/page.tsx` - Main chat interface with WebSocket, reactions, resizable sidebar

## Development Workflow

1. **Make changes** to backend/frontend
2. **Backend auto-reloads** with `tsx watch`
3. **Frontend hot-reloads** with Next.js dev server
4. **Test WebSocket** by opening browser console and looking for `WebSocket connected`
5. **Check backend logs** for WebSocket connections and broadcasts
6. **Verify real-time** with two browser windows

## Testing Checklist

Before committing changes:

- [ ] WebSocket connects successfully
- [ ] Messages appear in real-time (no refresh needed)
- [ ] Reactions work instantly
- [ ] Reactions group correctly with counts
- [ ] Resizable sidebar works
- [ ] No polling requests in network tab
- [ ] Multiple tabs can chat simultaneously
- [ ] Authentication works correctly
- [ ] Database queries use parameters
- [ ] Error handling is present
- [ ] Logs are informative
- [ ] TypeScript types are correct
- [ ] Using refs for WebSocket callbacks

## Troubleshooting

### WebSocket not connecting
- Check token is valid and not expired
- Verify backend is running on port 3001
- Check browser console for WebSocket errors
- Look for `WebSocket opened` in backend logs

### Messages not appearing in real-time
- Verify client sent `subscribe` message
- Check backend logs for subscriber count
- Ensure conversation IDs match
- Check for broadcast logs
- **CRITICAL**: Verify using `selectedConversationRef.current` not `selectedConversation`

### Stale state in WebSocket callbacks
- Using state value instead of ref value
- Fix: Use `selectedConversationRef.current` in `ws.onmessage`

### Database errors
- Verify PostgreSQL is running
- Check database exists
- Ensure migrations were run
- Check connection string in `.env`

### Build errors
- Run `npm install` in both frontend and backend
- Check TypeScript versions match
- Clear `node_modules` and reinstall if needed

## Quick Reference Commands

```bash
# Backend
cd backend
npm run dev          # Start with hot reload
npx tsx create-tables.ts  # Run migrations

# Frontend
cd frontend
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # Check code quality

# Database
psql -d realchat     # Connect to database
```

## Notes for AI Agents

1. **Never use polling** - WebSocket only for real-time
2. **Always use TypeScript strict mode** - No `any` without explicit reason
3. **Follow existing patterns** - Don't introduce new libraries without discussion
4. **Test with multiple browser windows** - Verify real-time works
5. **Check logs first** - Backend logs are very informative
6. **Ask questions** - If unsure about architecture, ask before implementing
7. **Use refs for WebSocket callbacks** - Always use `selectedConversationRef.current` in `ws.onmessage`
8. **Never close WebSocket on unmount** - Use global pattern to persist connection
9. **Remove fetchMessages after send** - WebSocket handles real-time updates
10. **JWT auth only** - NO Keycloak, NO OAuth2/OIDC, simple token-based auth
11. **Dispatch auth-change event** - Always dispatch after login/register to notify AuthProvider
12. **Use flexible identifier** - Accept public ID, username, or email for user discovery

## Recent Changes

### JWT Authentication System (Latest - January 2026)
- ✅ **Removed Keycloak** - No longer using OAuth2/OIDC
- ✅ **Simple JWT-based auth** - Access tokens (15min) + refresh tokens (7 days)
- ✅ **localStorage token storage** - Tokens stored in browser localStorage
- ✅ **Custom event system** - AuthProvider listens for 'auth-change' events
- ✅ **Auto token refresh** - Automatically refresh tokens every 5 minutes
- ✅ **Flexible user discovery** - Find users by public ID, username, or email
- ✅ **Fixed authentication flow** - Login/register properly redirects and maintains session

### Public ID System
- ✅ **Base32-encoded IDs** - Format: XXXX-XXXX-XXXX-XXXX
- ✅ **Multiple lookup methods** - Public ID, username, or email
- ✅ **Case-insensitive** - Public IDs work regardless of case
- ✅ **Backend validation** - Smart detection of identifier type
- ✅ **User-friendly** - Easy to share and remember

### UI/UX Improvements
- ✅ **Removed duplicate pages** - Deleted /conversations/home (now only /conversations/[id])
- ✅ **Improved empty state** - Shows avatar + username when no messages
- ✅ **Added resizable sidebar** (250px-600px)
- ✅ **Implemented reaction grouping** with counts
- ✅ **Smart reaction display** (only show count when >1)
- ✅ **Max 5 visible reaction types** with "+X more"
- ✅ **Fixed emoji picker positioning** (above messages)
- ✅ **Added hover actions** for reply/react

### WebSocket Real-Time
- ✅ Fixed WebSocket to broadcast to ALL subscribers (including sender)
- ✅ Implemented global WebSocket pattern to survive route changes
- ✅ Fixed stale closure issue using refs (`selectedConversationRef`)
- ✅ Removed all `fetchMessages()` calls after send/react
- ✅ Messages now appear instantly (~10-50ms) without refresh

### Reply System
- ✅ Reply to messages with context preview
- ✅ Visual indicator for replies
- ✅ Shows original message content

## Current Status

**Working Features:**
- ✅ User registration & login with JWT authentication
- ✅ Token-based auth with auto-refresh (15min access, 7 day refresh)
- ✅ Direct message conversations
- ✅ **User discovery** by public ID, username, or email
- ✅ **Real-time messaging (WebSocket)** - Messages appear instantly
- ✅ **Real-time reactions** - Reactions update instantly for all users
- ✅ Message replies with preview
- ✅ Emoji reactions with grouping and counting
- ✅ Resizable sidebar (drag to resize)
- ✅ Custom message colors (green bubbles)
- ✅ Patterned background
- ✅ Message shadows
- ✅ Reply preview above input
- ✅ Emoji picker for reactions
- ✅ Dark mode support
- ✅ Global WebSocket persistence
- ✅ Empty state with avatar + username

**Known Issues:**
- None critical - all major features working

**Next Priority:**
- 🔲 File uploads with encryption
- 🔲 Message editing
- 🔲 Message deletion
- 🔲 Group conversations
- 🔲 Typing indicators (full implementation)
