# RealChat - Secure Real-Time Messaging Platform

A professional, end-to-end encrypted messaging platform with real-time WebSocket communication, featuring a modern WhatsApp-inspired interface.

## 🚀 Tech Stack

### Frontend
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Native WebSocket API** (Real-time, no polling)
- **React Hooks** (State management)
- **JWT Authentication** (Access + Refresh tokens)

### Backend
- **Node.js**
- **Fastify** (HTTP Server)
- **Fastify WebSocket** (WebSocket Server)
- **PostgreSQL** (Database with `pg` library)
- **Redis** (Presence & Rate Limiting)
- **JWT** (Simple token-based authentication)
- **Argon2** (Password Hashing)

## ✨ Features

### Core Functionality
- ✅ 1-to-1 direct conversations
- ✅ **User discovery** - Find users by public ID, username, or email
- ✅ **Real-time messaging via WebSocket** - Messages appear instantly (~10-50ms)
- ✅ **Reply to messages** with context preview
- ✅ **React to messages** - Emoji reactions with counting
- ✅ **Reaction grouping** - Same emojis grouped with counts (e.g., "❤️ 3")
- ✅ **Smart reaction display** - Only show count when >1 reaction, max 5 visible with "+X more"
- ✅ Online/offline presence tracking
- ✅ **Custom WhatsApp-inspired UI** - Professional, modern interface
- ✅ **Dark mode support** - Beautiful dark theme
- ✅ **Resizable sidebar** - Drag to resize between 250px-600px
- ✅ Responsive design - Works on desktop and mobile

### Real-Time Features
- ✅ **Instant message delivery** - Messages appear immediately (~10-50ms)
- ✅ **Live reactions** - Emoji reactions update in real-time for all users
- ✅ **Typing indicators** - Infrastructure ready for typing status
- ✅ **Single WebSocket connection** - No polling, minimal server load
- ✅ **Conversation subscriptions** - Efficient pub/sub pattern
- ✅ **Global WebSocket persistence** - Connection survives route changes
- ✅ **Auto-reconnect** - Automatically reconnects if connection drops

### UI/UX Features
- ✅ **Resizable sidebar** - Drag divider to adjust sidebar width
- ✅ **Optimized reaction display** - Grouped by emoji with counts
- ✅ **Reaction limits** - Shows max 5 reaction types with "+X more"
- ✅ **Hover actions** - Reply and react buttons appear on hover
- ✅ **Emoji picker** - Positioned above messages (not below)
- ✅ **Smooth scrolling** - Auto-scroll to newest messages
- ✅ **Message timestamps** - Shows time for each message
- ✅ **Read receipts** - Blue checkmarks for sent messages
- ✅ **Reply previews** - Show original message when replying

### Security
- ✅ **Simple JWT authentication** - No OAuth2/OIDC complexity
- ✅ **Access tokens** expire in 15 minutes
- ✅ **Refresh tokens** expire in 7 days
- ✅ **Auto token refresh** - Automatically refreshes every 5 minutes
- ✅ **Public ID system** - Base32-encoded user IDs (XXXX-XXXX-XXXX-XXXX)
- ✅ **Argon2 password hashing** - Industry-standard secure hashing
- ✅ **Rate limiting** with Redis
- ✅ **CORS protection**
- ✅ **Helmet.js security headers**
- ✅ **SQL injection prevention** (parameterized queries)

## 📁 Project Structure

```
real-chat/
├── frontend/                 # Next.js application
│   └── src/
│       └── app/
│           ├── auth/        # Authentication pages
│           │   ├── login/
│           │   └── register/
│           └── conversations/
│               └── [id]/     # Main chat interface (WebSocket + UI)
├── backend/                  # Fastify API
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── database/        # PostgreSQL connection
│   │   ├── middleware/      # Auth middleware
│   │   ├── redis/           # Redis client & presence
│   │   ├── routes/          # API endpoints
│   │   ├── utils/           # Utility functions
│   │   └── websocket/       # WebSocket server & manager
│   └── create-tables.ts     # Database migrations
├── README.md                # This file
└── AGENTS.md               # AI agent development guide
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- npm or yarn

### 1. Clone and Setup

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install
```

### 2. Environment Variables

Create `.env` file in root directory:

```env
# Database
DB_PASSWORD=your-secure-password

# JWT Secrets (generate secure random strings)
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key

# CORS
CORS_ORIGIN=http://localhost:3000
```

### 3. Start Services

```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Start backend (from backend directory)
cd backend
npm run dev

# Start frontend (from frontend directory)
cd ../frontend
npm run dev
```

### 4. Access Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **WebSocket:** ws://localhost:3001

## 💻 Development

### Backend

```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run type-check   # TypeScript type checking
npm run migrate      # Run database migrations
```

### Frontend

```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Docker

```bash
# Start all services
docker-compose up

# Start specific services
docker-compose up postgres redis

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
```

## 🏗️ Architecture

### Security Model

- **Client-side encryption:** Messages are encrypted before leaving the device
- **X25519 key exchange:** For secure key agreement
- **AES-256-GCM:** For message encryption
- **Zero-knowledge:** Server stores only encrypted content
- **Rotatable identities:** Users can regenerate their public IDs

### Real-Time Communication

- **Fastify WebSocket:** Low-latency WebSocket server
- **Global connection management:** WebSocket persists across route changes
- **Presence system:** Online/offline status tracking
- **Pub/Sub pattern:** Efficient message delivery to subscribers
- **Auto-reconnect:** Handles network drops gracefully

### Database Schema

- **PostgreSQL:** Primary data storage
- **Deterministic conversation IDs:** Same participants = same conversation
- **Encrypted content:** JSONB format for flexibility
- **Message reactions:** Many-to-many relationship with counts
- **Audit trails:** Key rotation and message history

## 📚 API Documentation

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (returns access + refresh token)
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info (includes public ID)

### Conversations

- `GET /api/conversations` - List user's conversations
- `POST /api/conversations` - Start new conversation (accepts `identifier`: public ID, username, or email)
- `GET /api/conversations/:id` - Get conversation details
- `GET /api/conversations/:id/messages` - List messages
- `POST /api/conversations/:id/messages` - Send message

### Reactions

- `POST /api/conversations/:id/messages/:messageId/react` - React to message
  - Body: `{ "emoji": "❤️" }`
  - Toggles: Add if not exists, remove if already reacted
  - Broadcasts to all subscribers in real-time

## 🎨 UI Features

### Resizable Sidebar
- **Drag to resize**: Click and drag the divider between sidebar and chat
- **Min width**: 250px
- **Max width**: 600px
- **Default**: 350px
- **Visual feedback**: Handle highlights on hover/drag

### Message Reactions
- **Grouped by emoji**: Same emojis are grouped together
- **Count display**: Shows number of reactions (e.g., "❤️ 3")
- **Smart display**: Only shows count when >1 reaction
- **Max visible**: Shows up to 5 different reaction types
- **Overflow indicator**: "+X more" for additional reaction types
- **Real-time updates**: Reactions appear instantly via WebSocket

### Reply System
- **Context preview**: Shows original message being replied to
- **Visual indicator**: Colored border indicates reply direction
- **User identification**: Shows who sent the original message
- **Inline display**: Reply preview shown within message bubble

## 🔒 Security Considerations

### Production Deployment

1. **Environment Variables:**
   - Use strong, randomly generated secrets
   - Never commit `.env` files
   - Use secret management (AWS Secrets Manager, Vault, etc.)

2. **TLS/SSL:**
   - Always use HTTPS in production
   - Always use WSS (WebSocket Secure)
   - Configure proper certificates

3. **Rate Limiting:**
   - Enabled by default with Redis
   - Configure limits based on your needs

4. **CORS:**
   - Whitelist only trusted origins
   - Use specific origins, not `*`

5. **Database:**
   - Use strong passwords
   - Restrict network access
   - Enable SSL connections

6. **Monitoring:**
   - Log access and errors
   - Monitor for suspicious activity
   - Set up alerts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🗺️ Roadmap

### Completed ✅
- **JWT-based authentication** - Simple token-based auth with auto-refresh
- **User discovery system** - Find users by public ID, username, or email
- Real-time messaging with WebSocket
- Message reactions with grouping and counting
- Reply to messages with context
- Resizable sidebar
- Dark mode support
- Reaction display limits with "+X more"
- Empty state with avatar + username

### Sprint 2 (Future)
- [ ] File uploads with encryption
- [ ] Voice/Video calls (WebRTC)
- [ ] Push notifications
- [ ] Message search (encrypted indexes)
- [ ] Multi-device sync
- [ ] Mobile apps (React Native/Flutter)
- [ ] Double ratchet for forward secrecy
- [ ] Post-quantum cryptography
- [ ] Group conversations
- [ ] Message editing
- [ ] Message deletion
- [ ] Typing indicators (full implementation)

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.
