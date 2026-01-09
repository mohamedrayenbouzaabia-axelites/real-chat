# RealChat API Documentation

## Base URL
```
http://localhost:3001
```

## Authentication
All endpoints except `/register` and `/login` require authentication:

```bash
Authorization: Bearer <access_token>
```

---

## Endpoints

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (201):**
```json
{
  "user": {
    "userId": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "publicId": "ABCD-1234-EFGH-5678",
    "createdAt": "2025-01-08T10:00:00Z"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 604800
  }
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "identifier": "johndoe",  // username or email
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "userId": "uuid",
    "username": "johndoe",
    "email": "john@example.com",
    "publicId": "ABCD-1234-EFGH-5678"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 604800
  }
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 604800
  }
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "user": {
    "userId": "uuid",
    "username": "johndoe"
  }
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

### Health Check

#### Health Status
```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-01-08T10:00:00Z",
  "checks": {
    "database": "ok",
    "redis": "ok"
  }
}
```

---

## WebSocket Protocol

### Connection URL
```
ws://localhost:3001/?token=<access_token>
```

### Message Format
```typescript
{
  type: 'ping' | 'pong' | 'subscribe' | 'unsubscribe' | 'typing' | 'message' | 'presence' | 'error',
  payload: any,
  timestamp: number
}
```

### Message Types

#### Ping
Client → Server (keepalive)
```json
{
  "type": "ping",
  "payload": {},
  "timestamp": 1234567890
}
```

#### Pong
Server → Client (keepalive response)
```json
{
  "type": "pong",
  "payload": {},
  "timestamp": 1234567890
}
```

#### Subscribe
Client → Server (subscribe to conversation)
```json
{
  "type": "subscribe",
  "payload": {
    "conversationId": "uuid"
  },
  "timestamp": 1234567890
}
```

#### Unsubscribe
Client → Server (unsubscribe from conversation)
```json
{
  "type": "unsubscribe",
  "payload": {
    "conversationId": "uuid"
  },
  "timestamp": 1234567890
}
```

#### Typing
Client → Server (typing indicator)
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

Server → Client (broadcast to conversation)
```json
{
  "type": "typing",
  "payload": {
    "conversationId": "uuid",
    "userId": "uuid",
    "isTyping": true
  },
  "timestamp": 1234567890
}
```

#### Presence
Server → Client (user online/offline)
```json
{
  "type": "presence",
  "payload": {
    "userId": "uuid",
    "status": "online",
    "timestamp": 1234567890
  },
  "timestamp": 1234567890
}
```

#### Error
Server → Client (error response)
```json
{
  "type": "error",
  "payload": {
    "code": "ERROR_CODE",
    "message": "Error description"
  },
  "timestamp": 1234567890
}
```

---

## Error Responses

### Format
```json
{
  "error": "Error Type",
  "message": "Error description",
  "details": {}  // Optional
}
```

### Common HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - Service degraded

### Rate Limiting
When rate limit is exceeded:
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1234567890

{
  "error": "Too many requests",
  "message": "Rate limit exceeded",
  "retryAfter": 60
}
```

---

## Coming Soon (Sprint 1)

### Conversations

- `POST /api/conversations` - Create conversation
- `GET /api/conversations` - List user's conversations
- `GET /api/conversations/:id` - Get conversation details
- `POST /api/conversations/:id/participants` - Add participant
- `DELETE /api/conversations/:id/participants/:userId` - Remove participant

### Messages

- `GET /api/conversations/:id/messages` - List messages (paginated)
- `POST /api/conversations/:id/messages` - Send message
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message
- `POST /api/messages/:id/reply` - Reply to message
- `POST /api/messages/:id/react` - React to message
- `POST /api/messages/:id/read` - Mark as read

---

## Examples with curl

### Register and Login
```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "securepassword123"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "testuser",
    "password": "securepassword123"
  }'

# Get user info (replace TOKEN with actual token)
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer TOKEN"
```

### WebSocket with wscat
```bash
# Install wscat
npm install -g wscat

# Connect (replace TOKEN with actual token)
wscat -c "ws://localhost:3001/?token=TOKEN"

# Send messages
> {"type":"ping","payload":{},"timestamp":1234567890}
> {"type":"subscribe","payload":{"conversationId":"uuid"},"timestamp":1234567890}

# Receive messages
< {"type":"pong","payload":{},"timestamp":1234567890}
< {"type":"presence","payload":{"userId":"uuid","status":"online"},"timestamp":1234567890}
```

---

## Notes

### Token Expiration
- **Access Token:** 7 days
- **Refresh Token:** 30 days
- Use refresh token to get new access token

### Rate Limits
- **Default:** 100 requests per minute
- **WebSocket:** 10 connections per minute
- Use Redis for distributed rate limiting

### Public ID Format
- Format: `XXXX-XXXX-XXXX-XXXX`
- 16 characters (Base32)
- Hyphens every 4 characters
- Example: `ABCD-1234-EFGH-5678`

### Encryption (Coming Soon)
- Messages encrypted with AES-256-GCM
- Key exchange via X25519
- Server stores ONLY encrypted content
- Client handles all encryption/decryption
