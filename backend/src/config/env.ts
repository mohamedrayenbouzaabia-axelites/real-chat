import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Define schema for environment variables
const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Server
  PORT: z.string().transform(Number).default('3001'),
  WS_PORT: z.string().transform(Number).default('3001'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // CORS
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Rate Limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),

  // WebSocket
  WS_MAX_PAYLOAD: z.string().transform(Number).default('16777216'), // 16MB
  WS_IDLE_TIMEOUT: z.string().transform(Number).default('60'),
});

// Validate and export
export const env = envSchema.parse(process.env);

// Type export
export type Env = z.infer<typeof envSchema>;
