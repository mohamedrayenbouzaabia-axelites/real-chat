/**
 * WebSocket module entry point
 * Exports WebSocket server and related functionality
 */

export { createWebSocketServer, startWebSocketServer } from './server.js';
export { wsManager } from './manager.js';
export type {
  WebSocketData,
  WSMessage,
  ConnectedSocket,
  MessagePayload,
  PresencePayload,
  TypingPayload,
  ReceiptPayload,
  ErrorPayload,
} from './types.js';
