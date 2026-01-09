import argon2 from 'argon2';

/**
 * Password hashing utilities using Argon2
 */
export class PasswordService {
  // Argon2 configuration (following OWASP recommendations)
  private readonly options = {
    type: argon2.argon2id, // Argon2id (recommended for password hashing)
    memoryCost: 65536, // 64 MB (memory cost in kibibytes)
    timeCost: 3, // Number of iterations
    parallelism: 4, // Number of threads/lanes
  };

  /**
   * Hash a password
   */
  async hash(password: string): Promise<string> {
    try {
      return await argon2.hash(password, this.options);
    } catch (error) {
      console.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Verify a password against a hash
   */
  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password, this.options);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Check if password needs rehash (if algorithm parameters changed)
   */
  async needsRehash(hash: string): Promise<boolean> {
    try {
      return await argon2.needsRehash(hash, this.options);
    } catch (error) {
      console.error('Password rehash check error:', error);
      return false;
    }
  }
}

// Export singleton
export const passwordService = new PasswordService();
