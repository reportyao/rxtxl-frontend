import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View } from '@tarojs/components';
import { useAppStore } from '../../store';
import './index.scss';

export default function IndexPage() {
  const { loadFromStorage, isLoggedIn, user } = useAppStore();

  useEffect(() => {
    loadFromStorage();

    // 检查是否首次访问
    const hasOnboarded = Taro.getStorageSync('hasOnboarded');

    setTimeout(() => {
      if (!hasOnboarded) {
        Taro.redirectTo({ url: '/pages/onboarding/index' });
      } else if (!isLoggedIn) {
        Taro.redirectTo({ url: '/pages/login/index' });
      } else if (user && !user.hasPinSet) {
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
