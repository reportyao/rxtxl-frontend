/**
 * ===================================================================
 * 端到端加密工具 (E2E Encryption Utility)
 * ===================================================================
 *
 * 使用 crypto-js 实现，兼容 HTTP 和 HTTPS 环境。
 * （Web Crypto API 的 crypto.subtle 仅在 HTTPS 或 localhost 下可用）
 *
 * 加密算法：
 * - 密钥派生：PBKDF2（100000次迭代）
 * - 对称加密：AES-256-CBC
 * - 哈希算法：SHA-256
 */

import CryptoJS from 'crypto-js';

/** 内存中存储的 CryptoKey 替代类型（使用 WordArray） */
export type CryptoKey = CryptoJS.lib.WordArray;

/**
 * 生成随机盐值
 * @returns Base64编码的16字节随机盐值
 */
export function generateSalt(): string {
  const salt = CryptoJS.lib.WordArray.random(16);
  return CryptoJS.enc.Base64.stringify(salt);
}

/**
 * 从PIN码派生AES-256加密密钥（PBKDF2，100000次迭代）
 * @param pin - 4位数字PIN码
 * @param saltBase64 - Base64编码的盐值
 * @returns 派生的密钥（WordArray）
 */
export async function deriveKey(pin: string, saltBase64: string): Promise<CryptoKey> {
  const salt = CryptoJS.enc.Base64.parse(saltBase64);
  const key = CryptoJS.PBKDF2(pin, salt, {
    keySize: 256 / 32,   // 256位 = 8个32位word
    iterations: 100000,
    hasher: CryptoJS.algo.SHA256,
  });
  return key;
}

/**
 * 加密数据（AES-256-CBC）
 * @param data - 要加密的明文字符串
 * @param key - 由 deriveKey 生成的密钥
 * @returns 加密结果：{ encryptedData: Base64密文, iv: Base64初始化向量 }
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ encryptedData: string; iv: string }> {
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(data, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    encryptedData: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
    iv: CryptoJS.enc.Base64.stringify(iv),
  };
}

/**
 * 解密数据（AES-256-CBC）
 * @param encryptedDataBase64 - Base64编码的密文
 * @param ivBase64 - Base64编码的IV
 * @param key - AES密钥
 * @returns 解密后的明文字符串
 */
export async function decrypt(
  encryptedDataBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const iv = CryptoJS.enc.Base64.parse(ivBase64);
  const ciphertext = CryptoJS.enc.Base64.parse(encryptedDataBase64);
  const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext });
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const result = decrypted.toString(CryptoJS.enc.Utf8);
  if (!result) {
    throw new Error('解密失败：密钥错误或数据已损坏');
  }
  return result;
}

/**
 * 对字符串生成SHA-256哈希（用于主石头聚合）
 * @param str - 主石头内容文本
 * @returns 16字符的Base64哈希值
 */
export async function hashString(str: string): Promise<string> {
  const hash = CryptoJS.SHA256(str.trim().toLowerCase());
  return hash.toString(CryptoJS.enc.Base64).substring(0, 16);
}

/**
 * 生成PIN码的验证哈希（用于服务器端验证）
 * @param pin - 4位数字PIN码
 * @param saltBase64 - Base64编码的盐值
 * @returns Base64编码的SHA-256哈希值
 */
export async function hashPin(pin: string, saltBase64: string): Promise<string> {
  const data = pin + ':' + saltBase64;
  const hash = CryptoJS.SHA256(data);
  return hash.toString(CryptoJS.enc.Base64);
}
