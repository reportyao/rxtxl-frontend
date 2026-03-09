import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import './index.scss';

export default function ProfilePage() {
  const { user, logout } = useAppStore();
  const [streakDays, setStreakDays] = useState(0);
  const [totalDiaries, setTotalDiaries] = useState(0);
  const [totalStones, setTotalStones] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

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
    {
      icon: '🔐',
      label: '加密说明',
      hint: 'AES-256 端到端加密',
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
      icon: '📤',
      label: '添加到桌面',
      hint: '随时打开捞石头',
      onClick: () => {
        Taro.showModal({
          title: '添加到桌面',
          content: '在浏览器菜单中选择"添加到主屏幕"，即可像App一样从桌面直接打开。\n\niPhone: 点击底部分享按钮 → 添加到主屏幕\nAndroid: 点击右上角菜单 → 添加到主屏幕',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    },
  ];

  return (
    <View className='profile-page'>
      {/* 用户信息卡片 */}
      <View className='user-card'>
        <View className='avatar'>
          <Text className='avatar-text'>{user?.nickname?.charAt(0) || '?'}</Text>
        </View>
        <Text className='nickname'>{user?.nickname || '未知用户'}</Text>
        <Text className='phone'>{user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</Text>
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
        {menuItems.map((item, index) => (
          <View key={index} className='menu-item' onClick={item.onClick}>
            <View className='menu-left'>
              <Text className='menu-icon'>{item.icon}</Text>
              <Text className='menu-label'>{item.label}</Text>
            </View>
            <View className='menu-right'>
              <Text className='menu-hint'>{item.hint}</Text>
              <Text className='menu-arrow'>›</Text>
            </View>
          </View>
        ))}
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
