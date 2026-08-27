'use server';

import {
  encrypt as encryptSync,
  decrypt as decryptSync,
  encryptAsync,
  decryptAsync,
  encryptObject,
  decryptObject,
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

export { encryptObject, decryptObject };

// Also expose sync variants for callers that don't need async
export { encryptSync as encryptSync, decryptSync as decryptSync };
