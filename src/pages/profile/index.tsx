/**
 * 个人中心页 - "我的"Tab
 *
 * 功能说明：
 * - 用户信息展示（头像首字母、昵称）
 * - 核心数据统计（连续天数、道痕总数、石头种类）
 * - 功能入口菜单
 * - 修改日记密码（使用自定义数字键盘）
 * - 退出登录
 */
import { useState, useEffect, useRef } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { deriveKey, hashPin } from '../../utils/crypto';
import PinKeyboard from '../../components/PinKeyboard';
import './index.scss';

export default function ProfilePage() {
  const { user, logout, setCryptoKey } = useAppStore();
  const [streakDays, setStreakDays] = useState(0);
  /** PWA安装提示事件 */
  const deferredPromptRef = useRef<any>(null);
  const [totalDiaries, setTotalDiaries] = useState(0);
  const [totalStones, setTotalStones] = useState(0);

  // 修改密码弹窗状态
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changePinStep, setChangePinStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [changePinLoading, setChangePinLoading] = useState(false);
  const [pinShake, setPinShake] = useState(false);

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

  /** 打开修改密码弹窗 */
  const openChangePinModal = () => {
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setChangePinStep('old');
    setPinShake(false);
    setShowChangePinModal(true);
  };

  const getCurrentPinValue = () => {
    switch (changePinStep) {
      case 'old': return oldPin;
      case 'new': return newPin;
      case 'confirm': return confirmPin;
    }
  };

  const handlePinChange = (val: string) => {
    switch (changePinStep) {
      case 'old': setOldPin(val); break;
      case 'new': setNewPin(val); break;
      case 'confirm': setConfirmPin(val); break;
    }
  };

  /** 每步 PIN 输入完成后的处理 */
  const handlePinComplete = async (val: string) => {
    if (changePinStep === 'old') {
      // 验证旧密码
      try {
        const oldPinHash = await hashPin(val, user?.salt || '');
        const res = await api.post('/api/auth/verify-pin', { pinHash: oldPinHash });
        if (res.code === 0) {
          setOldPin(val);
          setTimeout(() => {
            setChangePinStep('new');
            setNewPin('');
          }, 200);
        } else {
          setPinShake(true);
          Taro.showToast({ title: '原密码错误', icon: 'none' });
          setTimeout(() => {
            setPinShake(false);
            setOldPin('');
          }, 600);
        }
      } catch (err) {
        Taro.showToast({ title: '验证失败', icon: 'none' });
        setOldPin('');
      }
    } else if (changePinStep === 'new') {
      setNewPin(val);
      setTimeout(() => {
        setChangePinStep('confirm');
        setConfirmPin('');
      }, 200);
    } else if (changePinStep === 'confirm') {
      if (val === newPin) {
        // 密码一致，弹出警告
        Taro.showModal({
          title: '重要提醒',
          content: '修改密码后，之前用旧密码加密的日记将无法解密查看。\n\n这是端到端加密的安全机制，即使是我们也无法恢复。\n\n确定要修改密码吗？',
          confirmText: '确定修改',
          cancelText: '取消',
          confirmColor: '#C0392B',
          success: async (modalRes) => {
            if (!modalRes.confirm) {
              setConfirmPin('');
              return;
            }
            await doChangePin(val);
          },
        });
      } else {
        setPinShake(true);
        Taro.showToast({ title: '两次密码不一致', icon: 'none' });
        setTimeout(() => {
          setPinShake(false);
          setConfirmPin('');
        }, 600);
      }
    }
  };

  /** 执行密码修改 */
  const doChangePin = async (confirmedNewPin: string) => {
    setChangePinLoading(true);
    try {
      const newPinHash = await hashPin(confirmedNewPin, user?.salt || '');
      const res = await api.post('/api/auth/set-pin', {
        pinHash: newPinHash,
        salt: user?.salt || '',
      });
      if (res.code === 0) {
        const newKey = await deriveKey(confirmedNewPin, user?.salt || '');
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
  };

  /** 获取修改密码弹窗的标题和描述 */
  const getChangePinInfo = () => {
    switch (changePinStep) {
      case 'old': return { title: '请输入原密码', desc: '验证你的身份' };
      case 'new': return { title: '请输入新密码', desc: '设置4位数字密码' };
      case 'confirm': return { title: '请再次输入新密码', desc: '确认你的新密码' };
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
          content: '🪨 我在用「人选天选论」记录自己每天的贪婪与恐惧，慢慢看清自己的河底。\n\n如果你也想认识自己，可以扫码下载：\n\nrxtxl.com\n（人选天选论拼音首字母）',
          showCancel: false,
          confirmText: '复制链接',
          success: (res) => {
            if (res.confirm) {
              // 尝试复制到剪贴板
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

  const changePinInfo = getChangePinInfo();

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

      {/* 修改密码弹窗 - 使用自定义数字键盘 */}
      {showChangePinModal && (
        <View className='pin-change-overlay' onClick={() => setShowChangePinModal(false)}>
          <View className='pin-change-modal' onClick={e => e.stopPropagation()}>
            <Text className='pin-change-title'>{changePinInfo.title}</Text>
            <Text className='pin-change-desc'>{changePinInfo.desc}</Text>
            <PinKeyboard
              value={getCurrentPinValue()}
              onChange={handlePinChange}
              onComplete={handlePinComplete}
              shake={pinShake}
            />
            {changePinLoading && (
              <Text className='pin-change-loading'>处理中...</Text>
            )}
            <View className='pin-change-cancel' onClick={() => setShowChangePinModal(false)}>
              <Text className='pin-change-cancel-text'>取消</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
