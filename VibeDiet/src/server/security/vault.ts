import crypto from 'node:crypto';
import { env } from '../../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getVaultMasterKey(): Buffer {
  const secret = process.env.VAULT_SECRET || env.ADMIN_UIDS || 'vibediet-zero-trust-vault-key-seed';
  return crypto.createHash('sha256').update(secret).digest();
}

export interface EncryptedData {
  iv: string; // hex
  tag: string; // hex
  ciphertext: string; // hex
}

/**
 * Encrypts a sensitive string (e.g. dynamic API key) at rest using AES-256-GCM.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const key = getVaultMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  // Format: iv:tag:ciphertext
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

/**
 * Decrypts a vault ciphertext using AES-256-GCM and verifies authenticity.
 */
export function decryptSecret(cipherBundle: string): string {
  if (!cipherBundle || !cipherBundle.includes(':')) return cipherBundle;
  const parts = cipherBundle.split(':');
  if (parts.length !== 3) return cipherBundle;

  try {
    const key = getVaultMasterKey();
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // If decryption fails, return safe empty string
    return '';
  }
}
