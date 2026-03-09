/**
 * 个人中心页 - "我的"Tab
 *
 * 功能说明：
 * - 用户信息展示（头像首字母、昵称、脱敏手机号）
 * - 核心数据统计（连续天数、道痕总数、石头种类）
 * - 功能入口菜单：
 *   - 河水日历（打卡记录）
 *   - 道痕回看（日记历史）
 *   - 石头收藏馆
 *   - 修改日记密码
 *   - 加密说明
 *   - 添加到桌面（PWA引导）
 *   - 关于我们
 * - 退出登录
 *
 * 数据来源：
 * - GET /api/diaries/checkins - 打卡统计
 * - GET /api/diaries/stones - 石头统计
 */
import { useState, useEffect } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text, Input } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { deriveKey, hashPin } from '../../utils/crypto';
import './index.scss';

export default function ProfilePage() {
  const { user, logout, setCryptoKey } = useAppStore();
  const [streakDays, setStreakDays] = useState(0);
  const [totalDiaries, setTotalDiaries] = useState(0);
  const [totalStones, setTotalStones] = useState(0);

  // 修改密码弹窗状态
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changePinStep, setChangePinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [changePinLoading, setChangePinLoading] = useState(false);

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

  /** 打开修改密码弹窗 */
  const openChangePinModal = () => {
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setChangePinStep('old');
    setShowChangePinModal(true);
  };

  /**
   * 修改日记密码流程：
   * 1. 输入旧密码验证
   * 2. 输入新密码
   * 3. 确认新密码
   * 4. 调用API更新
   */
  const handleChangePinNext = async () => {
    if (changePinStep === 'old') {
      if (oldPin.length !== 4) return;
      // 验证旧密码
      try {
        const oldPinHash = await hashPin(oldPin, user?.salt || '');
        const res = await api.post('/api/auth/verify-pin', { pinHash: oldPinHash });
        if (res.code === 0) {
          setChangePinStep('new');
        } else {
          Taro.showToast({ title: '原密码错误', icon: 'none' });
          setOldPin('');
        }
      } catch (err) {
        Taro.showToast({ title: '验证失败', icon: 'none' });
      }
    } else if (changePinStep === 'new') {
      if (newPin.length !== 4) return;
      setChangePinStep('confirm');
    } else if (changePinStep === 'confirm') {
      if (confirmPin.length !== 4) return;
      if (newPin !== confirmPin) {
        Taro.showToast({ title: '两次密码不一致', icon: 'none' });
        setConfirmPin('');
        return;
      }

      // 提交新密码
      setChangePinLoading(true);
      try {
        const newPinHash = await hashPin(newPin, user?.salt || '');
        const res = await api.post('/api/auth/reset-pin', {
          pinHash: newPinHash,
          salt: user?.salt || '',
        });
        if (res.code === 0) {
          // 更新本地加密密钥
          const newKey = await deriveKey(newPin, user?.salt || '');
          setCryptoKey(newKey);
          setShowChangePinModal(false);
          Taro.showToast({ title: '密码修改成功', icon: 'success' });
        } else {
          Taro.showToast({ title: res.message || '修改失败', icon: 'none' });
        }
      } catch (err) {
        Taro.showToast({ title: '修改失败', icon: 'none' });
      } finally {
        setChangePinLoading(false);
      }
    }
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
      icon: '🔑',
      label: '修改日记密码',
      hint: '',
      onClick: openChangePinModal,
    },
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
        Taro.showModal({
          title: '添加到桌面',
          content: '在浏览器菜单中选择"添加到主屏幕"，即可像App一样从桌面直接打开。\n\niPhone: 点击底部分享按钮 → 添加到主屏幕\nAndroid: 点击右上角菜单 → 添加到主屏幕',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    },
    {
      icon: '💡',
      label: '关于人选天选论',
      hint: '',
      onClick: () => {
        Taro.showModal({
          title: '关于人选天选论',
          content: '「人选天选论」是一套关于认识自己的方法论。\n\n通过每天"捞石头"——记录和觉察自己的贪婪与恐惧，逐步看清自己河底的石头，建立稳定的人生结构。\n\n作者：姜蓝\n\n愿你在河流中找到自己。',
          showCancel: false,
          confirmText: '知道了',
        });
      },
    },
  ];

  /** 获取修改密码弹窗的标题和描述 */
  const getChangePinInfo = () => {
    switch (changePinStep) {
      case 'old': return { title: '请输入原密码', desc: '验证你的身份' };
      case 'new': return { title: '请输入新密码', desc: '设置4位数字密码' };
      case 'confirm': return { title: '请再次输入新密码', desc: '确认你的新密码' };
    }
  };

  const getCurrentPinValue = () => {
    switch (changePinStep) {
      case 'old': return oldPin;
      case 'new': return newPin;
      case 'confirm': return confirmPin;
    }
  };

  const handlePinInput = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 4);
    switch (changePinStep) {
      case 'old': setOldPin(clean); break;
      case 'new': setNewPin(clean); break;
      case 'confirm': setConfirmPin(clean); break;
    }
  };

  const changePinInfo = getChangePinInfo();

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

      {/* 修改密码弹窗 */}
      {showChangePinModal && (
        <View className='pin-change-overlay' onClick={() => setShowChangePinModal(false)}>
          <View className='pin-change-modal' onClick={e => e.stopPropagation()}>
            <Text className='pin-change-title'>{changePinInfo.title}</Text>
            <Text className='pin-change-desc'>{changePinInfo.desc}</Text>
            <View className='pin-dots'>
              {[0, 1, 2, 3].map(i => (
                <View key={i} className={`pin-dot ${i < getCurrentPinValue().length ? 'filled' : ''}`} />
              ))}
            </View>
            <Input
              className='pin-input-hidden'
              type='number'
              maxlength={4}
              focus
              value={getCurrentPinValue()}
              onInput={e => handlePinInput(e.detail.value)}
            />
            <View className='pin-change-actions'>
              <View className='pin-change-btn cancel' onClick={() => setShowChangePinModal(false)}>
                <Text className='pin-change-btn-text'>取消</Text>
              </View>
              <View
                className={`pin-change-btn confirm ${getCurrentPinValue().length !== 4 || changePinLoading ? 'disabled' : ''}`}
                onClick={handleChangePinNext}
              >
                <Text className='pin-change-btn-text'>
                  {changePinLoading ? '处理中...' : (changePinStep === 'confirm' ? '确认修改' : '下一步')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
