import { redisClient } from './client.js';

const PRESENCE_PREFIX = 'presence';
const ONLINE_SET = 'online_users';
const TTL = 120; // 2 minutes

/**
 * Presence management for online/offline tracking
 */
export class PresenceManager {
  /**
   * Set user as online
   */
  async setOnline(
    userId: string,
    socketId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const key = `${PRESENCE_PREFIX}:${userId}`;
    const data = {
      socketId,
      timestamp: Date.now(),
      ...metadata,
    };

    await redisClient.hmset(key, data);
    await redisClient.expire(key, TTL);
    await redisClient.sadd(ONLINE_SET, userId);

    // Publish presence event
    await this.publishPresenceChange(userId, 'online', metadata);
  }

  /**
   * Set user as offline
   */
  async setOffline(userId: string, socketId: string): Promise<void> {
    const key = `${PRESENCE_PREFIX}:${userId}`;
    const current = await redisClient.hgetall(key);

    // Only remove if it's the same socket
    if (current && current.socketId === socketId) {
      await redisClient.del(key);
      await redisClient.srem(ONLINE_SET, userId);
      await this.publishPresenceChange(userId, 'offline');
    }
  }

  /**
   * Check if user is online
   */
  async isOnline(userId: string): Promise<boolean> {
    const key = `${PRESENCE_PREFIX}:${userId}`;
    const exists = await redisClient.exists(key);
    return exists === 1;
  }

  /**
   * Get batch online status
   */
  async getOnlineStatus(userIds: string[]): Promise<Record<string, boolean>> {
    const pipeline = redisClient.pipeline();
    userIds.forEach((id) => {
      pipeline.exists(`${PRESENCE_PREFIX}:${id}`);
    });

    const results = await pipeline.exec();

    const status: Record<string, boolean> = {};
    userIds.forEach((id, index) => {
      status[id] = results?.[index]?.[1] === 1;
    });

    return status;
  }

  /**
   * Get all online users
   */
  async getOnlineUsers(): Promise<string[]> {
    return await redisClient.smembers(ONLINE_SET);
  }

  /**
   * Get user's presence data
   */
  async getUserPresence(userId: string): Promise<Record<string, any> | null> {
    const key = `${PRESENCE_PREFIX}:${userId}`;
    const data = await redisClient.hgetall(key);
    return Object.keys(data).length > 0 ? data : null;
  }

  /**
   * Extend user's online session (heartbeat)
   */
  async refreshSession(userId: string): Promise<void> {
    const key = `${PRESENCE_PREFIX}:${userId}`;
    const exists = await redisClient.exists(key);
    if (exists) {
      await redisClient.expire(key, TTL);
    }
  }

  /**
   * Subscribe to presence changes
   */
  async subscribeToPresenceChanges(
    callback: (data: PresenceChange) => void
  ): Promise<void> {
    const channel = 'presence:changes';
    const subscriber = redisClient.duplicate();

    await subscriber.subscribe(channel);

    subscriber.on('message', (_channel, message) => {
      if (_channel === channel) {
        try {
          const data = JSON.parse(message) as PresenceChange;
          callback(data);
        } catch (error) {
          console.error('Failed to parse presence change:', error);
        }
      }
    });
  }

  /**
   * Publish presence change event
   */
  private async publishPresenceChange(
    userId: string,
    status: 'online' | 'offline',
    metadata?: Record<string, any>
  ): Promise<void> {
    const channel = 'presence:changes';
    const data: PresenceChange = {
      userId,
      status,
      timestamp: Date.now(),
      metadata,
    };

    await redisClient.publish(channel, JSON.stringify(data));
  }
}

// Types
export interface PresenceChange {
  userId: string;
  status: 'online' | 'offline';
  timestamp: number;
  metadata?: Record<string, any>;
}

// Export singleton
export const presenceManager = new PresenceManager();
