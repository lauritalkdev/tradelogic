import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const rawKey =
    process.env.BROKER_CREDENTIAL_ENCRYPTION_KEY?.trim();

  if (!rawKey) {
    throw new Error(
      "BROKER_CREDENTIAL_ENCRYPTION_KEY is not configured."
    );
  }

  if (!/^[a-fA-F0-9]{64}$/.test(rawKey)) {
    throw new Error(
      "BROKER_CREDENTIAL_ENCRYPTION_KEY must be a 64-character hexadecimal value."
    );
  }

  const key = Buffer.from(rawKey, "hex");

  if (key.length !== 32) {
    throw new Error(
      "BROKER_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes."
    );
  }

  return key;
}

export function encryptBrokerCredential(
  plaintext: string
) {
  if (!plaintext) {
    throw new Error("Broker credential cannot be empty.");
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptBrokerCredential(
  encryptedValue: string
) {
  const parts = encryptedValue.split(".");

  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(
      "Unsupported broker credential format."
    );
  }

  const [, ivValue, tagValue, ciphertextValue] =
    parts;

  const key = getEncryptionKey();

  const iv = Buffer.from(ivValue, "base64url");
  const authTag = Buffer.from(tagValue, "base64url");
  const ciphertext = Buffer.from(
    ciphertextValue,
    "base64url"
  );

  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}