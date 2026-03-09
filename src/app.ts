/**
 * ===================================================================
 * 应用入口文件 (App Entry)
 * ===================================================================
 *
 * Taro应用的根组件，在应用启动时执行全局初始化逻辑。
 *
 * 初始化流程：
 * 1. 从localStorage恢复用户登录状态（token + userInfo）
 * 2. 注册Service Worker实现PWA功能（离线缓存、添加到桌面）
 *
 * 跨平台说明：
 * - H5环境：Service Worker正常注册，支持PWA
 * - 微信小程序环境：typeof window === 'undefined'，跳过SW注册
 *   （小程序有自己的离线缓存机制）
 */

import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { useAppStore } from './store';
import './app.scss';

function App({ children }: PropsWithChildren) {
  /**
   * useLaunch - Taro生命周期钩子
   * 对应小程序的 onLaunch，H5环境下在组件首次渲染时执行
   * 整个应用生命周期只执行一次
   */
  useLaunch(() => {
    console.log('人选天选论 App launched.');

    // ===== Step 1: 恢复登录状态 =====
    // 从localStorage读取之前保存的token和user信息
    // 如果存在有效数据，自动恢复登录态，用户无需重新登录
    // 注意：这里不验证token是否过期，过期会在第一次API请求时被401拦截
    useAppStore.getState().loadFromStorage();

    // ===== Step 2: 注册Service Worker（PWA） =====
    // Service Worker提供以下能力：
    // - 离线缓存：文章内容和静态资源缓存到本地，无网络也能使用
    // - 安装提示：用户可以将应用"添加到桌面"，像原生App一样打开
    // - 后台同步：离线写的日记在网络恢复后自动同步（未来功能）
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
          (registration) => {
            console.log('SW registered:', registration.scope);
          },
          (error) => {
            // SW注册失败不影响应用正常使用，只是失去离线能力
            console.log('SW registration failed:', error);
          }
        );
      });
    }
  });

  // Taro的根组件直接渲染children（即当前页面组件）
  return children;
}

export default App;
