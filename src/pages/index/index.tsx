import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import { useAppStore } from '../../store';
import './index.scss';

export default function IndexPage() {
  const { loadFromStorage } = useAppStore();

  useEffect(() => {
    // 先从storage加载状态
    loadFromStorage();

    // 直接从storage读取，避免zustand状态更新的时序问题
    const hasOnboarded = Taro.getStorageSync('hasOnboarded');
    const token = Taro.getStorageSync('token');
    const userStr = Taro.getStorageSync('user');

    let user: any = null;
    try {
      user = userStr ? JSON.parse(userStr) : null;
    } catch (e) {
      user = null;
    }

    setTimeout(() => {
      if (!hasOnboarded) {
        Taro.redirectTo({ url: '/pages/onboarding/index' });
      } else if (!token || !user) {
        Taro.redirectTo({ url: '/pages/login/index' });
      } else if (!user.hasPinSet) {
        Taro.redirectTo({ url: '/pages/pin-setup/index' });
      } else {
        Taro.switchTab({ url: '/pages/articles/index' });
      }
    }, 100);
  }, []);

  return (
    <View className='index-page'>
      <View className='loading-container'>
        <View className='ink-drop' />
        <View className='loading-text'>人选天选论</View>
      </View>
    </View>
  );
}
