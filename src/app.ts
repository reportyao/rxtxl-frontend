import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { useAppStore } from './store';
import './app.scss';

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('人选天选论 App launched.');

    // 从本地存储恢复登录状态
    useAppStore.getState().loadFromStorage();

    // 注册 Service Worker（PWA）
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('SW registered:', registration.scope);
          },
          (error) => {
            console.log('SW registration failed:', error);
          }
        );
      });
    }
  });

  return children;
}

export default App;
