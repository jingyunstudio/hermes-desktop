import crypto from "node:crypto";

// 加密密钥（硬编码在应用中，提供基础混淆）
const ENCRYPTION_KEY = "hermes-desktop-2024-jingyun-studio-secret-key-v1";
const ALGORITHM = "aes-256-cbc";

/**
 * 加密文本
 */
export function encrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  // 返回 iv:encrypted 格式
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * 解密文本
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const parts = encryptedText.split(":");

    if (parts.length !== 2) {
      throw new Error("Invalid encrypted format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[CRYPTO] Decryption failed:", error);
    throw error;
  }
}
