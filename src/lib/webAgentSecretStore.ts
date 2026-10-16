/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Browser-secure Agent credential storage using WebCrypto (AES-256-GCM)
 * and IndexedDB with non-extractable CryptoKeys and Authenticated Additional Data (AAD).
 */

const DB_NAME = "anonymous_liquid_agent_vault";
const DB_VERSION = 1;
const KEY_STORE_NAME = "crypto_keys";
const SECRET_STORE_NAME = "encrypted_secrets";

const FORMAT_VERSION = "v1";
const AAD_PREFIX = "anonymous_liquid_agent_secret";

interface StoredSecretRecord {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
  version: string;
}

function getSubtleCrypto(): SubtleCrypto {
  if (
    typeof crypto === "undefined" ||
    !crypto.subtle ||
    typeof crypto.getRandomValues !== "function"
  ) {
    throw new Error(
      "WebCrypto is unavailable: secure CryptoKey operations require crypto.subtle and crypto.getRandomValues"
    );
  }
  return crypto.subtle;
}

function buildAAD(recordId: string): Uint8Array {
  return new TextEncoder().encode(`${AAD_PREFIX}:${FORMAT_VERSION}:${recordId}`);
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      return reject(
        new Error(
          "IndexedDB is unavailable: secure agent credential storage requires IndexedDB"
        )
      );
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(SECRET_STORE_NAME)) {
        db.createObjectStore(SECRET_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB agent vault"));
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function waitForTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

/**
 * Persists an Agent credential using AES-256-GCM encryption with a non-extractable
 * CryptoKey and random 12-byte IV persisted directly in IndexedDB.
 */
export async function setAgentSecret(
  recordId: string,
  plaintext: string
): Promise<void> {
  const subtle = getSubtleCrypto();

  // Generate a non-extractable AES-256-GCM CryptoKey
  const key = await subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // extractable = false (SECURITY REQUIREMENT)
    ["encrypt", "decrypt"]
  );

  // 12-byte random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = buildAAD(recordId);
  const encodedPlaintext = new TextEncoder().encode(plaintext);

  let ciphertext: ArrayBuffer;
  try {
    ciphertext = await subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv as BufferSource,
        additionalData: aad as BufferSource,
      },
      key,
      encodedPlaintext
    );
  } finally {
    encodedPlaintext.fill(0);
  }

  const db = await openDB();
  const tx = db.transaction([KEY_STORE_NAME, SECRET_STORE_NAME], "readwrite");
  const keyStore = tx.objectStore(KEY_STORE_NAME);
  const secretStore = tx.objectStore(SECRET_STORE_NAME);

  // Persist the non-extractable CryptoKey object in IndexedDB
  keyStore.put(key, recordId);

  // Persist the encrypted payload bound to recordId and version in IndexedDB
  const secretRecord: StoredSecretRecord = {
    iv,
    ciphertext,
    version: FORMAT_VERSION,
  };
  secretStore.put(secretRecord, recordId);

  await waitForTransaction(tx);
}

/**
 * Retrieves and decrypts an Agent credential from IndexedDB using the stored
 * non-extractable CryptoKey and authenticating the additional data (AAD).
 */
export async function getAgentSecret(
  recordId: string
): Promise<string | null> {
  const subtle = getSubtleCrypto();
  const db = await openDB();
  const tx = db.transaction([KEY_STORE_NAME, SECRET_STORE_NAME], "readonly");
  const keyStore = tx.objectStore(KEY_STORE_NAME);
  const secretStore = tx.objectStore(SECRET_STORE_NAME);

  const [key, storedRecord] = await Promise.all([
    promisifyRequest<CryptoKey | undefined>(keyStore.get(recordId)),
    promisifyRequest<StoredSecretRecord | undefined>(
      secretStore.get(recordId)
    ),
  ]);

  // If BOTH records genuinely do not exist: return null
  if (!key && !storedRecord) {
    return null;
  }

  // If only ONE exists: THROW an integrity/storage error
  if (!key || !storedRecord) {
    throw new Error(
      `Agent secret store integrity error: partial record found for "${recordId}" (key: ${Boolean(key)}, ciphertext: ${Boolean(storedRecord)})`
    );
  }

  // If stored version or payload is invalid: THROW
  if (
    storedRecord.version !== FORMAT_VERSION ||
    !storedRecord.ciphertext ||
    !storedRecord.iv ||
    storedRecord.iv.length !== 12
  ) {
    throw new Error(
      `Agent secret store integrity error: invalid secret payload format or version for "${recordId}"`
    );
  }

  // Decrypt and authenticate AAD (throws on AES-GCM decrypt/authentication failure)
  const aad = buildAAD(recordId);

  const decryptedBuffer = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: storedRecord.iv as BufferSource,
      additionalData: aad as BufferSource,
    },
    key,
    storedRecord.ciphertext
  );

  // Clear temporary plaintext byte buffers where possible
  const decryptedBytes = new Uint8Array(decryptedBuffer);
  try {
    return new TextDecoder().decode(decryptedBytes);
  } finally {
    decryptedBytes.fill(0);
  }
}

/**
 * Deletes both the encrypted secret and its associated CryptoKey material
 * from IndexedDB when an Agent credential is removed.
 */
export async function deleteAgentSecret(recordId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([KEY_STORE_NAME, SECRET_STORE_NAME], "readwrite");
  const keyStore = tx.objectStore(KEY_STORE_NAME);
  const secretStore = tx.objectStore(SECRET_STORE_NAME);

  keyStore.delete(recordId);
  secretStore.delete(recordId);

  await waitForTransaction(tx);
}
