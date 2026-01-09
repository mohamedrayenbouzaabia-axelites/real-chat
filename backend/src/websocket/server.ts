import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import { wsAuthenticate } from '@/middleware/auth.js';
import { wsManager } from './manager.js';
import { presenceManager } from '@/redis/presence.js';
import { redis } from '@/redis/client.js';
import { env } from '@/config/env.js';
import type { WebSocketData, WSMessage } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Register WebSocket routes with Fastify
 */
export async function registerWebSocketRoutes(fastify: FastifyInstance) {
  // Register WebSocket plugin
  await fastify.register(websocket);

  // WebSocket route
  fastify.register(async function (fastify) {
    fastify.get(
      '/ws',
      {
        websocket: true,
      },
      async (connection, req) => {
        // Extract token from query params
        const url = req.url;
        const queryParams = new URLSearchParams(url.split('?')[1] || '');
        const token = queryParams.get('token');

        if (!token) {
          connection.close(1008, 'No token provided');
          return;
        }

        try {
          // Verify JWT token
          const user = await wsAuthenticate(token);

          const socketId = uuidv4();

          // Attach user data to socket
          const data: WebSocketData = {
            userId: user.userId,
            username: user.username,
            socketId,
            serverId: wsManager.getServerId(),
            connectedAt: Date.now(),
          };

          // Register connection (connection object IS the socket in Fastify websocket)
          await wsManager.addConnection(socketId, data, connection);

          // Send welcome message
          sendMessage(connection, {
            type: 'presence',
            payload: {
              userId: data.userId,
              status: 'online',
              timestamp: Date.now(),
            },
            timestamp: Date.now(),
          });

          console.log(`WebSocket opened: ${socketId} for user ${data.userId}`);

          // Handle incoming messages
          connection.on('message', async (message) => {
            try {
              const messageStr = message.toString();
              const msg = JSON.parse(messageStr) as WSMessage;
              await handleWebSocketMessage(connection, msg, data);
            } catch (error) {
              console.error('Error handling WebSocket message:', error);

              // Send error response
              sendMessage(connection, {
                type: 'error',
                payload: {
                  code: 'MESSAGE_ERROR',
                  message: 'Failed to process message',
                },
                timestamp: Date.now(),
              });
            }
          });

          // Handle connection close
          connection.on('close', async () => {
            await wsManager.removeConnection(socketId);
            console.log(`WebSocket closed: ${socketId}`);
          });

          // Handle errors
          connection.on('error', (error) => {
            console.error('WebSocket error:', error);
          });
        } catch (error) {
          console.error('WebSocket authentication failed:', error);
          connection.close(1008, 'Authentication failed');
        }
      }
    );
  });
}

/**
 * Handle WebSocket message routing
 */
async function handleWebSocketMessage(
  socket: any,
  msg: WSMessage,
  data: WebSocketData
): Promise<void> {
  switch (msg.type) {
    case 'ping':
      // Respond with pong
      sendMessage(socket, {
        type: 'pong',
        payload: {},
        timestamp: Date.now(),
      });
      break;

    case 'subscribe':
      // Subscribe to conversation
      if (msg.payload.conversationId) {
        wsManager.subscribeToConversation(
          data.socketId,
          msg.payload.conversationId
        );

        // Update presence
        await presenceManager.refreshSession(data.userId);
      }
      break;

    case 'unsubscribe':
      // Unsubscribe from conversation
      if (msg.payload.conversationId) {
        wsManager.unsubscribeFromConversation(
          data.socketId,
          msg.payload.conversationId
        );
      }
      break;

    case 'typing':
      // Broadcast typing indicator to conversation
      if (msg.payload.conversationId) {
        const typingMsg: WSMessage = {
          type: 'typing',
          payload: {
            conversationId: msg.payload.conversationId,
            userId: data.userId,
            isTyping: msg.payload.isTyping,
          },
          timestamp: Date.now(),
        };

        wsManager.sendToConversation(
          msg.payload.conversationId,
          typingMsg,
          data.userId // Exclude sender
        );
      }
      break;

    // TODO: Handle more message types
    // case 'message':
    //   await handleChatMessage(socket, msg, data);
    //   break;

    default:
      sendMessage(socket, {
        type: 'error',
        payload: {
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Unknown message type: ${msg.type}`,
        },
        timestamp: Date.now(),
      });
  }
}

/**
 * Send message to WebSocket client
 */
function sendMessage(socket: any, message: WSMessage): void {
  const messageStr = JSON.stringify(message);
  socket.send(messageStr);
}

/**
 * Start WebSocket server
 */
export async function startWebSocketServer() {
  // Subscribe to cross-server events for horizontal scaling
  await subscribeToServerEvents();

  // Subscribe to presence changes
  await subscribeToPresenceChanges();

  console.log(`🔌 WebSocket server registered`);
}

/**
 * Subscribe to cross-server events for horizontal scaling
 */
async function subscribeToServerEvents() {
  const subscriber = redis.getClient().duplicate();

  await subscriber.subscribe(`server:${wsManager.getServerId()}`);
  await subscriber.subscribe('servers:broadcast');

  subscriber.on('message', (channel, message) => {
    try {
      const payload = JSON.parse(message);

      // Handle server events
      if (channel === `server:${wsManager.getServerId()}`) {
        // Event for this server
        console.log('Received server event:', payload);
      } else if (channel === 'servers:broadcast') {
        // Broadcast to all servers
        console.log('Received broadcast:', payload);
      }
    } catch (error) {
      console.error('Error parsing server event:', error);
    }
  });
}

/**
 * Subscribe to presence changes
 */
async function subscribeToPresenceChanges() {
  await presenceManager.subscribeToPresenceChanges((data) => {
    // Broadcast presence change to all connected clients
    const message: WSMessage = {
      type: 'presence',
      payload: {
        userId: data.userId,
        status: data.status,
        timestamp: data.timestamp,
      },
      timestamp: Date.now(),
    };

    wsManager.broadcast(message);
  });
}
