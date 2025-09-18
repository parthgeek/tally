import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// AES-GCM encryption for access tokens
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/**
 * Derives a key from the environment encryption key
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ENCRYPTION_KEY');
  if (!keyString) {
    throw new Error('ENCRYPTION_KEY environment variable is required for token encryption');
  }

  // Enhanced validation for encryption key
  if (keyString.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters long for secure encryption');
  }

  // Use the first 32 bytes of the key string (or pad if shorter)
  const keyBytes = new TextEncoder().encode(keyString.padEnd(32, '0').slice(0, 32));
  
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an access token using AES-GCM
 */
export async function encryptAccessToken(token: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    
    // Generate a random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encryptedData), iv.length);
    
    // Return base64 encoded result
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt access token');
  }
}

/**
 * Decrypts an access token using AES-GCM
 */
export async function decryptAccessToken(encryptedToken: string): Promise<string> {
  try {
    const key = await getEncryptionKey();
    
    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedToken).split('').map(char => char.charCodeAt(0))
    );
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encryptedData
    );
    
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt access token');
  }
}

/**
 * Fallback function for legacy base64 encoded tokens
 * TODO: Remove this after all tokens are re-encrypted
 */
export function isLegacyEncoding(token: string): boolean {
  try {
    // Legacy tokens are simple base64 without the additional structure
    const decoded = atob(token);
    return decoded.startsWith('access-') || decoded.includes('public-'); // Common Plaid token prefixes
  } catch {
    return false;
  }
}

/**
 * Decrypts a token, handling both new and legacy formats
 * Legacy fallback can be disabled in production via ALLOW_LEGACY_TOKEN_FALLBACK
 */
export async function decryptAccessTokenWithFallback(encryptedToken: string): Promise<string> {
  const allowLegacyFallback = Deno.env.get('ALLOW_LEGACY_TOKEN_FALLBACK') === 'true';
  
  if (isLegacyEncoding(encryptedToken)) {
    if (!allowLegacyFallback) {
      throw new Error('Legacy token format detected but fallback is disabled in production');
    }
    console.warn('Using legacy base64 decoding for access token - consider re-encrypting');
    return atob(encryptedToken);
  }
  
  return await decryptAccessToken(encryptedToken);
}

/**
 * Strict decrypt function that only handles AES-GCM tokens
 * Use in production to ensure no legacy tokens are accepted
 */
export async function decryptAccessTokenStrict(encryptedToken: string): Promise<string> {
  if (isLegacyEncoding(encryptedToken)) {
    throw new Error('Legacy token format not supported in strict mode');
  }
  
  return await decryptAccessToken(encryptedToken);
}