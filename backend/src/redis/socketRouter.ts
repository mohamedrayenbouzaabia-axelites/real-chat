import { redisClient } from './client.js';

const ROUTE_PREFIX = 'socket:route';

/**
 * Socket routing for horizontal scaling
 * Maps users to socket instances across multiple servers
 */
export class SocketRouter {
  /**
   * Register a socket connection
   */
  async registerSocket(
    userId: string,
    socketId: string,
    serverId: string
  ): Promise<void> {
    const key = `${ROUTE_PREFIX}:${userId}`;
    const data = {
      socketId,
      serverId,
      lastHeartbeat: Date.now(),
    };

    await redisClient.hmset(key, data);
    await redisClient.expire(key, 300); // 5 minutes
  }

  /**
   * Get user's socket info
   */
  async getUserSocket(
    userId: string
  ): Promise<SocketInfo | null> {
    const key = `${ROUTE_PREFIX}:${userId}`;
    const data = await redisClient.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      socketId: data.socketId,
      serverId: data.serverId,
      lastHeartbeat: parseInt(data.lastHeartbeat),
    };
  }

  /**
   * Remove socket registration
   */
  async removeSocket(userId: string, socketId: string): Promise<void> {
    const key = `${ROUTE_PREFIX}:${userId}`;
    const current = await redisClient.hgetall(key);

    if (current && current.socketId === socketId) {
      await redisClient.del(key);
    }
  }

  /**
   * Update heartbeat
   */
  async updateHeartbeat(userId: string): Promise<void> {
    const key = `${ROUTE_PREFIX}:${userId}`;
    const exists = await redisClient.exists(key);

    if (exists) {
      await redisClient.hset(key, 'lastHeartbeat', Date.now());
      await redisClient.expire(key, 300);
    }
  }

  /**
   * Publish message to specific server
   */
  async publishToServer(
    serverId: string,
    event: string,
    data: any
  ): Promise<void> {
    const channel = `server:${serverId}`;
    const payload = {
      event,
      data,
    };

    await redisClient.publish(channel, JSON.stringify(payload));
  }

  /**
   * Subscribe to server events
   */
  async subscribeToServerEvents(
    serverId: string,
    callback: (event: string, data: any) => void
  ): Promise<void> {
    const channel = `server:${serverId}`;
    const subscriber = redisClient.duplicate();

    await subscriber.subscribe(channel);

    subscriber.on('message', (_channel, message) => {
      if (_channel === channel) {
        try {
          const payload = JSON.parse(message);
          callback(payload.event, payload.data);
        } catch (error) {
          console.error('Failed to parse server event:', error);
        }
      }
    });
  }

  /**
   * Broadcast to all servers
   */
  async broadcastToAllServers(event: string, data: any): Promise<void> {
    const channel = 'servers:broadcast';
    const payload = {
      event,
      data,
    };

    await redisClient.publish(channel, JSON.stringify(payload));
  }

  /**
   * Subscribe to broadcasts
   */
  async subscribeToBroadcasts(
    callback: (event: string, data: any) => void
  ): Promise<void> {
    const channel = 'servers:broadcast';
    const subscriber = redisClient.duplicate();

    await subscriber.subscribe(channel);

    subscriber.on('message', (_channel, message) => {
      if (_channel === channel) {
        try {
          const payload = JSON.parse(message);
          callback(payload.event, payload.data);
        } catch (error) {
          console.error('Failed to parse broadcast:', error);
        }
      }
    });
  }
}

// Types
export interface SocketInfo {
  socketId: string;
  serverId: string;
  lastHeartbeat: number;
}

// Export singleton
export const socketRouter = new SocketRouter();
