import pg from 'pg';
const { Pool } = pg;
import { env } from '@/config/env.js';

/**
 * PostgreSQL connection pool
 * Manages database connections for the application
 */
class Database {
  private pool: any;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    // Log connection status in development
    if (env.NODE_ENV === 'development') {
      console.log('Database pool created');
    }
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const res = await this.pool.query(text, params);
      const duration = Date.now() - start;

      if (env.NODE_ENV === 'development') {
        console.log('Executed query', { text, duration, rows: res.rowCount });
      }

      return res;
    } catch (error) {
      console.error('Database query error', { text, error });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<any> {
    const client = await this.pool.connect();
    return client;
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1');
      return result.rowCount === 1;
    } catch (error) {
      console.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    await this.pool.end();
    console.log('Database pool closed');
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

// Export singleton instance
export const db = new Database();
