'use server';

import {
  decryptAsync,
  decryptObject,
  decrypt as decryptSync,
  encryptAsync,
  encryptObject,
  encrypt as encryptSync,
  type EncryptedData,
} from '@gideon-defender/utils/encryption';

// Re-export with async signatures for backward compatibility with existing callers
// that `await encrypt()` / `await decrypt()`. The underlying implementation is now
// shared from @gideon-defender/utils/encryption.
export type { EncryptedData };

export async function encrypt(text: string): Promise<EncryptedData> {
  return encryptAsync(text);
}

export async function decrypt(encryptedData: EncryptedData): Promise<string> {
  return decryptAsync(encryptedData);
}

export { decryptObject, encryptObject };

// Also expose sync variants for callers that don't need async
export { decryptSync as decryptSync, encryptSync as encryptSync };
