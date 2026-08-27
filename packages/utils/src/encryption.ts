import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
  salt: string;
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
}

export function encrypt(text: string): EncryptedData {
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secretKey, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    salt: salt.toString('base64'),
  };
}

export function decrypt(encryptedData: EncryptedData): string {
  const secretKey = process.env.ENCRYPTION_KEY;
  if (!secretKey) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  const encrypted = Buffer.from(encryptedData.encrypted, 'base64');
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const tag = Buffer.from(encryptedData.tag, 'base64');
  const salt = Buffer.from(encryptedData.salt, 'base64');

  const key = deriveKey(secretKey, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

// Async wrappers for backward compatibility with `apps/app` which used async signatures.
// The underlying operation is synchronous (scryptSync + cipher), so these simply wrap the sync result.
export async function encryptAsync(text: string): Promise<EncryptedData> {
  return encrypt(text);
}

export async function decryptAsync(encryptedData: EncryptedData): Promise<string> {
  return decrypt(encryptedData);
}

export async function encryptObject<T extends object>(obj: T): Promise<T> {
  const encrypted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      encrypted[key] = await encryptAsync(value);
    } else if (typeof value === 'object' && value !== null) {
      encrypted[key] = await encryptObject(value as object);
    } else {
      encrypted[key] = value;
    }
  }

  return encrypted as T;
}

export async function decryptObject<T extends object>(obj: T): Promise<T> {
  const decrypted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === 'object' && 'encrypted' in value) {
      decrypted[key] = await decryptAsync(value as EncryptedData);
    } else if (typeof value === 'object' && value !== null) {
      decrypted[key] = await decryptObject(value as object);
    } else {
      decrypted[key] = value;
    }
  }

  return decrypted as T;
}
