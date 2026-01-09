import Redis from 'ioredis';
import { env } from '@/config/env.js';

/**
 * Redis client singleton
 * Manages Redis connection for pub/sub, presence, and rate limiting
 */
class RedisClient {
  private client: Redis;
  private subscriber: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          // Only reconnect when the error contains "READONLY"
          return true;
        }
        return false;
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('connect', () => {
      console.log('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
    });

    this.client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    this.client.on('close', () => {
      console.log('Redis client connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });
  }

  /**
   * Get the main Redis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Get a subscriber client (for pub/sub)
   * Creates a dedicated connection if doesn't exist
   */
  getSubscriber(): Redis {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.subscriber.on('connect', () => {
        console.log('Redis subscriber connected');
      });
    }
    return this.subscriber;
  }

  /**
   * Publish a message to a channel
   */
  async publish(channel: string, message: any): Promise<number> {
    const payload = JSON.stringify(message);
    return await this.client.publish(channel, payload);
  }

  /**
   * Subscribe to a channel
   */
  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    const subscriber = this.getSubscriber();
    await subscriber.subscribe(channel);

    subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const data = JSON.parse(message);
          callback(data);
        } catch (error) {
          console.error('Failed to parse Redis message:', error);
        }
      }
    });
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: string): Promise<void> {
    const subscriber = this.getSubscriber();
    await subscriber.unsubscribe(channel);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.client.quit();
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    console.log('Redis connections closed');
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const redisClient = new RedisClient().getClient();
export const redis = new RedisClient();

// Export types
export { Redis };
