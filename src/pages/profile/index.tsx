/**
 * 个人中心页 - "我的"Tab
 *
 * 功能说明：
 * - 用户信息展示（头像首字母、昵称）
 * - 核心数据统计（连续天数、道痕总数、石头种类）
 * - 功能入口菜单
 * - PWA添加到桌面
 * - 强制刷新功能
 * - 退出登录
 */
import { useState, useEffect, useRef } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import './index.scss';

export default function ProfilePage() {
  const { user, logout } = useAppStore();
  const [streakDays, setStreakDays] = useState(0);
  /** PWA安装提示事件 */
  const deferredPromptRef = useRef<any>(null);
  const [totalDiaries, setTotalDiaries] = useState(0);
  const [totalStones, setTotalStones] = useState(0);

  /** 监听PWA安装提示事件 */
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      deferredPromptRef.current = e;
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handler);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handler);
      }
    };
  }, []);

  /** 每次页面显示时刷新统计数据 */
  useDidShow(() => {
    fetchStats();
  });

  /** 获取打卡和石头统计数据 */
  const fetchStats = async () => {
    try {
      const [checkinsRes, stonesRes] = await Promise.all([
        api.get('/api/diaries/checkins'),
        api.get('/api/diaries/stones'),
      ]);

      if (checkinsRes.code === 0) {
        setStreakDays(checkinsRes.data.currentStreak || 0);
        setTotalDiaries(checkinsRes.data.totalCheckins || 0);
      }

      if (stonesRes.code === 0) {
        setTotalStones(stonesRes.data.uniqueStones || 0);
      }
    } catch (err) {
      console.error('获取统计数据失败:', err);
    }
  };

  /** 退出登录 - 需二次确认 */
  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出',
      content: '退出后需要重新登录。你的日记数据已加密保存在云端，不会丢失。',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          logout();
          Taro.redirectTo({ url: '/pages/login/index' });
        }
      },
    });
  };

  /** 强制刷新 - 清理缓存并重新加载 */
  const handleForceRefresh = () => {
    Taro.showModal({
      title: '强制刷新',
      content: '将清理本地缓存并重新加载最新内容，确定继续吗？',
      confirmText: '刷新',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 清理 Service Worker 缓存
            if (typeof window !== 'undefined' && 'caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            // 注销 Service Worker
            if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map(reg => reg.unregister()));
            }
            // 清理 localStorage 中的缓存数据（保留登录状态）
            if (typeof localStorage !== 'undefined') {
              const keysToKeep = ['app-store', 'admin_auth'];
              const allKeys = Object.keys(localStorage);
              allKeys.forEach(key => {
                if (!keysToKeep.some(k => key.includes(k))) {
                  localStorage.removeItem(key);
                }
              });
            }
            Taro.showToast({ title: '缓存已清理', icon: 'success' });
            // 延迟后强制刷新页面
            setTimeout(() => {
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }, 800);
          } catch (err) {
            console.error('清理缓存失败:', err);
            // 即使清理失败也强制刷新
            if (typeof window !== 'undefined') {
              window.location.reload();
            }
          }
        }
      },
    });
  };

  /** 菜单项配置 */
  const menuItems = [
    {
      icon: '📅',
      label: '河水日历',
      hint: `连续 ${streakDays} 天`,
      onClick: () => Taro.navigateTo({ url: '/pages/calendar/index' }),
    },
    {
      icon: '📖',
      label: '道痕回看',
      hint: `${totalDiaries} 篇道痕`,
      onClick: () => Taro.navigateTo({ url: '/pages/diary-history/index' }),
    },
    {
      icon: '🪨',
      label: '石头收藏馆',
      hint: `${totalStones} 种石头`,
      onClick: () => Taro.switchTab({ url: '/pages/riverbed/index' }),
    },
    { type: 'divider' as const },
    {
      icon: '🔐',
      label: '加密说明',
      hint: 'AES-256',
      onClick: () => {
        Taro.showModal({
          title: '你的日记，只有你能看到',
          content: '我们使用银行级别的 AES-256 加密技术保护你的每一篇道痕。你设置的4位密码，会通过十万次数学运算生成一把独一无二的密钥，即使是我们的服务器也无法读取你写下的任何一个字。\n\n你的河底，只属于你自己。',
          showCancel: false,
          confirmText: '我知道了',
        });
      },
    },
    {
      icon: '📲',
      label: '添加到桌面',
      hint: '随时捞石头',
      onClick: () => {
        // 优先使用浏览器原生PWA安装API
        if (deferredPromptRef.current) {
          deferredPromptRef.current.prompt();
          deferredPromptRef.current.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === 'accepted') {
              Taro.showToast({ title: '添加成功', icon: 'success' });
            }
            deferredPromptRef.current = null;
          });
        } else {
          // 不支持PWA安装API时，显示手动操作指引
          const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
          const isWechat = typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);
          let content = '';
          if (isWechat) {
            content = '微信内无法直接添加到桌面。\n\n请点击右上角「···」→ 选择「在浏览器中打开」，然后在浏览器中添加到主屏幕。';
          } else if (isIOS) {
            content = '请点击 Safari 底部的分享按钮（方框+箭头图标），然后选择「添加到主屏幕」即可。';
          } else {
            content = '请点击浏览器右上角菜单（三个点），然后选择「添加到主屏幕」或「安装应用」即可。';
          }
          Taro.showModal({
            title: '添加到桌面',
            content,
            showCancel: false,
            confirmText: '知道了',
          });
        }
      },
    },
    { type: 'divider' as const },
    {
      icon: '💞',
      label: '分享本应用',
      hint: '',
      onClick: () => {
        Taro.showModal({
          title: '分享人选天选论',
          content: '我在用「人选天选论」记录自己每天的贪婪与恐惧，慢慢看清自己的河底。\n\n如果你也想认识自己，可以试试：\n\nrxtxl.com\n（人选天选论拼音首字母）',
          showCancel: false,
          confirmText: '复制链接',
          success: (res) => {
            if (res.confirm) {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText('https://rxtxl.com').then(() => {
                  Taro.showToast({ title: '链接已复制', icon: 'success' });
                }).catch(() => {
                  Taro.showToast({ title: 'rxtxl.com', icon: 'none', duration: 3000 });
                });
              } else {
                Taro.showToast({ title: 'rxtxl.com', icon: 'none', duration: 3000 });
              }
            }
          },
        });
      },
    },
    {
      icon: '🔄',
      label: '强制刷新',
      hint: '清理缓存',
      onClick: handleForceRefresh,
    },
    {
      icon: '💡',
      label: '关于本应用',
      hint: '',
      onClick: () => {
        Taro.showModal({
          title: '关于本应用',
          content: '本应用为路飞粉丝自发开发的产品，旨在提供工具简化粉丝实践人选天选论的过程，更好的专注实践本身。与路飞（姜蓝）本人无关，属于社区自我驱动。',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    },
  ];

  // 用户名显示：优先 nickname，其次 username，最后 '未知用户'
  const displayName = user?.nickname || user?.username || '未知用户';
  // 用户标识：有手机号则脱敏显示，否则显示 @username
  const displayId = user?.phone
    ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    : user?.username ? `@${user.username}` : '';

  return (
    <View className='profile-page'>
      {/* 用户信息卡片 */}
      <View className='user-card'>
        <View className='avatar'>
          <Text className='avatar-text'>{displayName.charAt(0).toUpperCase()}</Text>
        </View>
        <Text className='nickname'>{displayName}</Text>
        {displayId ? <Text className='phone'>{displayId}</Text> : null}
      </View>

      {/* 数据统计 */}
      <View className='stats-bar'>
        <View className='stat-item'>
          <Text className='stat-value'>{streakDays}</Text>
          <Text className='stat-label'>连续天数</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value'>{totalDiaries}</Text>
          <Text className='stat-label'>道痕总数</Text>
        </View>
        <View className='stat-divider' />
        <View className='stat-item'>
          <Text className='stat-value'>{totalStones}</Text>
          <Text className='stat-label'>石头种类</Text>
        </View>
      </View>

      {/* 菜单列表 */}
      <View className='menu-list'>
        {menuItems.map((item, index) => {
          if ('type' in item && item.type === 'divider') {
            return <View key={index} className='menu-divider' />;
          }
          return (
            <View key={index} className='menu-item' onClick={(item as any).onClick}>
              <View className='menu-left'>
                <Text className='menu-icon'>{(item as any).icon}</Text>
                <Text className='menu-label'>{(item as any).label}</Text>
              </View>
              <View className='menu-right'>
                {(item as any).hint && <Text className='menu-hint'>{(item as any).hint}</Text>}
                <Text className='menu-arrow'>›</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* 退出登录 */}
      <View className='logout-section'>
        <View className='logout-btn' onClick={handleLogout}>
          <Text className='logout-text'>退出登录</Text>
        </View>
      </View>

      {/* 版本信息 */}
      <View className='version-info'>
        <Text className='version-text'>人选天选论 v1.0.0</Text>
      </View>
    </View>
  );
}
