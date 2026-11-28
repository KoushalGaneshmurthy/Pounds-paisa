/**
 * CryptoVault: Military-grade AES-GCM 256-bit client-side encryption and
 * per-user isolated storage vaults using standard Web Crypto API.
 */

export interface VaultUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

const STORAGE_USERS_DIR = 'pnd_vault_users_directory_v1';
const STORAGE_CURRENT_SESSION = 'pnd_vault_active_session_v1';

// Convert Uint8Array to Base64
function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a 256-bit AES-GCM key from a secret string and a 16-byte salt using PBKDF2 (100,000 iterations).
 */
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts arbitrary data with AES-GCM 256-bit.
 * Returns a compact string: "v1:<salt_b64>:<iv_b64>:<ciphertext_b64>"
 */
export async function encryptData<T>(data: T, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const jsonStr = JSON.stringify(data);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(jsonStr)
  );

  const ciphertextBytes = new Uint8Array(ciphertextBuffer);

  return `v1:${bufferToBase64(salt)}:${bufferToBase64(iv)}:${bufferToBase64(ciphertextBytes)}`;
}

/**
 * Decrypts an AES-GCM 256-bit encrypted string payload.
 */
export async function decryptData<T>(payload: string, secret: string): Promise<T | null> {
  if (!payload || !payload.startsWith('v1:')) return null;

  try {
    const parts = payload.split(':');
    if (parts.length !== 4) return null;

    const salt = base64ToBuffer(parts[1]);
    const iv = base64ToBuffer(parts[2]);
    const ciphertext = base64ToBuffer(parts[3]);

    const key = await deriveKey(secret, salt);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );

    const decryptedStr = new TextDecoder().decode(decryptedBuffer);
    return JSON.parse(decryptedStr) as T;
  } catch (err) {
    console.warn('CryptoVault decryption failed (invalid key or corrupted data):', err);
    return null;
  }
}

/**
 * Fast SHA-256 hex digest for storage key obfuscation and password hashing.
 */
export async function hashString(str: string, salt = ''): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${str}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* =====================================================================
 * Per-User Vault Storage (Scoped & Encrypted in LocalStorage)
 * ===================================================================== */

export function getUserVaultStorageKey(userId: string, itemType: string): string {
  // Simple deterministic key format per user ID
  const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `pnd_vault_${cleanId}_${itemType}_v1`;
}

export async function saveUserVaultItem<T>(
  userId: string,
  itemType: string,
  data: T,
  encryptionKey = 'pnd_master_vault_key'
): Promise<void> {
  try {
    const key = getUserVaultStorageKey(userId, itemType);
    const secret = `${userId}_${encryptionKey}`;
    const encrypted = await encryptData(data, secret);
    localStorage.setItem(key, encrypted);
  } catch (err) {
    console.error(`Failed to save encrypted item ${itemType} for user ${userId}:`, err);
  }
}

export async function loadUserVaultItem<T>(
  userId: string,
  itemType: string,
  defaultValue: T,
  encryptionKey = 'pnd_master_vault_key'
): Promise<T> {
  try {
    const key = getUserVaultStorageKey(userId, itemType);
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;

    const secret = `${userId}_${encryptionKey}`;
    const decrypted = await decryptData<T>(raw, secret);
    if (decrypted !== null) return decrypted;

    // Fallback: try parsing as legacy unencrypted JSON if present
    try {
      const parsed = JSON.parse(raw);
      return parsed as T;
    } catch {
      return defaultValue;
    }
  } catch (err) {
    console.error(`Failed to load encrypted item ${itemType} for user ${userId}:`, err);
    return defaultValue;
  }
}

export function clearUserVault(userId: string): void {
  const cleanId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = `pnd_vault_${cleanId}_`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

/* =====================================================================
 * Local Multi-User Accounts Directory (For Local Mode & Offline Use)
 * ===================================================================== */

function getLocalUsersDirectory(): VaultUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_DIR);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalUsersDirectory(users: VaultUser[]): void {
  try {
    localStorage.setItem(STORAGE_USERS_DIR, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users directory:', err);
  }
}

export async function registerLocalUser(
  username: string,
  email: string,
  password: string
): Promise<VaultUser> {
  const users = getLocalUsersDirectory();
  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail = (email.trim() || `${cleanUsername}@pounds-paisa.app`).toLowerCase();

  // Check unique username
  const existingUser = users.find(
    (u) => u.username.toLowerCase() === cleanUsername || u.email.toLowerCase() === cleanEmail
  );
  if (existingUser) {
    if (existingUser.username.toLowerCase() === cleanUsername) {
      throw new Error(`Username "${username}" is already taken. Please choose another.`);
    }
    throw new Error(`Email "${email}" is already registered. Please sign in instead.`);
  }

  const salt = bufferToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashString(password, salt);

  const newUser: VaultUser = {
    id: `local_usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: username.trim(),
    email: cleanEmail,
    displayName: username.trim(),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveLocalUsersDirectory(users);
  setActiveLocalSession(newUser);
  return newUser;
}

export async function authenticateLocalUser(
  identifier: string,
  password: string
): Promise<VaultUser> {
  const users = getLocalUsersDirectory();
  const cleanId = identifier.trim().toLowerCase();

  const user = users.find(
    (u) => u.username.toLowerCase() === cleanId || u.email.toLowerCase() === cleanId
  );

  if (!user) {
    throw new Error('No account found with this username or email.');
  }

  const testHash = await hashString(password, user.salt);
  if (testHash !== user.passwordHash) {
    throw new Error('Incorrect password. Please try again.');
  }

  setActiveLocalSession(user);
  return user;
}

export function getActiveLocalSession(): VaultUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as VaultUser;
  } catch {
    return null;
  }
}

export function setActiveLocalSession(user: VaultUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_CURRENT_SESSION, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_SESSION);
    }
  } catch (err) {
    console.error('Failed to set active session:', err);
  }
}
