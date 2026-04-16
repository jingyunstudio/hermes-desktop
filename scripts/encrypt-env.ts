#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ENCRYPTION_KEY = "hermes-desktop-2024-jingyun-studio-secret-key-v1";
const ALGORITHM = "aes-256-cbc";

function encrypt(text: string): string {
  const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

// 读取 .env.local
const projectRoot = path.join(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");

if (!fs.existsSync(envPath)) {
  console.log("⚠️  .env.local file not found, skipping encryption");
  process.exit(0);
}

const content = fs.readFileSync(envPath, "utf-8");
const encrypted = encrypt(content);

// 写入加密文件
const outputPath = path.join(projectRoot, ".env.local.encrypted");
fs.writeFileSync(outputPath, encrypted, "utf-8");

console.log("✅ Encrypted .env.local successfully");
console.log(`📁 Output: ${outputPath}`);
console.log(`📊 Original size: ${content.length} bytes`);
console.log(`📊 Encrypted size: ${encrypted.length} bytes`);
