import { redisClient } from './client.js';

const RATE_LIMIT_PREFIX = 'ratelimit';

/**
 * Rate limiting using Redis
 * Supports distributed rate limiting across multiple servers
 */
export class RateLimiter {
  /**
   * Check rate limit
   * Returns true if within limit, false if exceeded
   */
  async checkRateLimit(
    identifier: string,
    action: string,
    limit: number,
    window: number // Window in seconds
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `${RATE_LIMIT_PREFIX}:${identifier}:${action}`;
    const current = await redisClient.incr(key);

    // Set expiration on first request
    if (current === 1) {
      await redisClient.expire(key, window);
    }

    // Get TTL for reset time
    const ttl = await redisClient.pttl(key);
    const resetTime = Date.now() + ttl;

    const allowed = current <= limit;
    const remaining = Math.max(0, limit - current);

    return {
      allowed,
      remaining,
      resetTime,
    };
  }

  /**
   * Check rate limit and throw error if exceeded
   */
  async enforceRateLimit(
    identifier: string,
    action: string,
    limit: number,
    window: number
  ): Promise<void> {
    const result = await this.checkRateLimit(
      identifier,
      action,
      limit,
      window
    );

    if (!result.allowed) {
      throw new RateLimitError(result.resetTime);
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  async resetRateLimit(identifier: string, action: string): Promise<void> {
    const key = `${RATE_LIMIT_PREFIX}:${identifier}:${action}`;
    await redisClient.del(key);
  }

  /**
   * Get current usage
   */
  async getUsage(
    identifier: string,
    action: string
  ): Promise<number> {
    const key = `${RATE_LIMIT_PREFIX}:${identifier}:${action}`;
    const current = await redisClient.get(key);
    return current ? parseInt(current) : 0;
  }
}

// Custom error for rate limiting
export class RateLimitError extends Error {
  resetTime: number;

  constructor(resetTime: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }
}

// Export singleton
export const rateLimiter = new RateLimiter();
