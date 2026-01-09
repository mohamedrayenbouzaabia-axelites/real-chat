import jwt from 'jsonwebtoken';
import { env } from '@/config/env.js';

// Payload interface for JWT tokens
export interface JWTPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

// Token pair interface
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * JWT authentication utilities
 */
export class JWTService {
  /**
   * Generate access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      algorithm: 'HS256',
    });
  }

  /**
   * Generate token pair (access + refresh)
   */
  generateTokenPair(payload: Omit<JWTPayload, 'iat' | 'exp'>): TokenPair {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Calculate expiration time in seconds
    const expiresIn = this.parseExpiration(env.JWT_EXPIRES_IN);

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, env.JWT_REFRESH_SECRET) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | null {
    const decoded = jwt.decode(token);
    return decoded as JWTPayload | null;
  }

  /**
   * Parse expiration string to seconds
   */
  private parseExpiration(expiration: string): number {
    // Format: "7d", "24h", "60m", etc.
    const match = expiration.match(/^(\d+)([dhms])$/);
    if (!match) {
      // Default to seconds if no suffix
      return parseInt(expiration) || 3600;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      d: 86400, // days
      h: 3600, // hours
      m: 60, // minutes
      s: 1, // seconds
    };

    return value * (multipliers[unit] || 1);
  }

  /**
   * Get token expiration date
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    return Date.now() >= decoded.exp * 1000;
  }
}

// Export singleton
export const jwtService = new JWTService();
