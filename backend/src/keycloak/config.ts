import NodeCache from 'node-cache';
import kc from 'keycloak-connect';
import type { FastifyRequest, FastifyReply } from 'fastify';

// Memory cache for Keycloak tokens
const memoryCache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 60 * 60 }); // 1 hour

// Keycloak configuration
const keycloakConfig = {
  realm: process.env.KEYCLOAK_REALM || 'realchat',
  'auth-server-url': process.env.KEYCLOAK_URL || 'http://localhost:8080',
  'ssl-required': 'external',
  resource: process.env.KEYCLOAK_CLIENT_ID || 'realchat-backend',
  'confidential-port': 0,
  'bearer-only': true,
  'policy-enforcer': false,
  'public-client': false,
};

// Initialize Keycloak
export const keycloak = new kc(memoryCache, keycloakConfig);

/**
 * Keycloak authentication middleware for Fastify
 * Validates JWT tokens from Keycloak and extracts user information
 */
export async function keycloakMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No token provided',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Validate the access token
    const isAuthenticated = await keycloak.grantManager.validateAccessToken(token);

    if (!isAuthenticated) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Get user info from Keycloak
    const userInfo = await keycloak.grantManager.userInfo(token);

    // Attach user to request
    (request as any).user = {
      userId: userInfo.sub,
      username: userInfo.preferred_username || userInfo.username,
      email: userInfo.email,
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      emailVerified: userInfo.email_verified,
      keycloakId: userInfo.sub,
      ...userInfo,
    };
  } catch (error) {
    console.error('Keycloak authentication error:', error);
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication failed',
    });
  }
}

/**
 * Get Keycloak public key for token verification
 */
export async function getKeycloakPublicKey(): Promise<string> {
  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'realchat'}/protocol/openid-connect/certs`
    );
    const certs = await response.json();
    return certs.keys[0].n; // Return the modulus (public key)
  } catch (error) {
    console.error('Failed to fetch Keycloak public key:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'realchat'}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.KEYCLOAK_CLIENT_ID || 'realchat-backend',
          client_secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
          code,
          redirect_uri: redirectUri,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string) {
  try {
    const response = await fetch(
      `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'realchat'}/protocol/openid-connect/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.KEYCLOAK_CLIENT_ID || 'realchat-backend',
          client_secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
          refresh_token: refreshToken,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Logout from Keycloak
 */
export async function logoutFromKeycloak(refreshToken: string) {
  try {
    await fetch(
      `${process.env.KEYCLOAK_URL || 'http://localhost:8080'}/realms/${process.env.KEYCLOAK_REALM || 'realchat'}/protocol/openid-connect/logout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.KEYCLOAK_CLIENT_ID || 'realchat-backend',
          client_secret: process.env.KEYCLOAK_CLIENT_SECRET || '',
          refresh_token: refreshToken,
        }),
      }
    );
  } catch (error) {
    console.error('Keycloak logout error:', error);
    throw error;
  }
}

export default keycloak;
