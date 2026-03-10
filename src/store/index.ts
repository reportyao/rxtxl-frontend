/**
 * ===================================================================
 * 全局状态管理 (Zustand Store)
 * ===================================================================
 *
 * 使用Zustand管理全局应用状态，替代Redux的轻量级方案。
 *
 * 状态持久化策略：
 * - token和user信息通过Taro.setStorageSync持久化到本地存储
 * - H5环境下对应localStorage，小程序环境下对应wx.setStorageSync
 * - cryptoKey（AES加密密钥）不持久化，每次需要时由PIN码重新派生
 *   （安全考虑：密钥不应持久化存储，防止被恶意读取）
 *
 * 状态流转：
 * 1. 应用启动 → loadFromStorage() 从本地存储恢复登录态
 * 2. 用户登录 → setAuth() 保存token和用户信息
 * 3. 设置PIN → setUser({ hasPinSet: true }) 更新PIN状态
 * 4. 写日记前 → setCryptoKey() 设置AES密钥（由PIN派生）
 * 5. 退出登录 → logout() 清除所有状态和本地存储
 *
 * 使用方式（在React组件中）：
 *   const { token, user, isLoggedIn } = useAppStore();
 *   const setAuth = useAppStore(state => state.setAuth);
 */

import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { CryptoKey } from '../utils/crypto';

/**
 * 用户信息类型定义
 *
 * @property id - 用户唯一ID（UUID格式）
 * @property phone - 手机号（完整号码，前端展示时自行脱敏）
 * @property nickname - 昵称（默认"用户XXXX"，X为手机号后4位）
 * @property avatar - 头像URL（当前版本暂未使用，预留字段）
 * @property hasPinSet - 是否已设置日记加密PIN码
 * @property streakDays - 当前连续打卡天数
 * @property salt - PIN码的加密盐值（用于派生AES密钥）
 */
interface UserInfo {
  id: string;
  phone: string;
  username?: string;
  nickname: string;
  avatar: string | null;
  hasPinSet: boolean;
  streakDays: number;
  salt?: string;
}

/**
 * 全局状态类型定义
 */
interface AppState {
  // ===== 状态字段 =====
  /** JWT认证令牌，null表示未登录 */
  token: string | null;
  /** 当前登录用户信息 */
  user: UserInfo | null;
  /** 是否已登录（token和user都存在时为true） */
  isLoggedIn: boolean;
  /** AES-256加密密钥（由PIN码通过PBKDF2派生，不持久化，类型为CryptoJS.lib.WordArray） */
  cryptoKey: CryptoKey | null;

  // ===== 操作方法 =====
  /** 设置登录态（登录成功后调用） */
  setAuth: (token: string, user: UserInfo) => void;
  /** 部分更新用户信息（如设置PIN后更新hasPinSet） */
  setUser: (user: Partial<UserInfo>) => void;
  /** 设置AES加密密钥（验证PIN后调用） */
  setCryptoKey: (key: CryptoKey | null) => void;
  /** 退出登录（清除所有状态和本地存储） */
  logout: () => void;
  /** 从本地存储恢复登录态（应用启动时调用） */
  loadFromStorage: () => void;
}

/**
 * 创建全局状态Store
 *
 * Zustand的create函数接收一个回调，参数为(set, get)：
 * - set: 更新状态的函数，类似setState
 * - get: 获取当前状态的函数
 */
export const useAppStore = create<AppState>((set, get) => ({
  // ===== 初始状态 =====
  token: null,
  user: null,
  isLoggedIn: false,
  cryptoKey: null,

  /**
   * 设置登录态
   * 登录成功后调用，同时将token和user持久化到本地存储
   *
   * @param token - JWT令牌
   * @param user - 用户信息对象
   */
  setAuth: (token: string, user: UserInfo) => {
    // 持久化到本地存储（H5环境下为localStorage）
    Taro.setStorageSync('token', token);
    Taro.setStorageSync('user', JSON.stringify(user));
    // 更新Zustand状态
    set({ token, user, isLoggedIn: true });
  },

  /**
   * 部分更新用户信息
   * 使用场景：设置PIN后更新hasPinSet、修改昵称等
   * 采用合并策略：只更新传入的字段，保留其他字段不变
   *
   * @param userData - 需要更新的用户信息字段
   */
  setUser: (userData: Partial<UserInfo>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updated = { ...currentUser, ...userData };
      Taro.setStorageSync('user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  /**
   * 设置AES加密密钥
   * 用户验证PIN码后，前端通过PBKDF2从PIN派生AES-256密钥
   * 该密钥用于加密/解密日记内容
   *
   * 安全说明：
   * - CryptoKey对象存在于内存中，不会被序列化到本地存储
   * - 页面刷新或应用重启后密钥丢失，需要用户重新输入PIN
   * - 这是故意的安全设计，防止密钥被恶意读取
   *
   * @param key - AES-256-GCM密钥，或null（清除密钥）
   */
  setCryptoKey: (key: CryptoKey | null) => {
    set({ cryptoKey: key });
  },

  /**
   * 退出登录
   * 清除所有状态和本地存储数据
   * 调用后用户需要重新登录
   */
  logout: () => {
    Taro.removeStorageSync('token');
    Taro.removeStorageSync('user');
    set({ token: null, user: null, isLoggedIn: false, cryptoKey: null });
  },

  /**
   * 从本地存储恢复登录态
   * 应用启动时在app.ts中调用
   *
   * 流程：
   * 1. 尝试从localStorage读取token和user
   * 2. 如果都存在，恢复登录状态
   * 3. 如果读取失败（数据损坏等），静默处理，用户需重新登录
   *
   * 注意：此方法不验证token是否过期
   * token过期会在第一次API请求时被后端拒绝，前端收到401后跳转登录页
   */
  loadFromStorage: () => {
    try {
      const token = Taro.getStorageSync('token');
      const userStr = Taro.getStorageSync('user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ token, user, isLoggedIn: true });
      }
    } catch (e) {
      // 本地存储数据损坏，静默处理
      console.error('加载存储数据失败:', e);
    }
  },
}));
