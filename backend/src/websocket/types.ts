/**
 * WebSocket connection data
 */
export interface WebSocketData {
  userId: string;
  username: string;
  socketId: string;
  serverId: string;
  connectedAt: number;
}

/**
 * WebSocket message types
 */
export type WSMessageType =
  | 'message'
  | 'new_message'
  | 'new_reaction'
  | 'presence'
  | 'typing'
  | 'receipt'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * Base WebSocket message
 */
export interface WSMessage<T = any> {
  type: WSMessageType;
  payload: T;
  timestamp: number;
}

/**
 * Message payload
 */
export interface MessagePayload {
  conversationId: string;
  messageId: string;
  encryptedContent: {
    ciphertext: string;
    nonce: string;
  };
  senderId: string;
  messageType: string;
  replyToId?: string;
}

/**
 * Presence payload
 */
export interface PresencePayload {
  userId: string;
  status: 'online' | 'offline';
  timestamp: number;
}

/**
 * Typing indicator payload
 */
export interface TypingPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

/**
 * Read receipt payload
 */
export interface ReceiptPayload {
  messageId: string;
  userId: string;
  status: 'delivered' | 'read';
  timestamp: number;
}

/**
 * Error payload
 */
export interface ErrorPayload {
  code: string;
  message: string;
}

/**
 * Connected socket info
 */
export interface ConnectedSocket {
  data: WebSocketData;
  subscriptions: Set<string>; // Conversation IDs
  socket?: any; // WebSocket connection reference
}
