/**
 * 端到端加密工具
 * 使用 Web Crypto API 实现 PBKDF2 + AES-256-GCM
 * 
 * 流程：
 * 1. 用户输入4位PIN码
 * 2. 通过PBKDF2（10万次迭代 + 随机盐）派生256位AES密钥
 * 3. 使用AES-256-GCM加密日记内容
 * 4. 服务器只存储密文，无法解密
 */

/**
 * 生成随机盐值（Base64编码）
 */
export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return uint8ArrayToBase64(salt);
}

/**
 * 从PIN码派生AES密钥
 * @param pin 4位数字PIN码
 * @param saltBase64 Base64编码的盐值
 * @returns CryptoKey对象
 */
export async function deriveKey(pin: string, saltBase64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = base64ToUint8Array(saltBase64);

  // 将PIN转换为密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // 使用PBKDF2派生AES-256密钥（10万次迭代）
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * 加密数据
 * @param data 要加密的明文字符串
 * @param key AES密钥
 * @returns { encryptedData: Base64密文, iv: Base64初始化向量 }
 */
export async function encrypt(data: string, key: CryptoKey): Promise<{ encryptedData: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM推荐12字节IV

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(data)
  );

  return {
    encryptedData: uint8ArrayToBase64(new Uint8Array(encrypted)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * 解密数据
 * @param encryptedDataBase64 Base64编码的密文
 * @param ivBase64 Base64编码的IV
 * @param key AES密钥
 * @returns 解密后的明文字符串
 */
export async function decrypt(encryptedDataBase64: string, ivBase64: string, key: CryptoKey): Promise<string> {
  const decoder = new TextDecoder();
  const encryptedData = base64ToUint8Array(encryptedDataBase64);
  const iv = base64ToUint8Array(ivBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );

  return decoder.decode(decrypted);
}

/**
 * 对字符串生成简单hash（用于主石头聚合）
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return uint8ArrayToBase64(hashArray).substring(0, 16); // 取前16位
}

// ==================== 工具函数 ====================

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
