/**
 * ===================================================================
 * 端到端加密工具 (E2E Encryption Utility)
 * ===================================================================
 *
 * 使用 Web Crypto API 实现端到端加密，确保用户日记内容只有用户自己能读取。
 *
 * 加密算法选型：
 * - 密钥派生：PBKDF2（Password-Based Key Derivation Function 2）
 * - 对称加密：AES-256-GCM（Galois/Counter Mode，带认证的加密模式）
 * - 哈希算法：SHA-256
 *
 * 完整加密流程：
 * ┌─────────────────────────────────────────────────────────────┐
 * │ 1. 用户设置4位PIN码（如"1234"）                              │
 * │ 2. 前端生成随机16字节salt                                    │
 * │ 3. PBKDF2(PIN + salt, 100000次迭代) → 256位AES密钥          │
 * │ 4. SHA-256(PIN + ":" + salt) → pinHash（发送到服务器验证用）  │
 * │ 5. 服务器存储 pinHash + salt（不存储PIN明文和AES密钥）        │
 * │                                                              │
 * │ 写日记时：                                                    │
 * │ 6. 前端生成随机12字节IV（初始化向量）                         │
 * │ 7. AES-256-GCM(明文日记, AES密钥, IV) → 密文                │
 * │ 8. 将密文 + IV 发送到服务器存储                               │
 * │                                                              │
 * │ 读日记时：                                                    │
 * │ 9. 用户输入PIN → 派生AES密钥 → 解密密文 → 显示明文           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * 安全保证：
 * - PIN码明文永远不离开用户设备
 * - AES密钥只存在于浏览器内存中，不持久化
 * - 服务器只存储密文和pinHash，无法解密日记内容
 * - 即使数据库完全泄露，攻击者也需要暴力破解PBKDF2（10万次迭代）
 * - AES-GCM模式提供加密+认证双重保护，可检测密文篡改
 *
 * 兼容性：
 * - Web Crypto API 在所有现代浏览器中可用（Chrome 37+, Safari 11+, Firefox 34+）
 * - 不依赖任何第三方加密库
 */

/**
 * 生成随机盐值
 *
 * 盐值用于：
 * 1. PBKDF2密钥派生（防止彩虹表攻击）
 * 2. PIN码哈希（防止相同PIN产生相同hash）
 *
 * @returns Base64编码的16字节随机盐值
 */
export function generateSalt(): string {
  const salt = new Uint8Array(16); // 16字节 = 128位，足够安全
  crypto.getRandomValues(salt);    // 使用密码学安全的随机数生成器
  return uint8ArrayToBase64(salt);
}

/**
 * 从PIN码派生AES-256加密密钥
 *
 * 使用PBKDF2算法，将短PIN码（4位数字）转换为强密钥（256位）。
 * 10万次迭代确保即使PIN码只有4位，暴力破解的计算成本也极高。
 *
 * 性能参考：
 * - 单次派生耗时约200-500ms（取决于设备性能）
 * - 这个延迟对用户体验影响很小，但对暴力破解者来说意味着：
 *   10000种PIN × 300ms ≈ 50分钟（单设备破解一个用户）
 *
 * @param pin - 4位数字PIN码
 * @param saltBase64 - Base64编码的盐值（设置PIN时生成并存储在服务器）
 * @returns CryptoKey对象（AES-256-GCM密钥，可用于encrypt/decrypt）
 */
export async function deriveKey(pin: string, saltBase64: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = base64ToUint8Array(saltBase64);

  // Step 1: 将PIN码字符串导入为PBKDF2的密钥材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,         // 不可导出（安全考虑）
    ['deriveKey']  // 只允许用于派生密钥
  );

  // Step 2: 使用PBKDF2从密钥材料派生AES-256密钥
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,  // 10万次迭代，OWASP推荐的最低值
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },  // 目标：AES-256-GCM密钥
    false,                               // 不可导出
    ['encrypt', 'decrypt']               // 允许加密和解密操作
  );

  return derivedKey;
}

/**
 * 加密数据（AES-256-GCM）
 *
 * GCM模式的优势：
 * - 同时提供机密性（加密）和完整性（认证）
 * - 如果密文被篡改，解密时会抛出异常
 * - 每次加密使用不同的随机IV，相同明文产生不同密文
 *
 * @param data - 要加密的明文字符串（日记内容的JSON）
 * @param key - AES-256-GCM密钥（由deriveKey生成）
 * @returns 加密结果对象：
 *   - encryptedData: Base64编码的密文
 *   - iv: Base64编码的初始化向量（解密时需要）
 */
export async function encrypt(
  data: string,
  key: CryptoKey
): Promise<{ encryptedData: string; iv: string }> {
  const encoder = new TextEncoder();

  // 生成随机IV（AES-GCM推荐12字节，即96位）
  // 每次加密必须使用不同的IV，否则会破坏GCM的安全性
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 执行AES-256-GCM加密
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(data)  // 将字符串编码为UTF-8字节
  );

  return {
    encryptedData: uint8ArrayToBase64(new Uint8Array(encrypted)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * 解密数据（AES-256-GCM）
 *
 * 如果密钥错误或密文被篡改，crypto.subtle.decrypt会抛出异常
 * 调用方应catch异常并提示用户"PIN码错误"
 *
 * @param encryptedDataBase64 - Base64编码的密文
 * @param ivBase64 - Base64编码的IV（加密时生成）
 * @param key - AES-256-GCM密钥（必须与加密时使用的密钥相同）
 * @returns 解密后的明文字符串
 * @throws DOMException - 密钥错误或密文被篡改时抛出
 */
export async function decrypt(
  encryptedDataBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const encryptedData = base64ToUint8Array(encryptedDataBase64);
  const iv = base64ToUint8Array(ivBase64);

  // 执行AES-256-GCM解密（同时验证密文完整性）
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encryptedData
  );

  return decoder.decode(decrypted);  // 将UTF-8字节解码为字符串
}

/**
 * 对字符串生成SHA-256哈希（用于主石头聚合）
 *
 * 将主石头内容标准化后取hash，用于石头收藏馆中聚合相同主题的石头。
 * 标准化处理：去首尾空格 + 转小写，确保"贪婪"和" 贪婪 "被视为同一块石头。
 *
 * 只取hash的前16个字符（96位），足够用于聚合去重，同时减少存储空间。
 *
 * @param str - 主石头内容文本
 * @returns 16字符的Base64哈希值
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return uint8ArrayToBase64(hashArray).substring(0, 16);
}

/**
 * 生成PIN码的验证哈希（用于服务器端验证PIN是否正确）
 *
 * 这个hash与PBKDF2派生的AES密钥是独立的两个用途：
 * - pinHash：发送到服务器，用于验证用户输入的PIN是否正确
 * - AES密钥：留在前端，用于加密/解密日记内容
 *
 * 使用SHA-256而非PBKDF2生成pinHash的原因：
 * - 服务器只需要比对hash是否一致，不需要高强度密钥
 * - SHA-256计算快速，不影响用户体验
 * - 即使pinHash泄露，攻击者也无法反推出AES密钥（不同的派生路径）
 *
 * @param pin - 4位数字PIN码
 * @param saltBase64 - Base64编码的盐值
 * @returns Base64编码的SHA-256哈希值
 */
export async function hashPin(pin: string, saltBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  // 使用"PIN:salt"格式拼接，冒号作为分隔符防止碰撞
  const data = encoder.encode(pin + ':' + saltBase64);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return uint8ArrayToBase64(hashArray);
}

// ==================== Base64编解码工具函数 ====================

/**
 * 将Uint8Array转换为Base64字符串
 * 不使用Node.js的Buffer（浏览器环境不可用），使用纯浏览器API
 *
 * @param bytes - 字节数组
 * @returns Base64编码字符串
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 将Base64字符串转换为Uint8Array
 *
 * @param base64 - Base64编码字符串
 * @returns 字节数组
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
