import type {
  WebSocketData,
  WSMessage,
  ConnectedSocket,
} from './types.js';
import { v4 as uuidv4 } from 'uuid';
import { presenceManager } from '@/redis/presence.js';
import { socketRouter } from '@/redis/socketRouter.js';

/**
 * WebSocket connection manager
 * Tracks active connections and handles subscription management
 */
class WebSocketManager {
  private connections: Map<string, ConnectedSocket> = new Map();
  private serverId: string;

  constructor() {
    // Generate unique server ID
    this.serverId = `server-${uuidv4()}`;
  }

  /**
   * Get server ID
   */
  getServerId(): string {
    return this.serverId;
  }

  /**
   * Add connection
   */
  async addConnection(socketId: string, data: WebSocketData, socket?: any): Promise<void> {
    const connectedSocket: ConnectedSocket = {
      data,
      subscriptions: new Set(),
      socket,
    };

    this.connections.set(socketId, connectedSocket);

    // Set user online
    await presenceManager.setOnline(
      data.userId,
      socketId,
      { username: data.username }
    );

    // Register socket in router
    await socketRouter.registerSocket(
      data.userId,
      socketId,
      this.serverId
    );

    console.log(`Connection added: ${socketId} for user ${data.userId}`);
  }

  /**
   * Remove connection
   */
  async removeConnection(socketId: string): Promise<void> {
    const connection = this.connections.get(socketId);

    if (connection) {
      const { userId } = connection.data;

      // Set user offline
      await presenceManager.setOffline(userId, socketId);

      // Remove from router
      await socketRouter.removeSocket(userId, socketId);

      // Remove from memory
      this.connections.delete(socketId);

      console.log(`Connection removed: ${socketId} for user ${userId}`);
    }
  }

  /**
   * Get connection
   */
  getConnection(socketId: string): ConnectedSocket | undefined {
    return this.connections.get(socketId);
  }

  /**
   * Get connection by user ID
   */
  getConnectionByUserId(userId: string): ConnectedSocket | undefined {
    for (const connection of this.connections.values()) {
      if (connection.data.userId === userId) {
        return connection;
      }
    }
    return undefined;
  }

  /**
   * Subscribe to conversation
   */
  subscribeToConversation(socketId: string, conversationId: string): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.subscriptions.add(conversationId);
      console.log(`Socket ${socketId} subscribed to ${conversationId}`);
    }
  }

  /**
   * Unsubscribe from conversation
   */
  unsubscribeFromConversation(
    socketId: string,
    conversationId: string
  ): void {
    const connection = this.connections.get(socketId);
    if (connection) {
      connection.subscriptions.delete(conversationId);
      console.log(`Socket ${socketId} unsubscribed from ${conversationId}`);
    }
  }

  /**
   * Get conversation subscribers
   */
  getConversationSubscribers(conversationId: string): ConnectedSocket[] {
    const subscribers: ConnectedSocket[] = [];

    for (const connection of this.connections.values()) {
      if (connection.subscriptions.has(conversationId)) {
        subscribers.push(connection);
      }
    }

    return subscribers;
  }

  /**
   * Get all connections
   */
  getAllConnections(): ConnectedSocket[] {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get user count
   */
  getUserCount(): number {
    const uniqueUsers = new Set();
    for (const connection of this.connections.values()) {
      uniqueUsers.add(connection.data.userId);
    }
    return uniqueUsers.size;
  }

  /**
   * Broadcast to all connections
   */
  broadcast(message: WSMessage): void {
    const messageStr = JSON.stringify(message);

    for (const connection of this.connections.values()) {
      // Send to connection (implementation-specific)
      // This would use the actual WebSocket send method
    }
  }

  /**
   * Send to specific socket
   */
  sendToSocket(socketId: string, message: WSMessage): boolean {
    const connection = this.connections.get(socketId);
    if (!connection || !connection.socket) {
      return false;
    }

    try {
      const messageStr = JSON.stringify(message);
      connection.socket.send(messageStr);
      return true;
    } catch (error) {
      console.error(`Error sending to socket ${socketId}:`, error);
      return false;
    }
  }

  /**
   * Send to user
   */
  sendToUser(userId: string, message: WSMessage): boolean {
    const connection = this.getConnectionByUserId(userId);
    if (!connection) {
      return false;
    }

    // Send to user's socket
    return this.sendToSocket(connection.data.socketId, message);
  }

  /**
   * Send to conversation subscribers
   */
  sendToConversation(
    conversationId: string,
    message: WSMessage,
    excludeUserId?: string
  ): number {
    const subscribers = this.getConversationSubscribers(conversationId);
    console.log(`sendToConversation: ${subscribers.length} subscribers for conversation ${conversationId}`);
    let sent = 0;

    for (const subscriber of subscribers) {
      // Exclude specific user (e.g., sender)
      if (excludeUserId && subscriber.data.userId === excludeUserId) {
        console.log(`Excluding user ${subscriber.data.userId} from broadcast`);
        continue;
      }

      console.log(`Sending to socket ${subscriber.data.socketId} (user ${subscriber.data.userId})`);
      if (this.sendToSocket(subscriber.data.socketId, message)) {
        sent++;
      }
    }

    console.log(`Successfully sent to ${sent} subscribers`);
    return sent;
  }

  /**
   * Broadcast new message to conversation subscribers
   * Sends to ALL subscribers including the sender (so they see their own message via WebSocket)
   */
  broadcastNewMessage(conversationId: string, message: any): void {
    const subscribers = this.getConversationSubscribers(conversationId);
    console.log(`Broadcasting to ${subscribers.length} subscribers for conversation ${conversationId}`);

    const wsMessage: WSMessage = {
      type: 'new_message',
      payload: {
        conversationId,
        message,
      },
      timestamp: Date.now(),
    };

    // Send to ALL subscribers (no excludeUserId parameter)
    // This ensures the sender also receives the message via WebSocket
    for (const subscriber of subscribers) {
      console.log(`Sending to socket ${subscriber.data.socketId} (user ${subscriber.data.userId})`);
      this.sendToSocket(subscriber.data.socketId, wsMessage);
    }
  }

  /**
   * Broadcast new reaction to conversation subscribers
   * Sends to ALL subscribers including the sender (so they see their own reaction via WebSocket)
   */
  broadcastNewReaction(conversationId: string, messageId: string, reaction: any): void {
    const subscribers = this.getConversationSubscribers(conversationId);
    console.log(`Broadcasting reaction to ${subscribers.length} subscribers for conversation ${conversationId}`);

    const wsMessage: WSMessage = {
      type: 'new_reaction',
      payload: {
        conversationId,
        messageId,
        reaction,
      },
      timestamp: Date.now(),
    };

    // Send to ALL subscribers (no excludeUserId parameter)
    // This ensures the sender also receives the reaction via WebSocket
    for (const subscriber of subscribers) {
      console.log(`Sending reaction to socket ${subscriber.data.socketId} (user ${subscriber.data.userId})`);
      this.sendToSocket(subscriber.data.socketId, wsMessage);
    }
  }
}

// Export singleton
export const wsManager = new WebSocketManager();
