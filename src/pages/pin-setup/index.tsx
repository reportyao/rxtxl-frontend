import { useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Input } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { generateSalt, deriveKey, hashPin } from '../../utils/crypto';
import './index.scss';

type Step = 'intro' | 'input' | 'confirm' | 'warning';

export default function PinSetupPage() {
  const [step, setStep] = useState<Step>('intro');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser, setCryptoKey } = useAppStore();

  // 处理PIN输入
  const handlePinInput = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
    if (cleaned.length === 4) {
      setTimeout(() => setStep('confirm'), 300);
    }
  };

  // 处理确认PIN输入
  const handleConfirmInput = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setConfirmPin(cleaned);
    if (cleaned.length === 4) {
      if (cleaned === pin) {
        setStep('warning');
      } else {
        Taro.showToast({ title: '两次输入不一致，请重新输入', icon: 'none' });
        setConfirmPin('');
      }
    }
  };

  // 确认设置PIN
  const handleConfirmSetup = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const salt = generateSalt();
      const key = await deriveKey(pin, salt);
      const pinHash = await hashPin(pin, salt);

      const res = await api.post('/api/auth/set-pin', { pinHash, salt });
      if (res.code === 0) {
        setCryptoKey(key);
        setUser({ hasPinSet: true, salt });
        Taro.showToast({ title: '设置成功', icon: 'success' });
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/articles/index' });
        }, 1000);
      } else {
        Taro.showToast({ title: res.message, icon: 'none' });
      }
    } catch (err) {
      Taro.showToast({ title: '设置失败，请重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='pin-setup-page'>
      {/* 步骤1：加密介绍 */}
      {step === 'intro' && (
        <View className='step-content animate-fadeIn'>
          <View className='lock-icon'>🔐</View>
          <Text className='step-title'>你的日记，只有你能看到</Text>
          <View className='security-desc'>
            <Text className='desc-text'>
              我们使用银行级别的 AES-256 加密技术保护你的每一篇道痕。你设置的4位密码，会通过十万次数学运算生成一把独一无二的密钥，即使是我们的服务器也无法读取你写下的任何一个字。
            </Text>
            <Text className='desc-highlight'>你的河底，只属于你自己。</Text>
          </View>
          <View className='next-btn' onClick={() => setStep('input')}>
            <Text className='next-btn-text'>设置日记密码</Text>
          </View>
        </View>
      )}

      {/* 步骤2：输入PIN */}
      {step === 'input' && (
        <View className='step-content animate-fadeIn'>
          <Text className='step-title'>设置4位数字密码</Text>
          <Text className='step-hint'>这把钥匙将守护你的河底</Text>
          <View className='pin-dots'>
            {[0, 1, 2, 3].map(i => (
              <View key={i} className={`pin-dot ${i < pin.length ? 'filled' : ''}`} />
            ))}
          </View>
          <Input
            className='pin-input-hidden'
            type='number'
            maxlength={4}
            focus
            value={pin}
            onInput={e => handlePinInput(e.detail.value)}
          />
        </View>
      )}

      {/* 步骤3：确认PIN */}
      {step === 'confirm' && (
        <View className='step-content animate-fadeIn'>
          <Text className='step-title'>再次输入确认</Text>
          <Text className='step-hint'>请确保你记住了这4位数字</Text>
          <View className='pin-dots'>
            {[0, 1, 2, 3].map(i => (
              <View key={i} className={`pin-dot ${i < confirmPin.length ? 'filled' : ''}`} />
            ))}
          </View>
          <Input
            className='pin-input-hidden'
            type='number'
            maxlength={4}
            focus
            value={confirmPin}
            onInput={e => handleConfirmInput(e.detail.value)}
          />
          <View className='back-link' onClick={() => { setPin(''); setConfirmPin(''); setStep('input'); }}>
            <Text className='back-link-text'>重新设置</Text>
          </View>
        </View>
      )}

      {/* 步骤4：忘记密码警告 */}
      {step === 'warning' && (
        <View className='step-content animate-fadeIn'>
          <View className='warning-icon'>⚠️</View>
          <Text className='warning-title'>请牢记这把钥匙</Text>
          <View className='warning-box'>
            <Text className='warning-text'>
              这四个数字，是你河底的钥匙。忘记它，所有捞出来的石头都将沉回河底，无法找回。我们无法帮你重置，因为我们也看不到你的密码。
            </Text>
          </View>
          <View
            className={`confirm-btn ${loading ? 'disabled' : ''}`}
            onClick={handleConfirmSetup}
          >
            <Text className='confirm-btn-text'>
              {loading ? '设置中...' : '我已牢记，开始捞石头'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
