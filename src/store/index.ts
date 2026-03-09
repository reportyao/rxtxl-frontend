import { create } from 'zustand';
import Taro from '@tarojs/taro';

interface UserInfo {
  id: string;
  phone: string;
  nickname: string;
  avatar: string | null;
  hasPinSet: boolean;
  streakDays: number;
  salt?: string;
}

interface AppState {
  // 用户状态
  token: string | null;
  user: UserInfo | null;
  isLoggedIn: boolean;
  cryptoKey: CryptoKey | null;

  // 操作
  setAuth: (token: string, user: UserInfo) => void;
  setUser: (user: Partial<UserInfo>) => void;
  setCryptoKey: (key: CryptoKey | null) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  token: null,
  user: null,
  isLoggedIn: false,
  cryptoKey: null,

  setAuth: (token: string, user: UserInfo) => {
    Taro.setStorageSync('token', token);
    Taro.setStorageSync('user', JSON.stringify(user));
    set({ token, user, isLoggedIn: true });
  },

  setUser: (userData: Partial<UserInfo>) => {
    const currentUser = get().user;
    if (currentUser) {
      const updated = { ...currentUser, ...userData };
      Taro.setStorageSync('user', JSON.stringify(updated));
      set({ user: updated });
    }
  },

  setCryptoKey: (key: CryptoKey | null) => {
    set({ cryptoKey: key });
  },

  logout: () => {
    Taro.removeStorageSync('token');
    Taro.removeStorageSync('user');
    set({ token: null, user: null, isLoggedIn: false, cryptoKey: null });
  },

  loadFromStorage: () => {
    try {
      const token = Taro.getStorageSync('token');
      const userStr = Taro.getStorageSync('user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ token, user, isLoggedIn: true });
      }
    } catch (e) {
      console.error('加载存储数据失败:', e);
    }
  },
}));
