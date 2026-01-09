import { createHash, randomBytes } from 'crypto';
import { db } from '@/database/connection.js';

/**
 * Public user ID generation and management
 * Uses API-key-like identifiers (e.g., K9F2-8QMX-7A1P)
 */
export class PublicIdService {
  // Base32 alphabet (excluding confusing characters: 0, O, I, 1)
  private readonly alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  private readonly idLength = 16; // Total characters
  private readonly groupSize = 4; // Characters per group

  /**
   * Generate a new public ID
   * Format: XXXX-XXXX-XXXX-XXXX (Base32, 16 chars)
   */
  generate(): string {
    // Generate random bytes
    const bytes = randomBytes(Math.ceil(this.idLength / 5));

    // Convert to Base32
    let id = '';
    let buffer = bytes[0];
    let bitsLeft = 8;

    for (let i = 0; i < this.idLength; i++) {
      if (bitsLeft < 5) {
        buffer = (buffer << 8) | bytes[Math.floor(i / 5) + 1];
        bitsLeft += 8;
      }

      const index = (buffer >> (bitsLeft - 5)) & 0x1f;
      id += this.alphabet[index];
      bitsLeft -= 5;

      // Add hyphen after each group
      if ((i + 1) % this.groupSize === 0 && i < this.idLength - 1) {
        id += '-';
      }
    }

    return id;
  }

  /**
   * Generate unique public ID (checks for collisions)
   */
  async generateUnique(): Promise<string> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const publicId = this.generate();

      // Check if ID already exists
      const exists = await this.exists(publicId);
      if (!exists) {
        return publicId;
      }

      attempts++;
      console.warn(`Public ID collision detected: ${publicId}, regenerating...`);
    }

    throw new Error('Failed to generate unique public ID after multiple attempts');
  }

  /**
   * Check if public ID exists
   */
  async exists(publicId: string): Promise<boolean> {
    const result = await db.query(
      'SELECT 1 FROM users WHERE public_id = $1',
      [publicId]
    );
    return result.rowCount > 0;
  }

  /**
   * Validate public ID format
   */
  isValid(publicId: string): boolean {
    // Format: XXXX-XXXX-XXXX-XXXX (4 groups of 4 chars, separated by hyphens)
    const regex = new RegExp(
      `^([${this.alphabet}]{4}-){3}[${this.alphabet}]{4}$`
    );
    return regex.test(publicId);
  }

  /**
   * Normalize public ID (uppercase, trim)
   */
  normalize(publicId: string): string {
    return publicId.toUpperCase().trim();
  }

  /**
   * Generate deterministic conversation ID from two user IDs
   * This ensures the same conversation ID for the same two users
   */
  deriveConversationId(userAId: string, userBId: string): string {
    // Sort IDs to ensure consistent ordering
    const sorted = [userAId, userBId].sort();
    const combined = sorted.join('');

    // Create hash
    const hash = createHash('sha256').update(combined).digest('hex');

    // Return first 32 characters as conversation ID
    return hash.substring(0, 32);
  }

  /**
   * Generate deterministic group conversation ID
   */
  deriveGroupConversationId(participantIds: string[]): string {
    // Sort IDs to ensure consistent ordering
    const sorted = [...participantIds].sort();
    const combined = sorted.join('');

    // Create hash with "group" prefix to distinguish from 1:1
    const hash = createHash('sha256')
      .update('group:' + combined)
      .digest('hex');

    // Return first 32 characters as conversation ID
    return hash.substring(0, 32);
  }

  /**
   * Generate fingerprint from public key
   * For easy verification of identity keys
   */
  deriveKeyFingerprint(publicKey: string): string {
    const hash = createHash('sha256').update(publicKey).digest('hex');
    // Return first 16 characters as fingerprint
    return hash.substring(0, 16).toUpperCase();
  }
}

// Export singleton
export const publicIdService = new PublicIdService();
