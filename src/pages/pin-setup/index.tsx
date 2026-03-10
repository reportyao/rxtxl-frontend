import { useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { generateSalt, deriveKey, hashPin } from '../../utils/crypto';
import PinKeyboard from '../../components/PinKeyboard';
import './index.scss';

type Step = 'intro' | 'input' | 'confirm' | 'warning';

export default function PinSetupPage() {
  const [step, setStep] = useState<Step>('intro');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const { setUser, setCryptoKey } = useAppStore();

  const handlePinChange = (val: string) => {
    setPin(val);
  };

  const handlePinComplete = (_val: string) => {
    setTimeout(() => setStep('confirm'), 200);
  };

  const handleConfirmChange = (val: string) => {
    setConfirmPin(val);
  };

  const handleConfirmComplete = (val: string) => {
    if (val === pin) {
      setTimeout(() => setStep('warning'), 200);
    } else {
      setShake(true);
      Taro.showToast({ title: '两次输入不一致，请重新输入', icon: 'none' });
      setTimeout(() => {
        setShake(false);
        setConfirmPin('');
      }, 600);
    }
  };

  const handleReset = () => {
    setPin('');
    setConfirmPin('');
    setShake(false);
    setStep('input');
  };

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
          <PinKeyboard
            value={pin}
            onChange={handlePinChange}
            onComplete={handlePinComplete}
          />
        </View>
      )}

      {/* 步骤3：确认PIN */}
      {step === 'confirm' && (
        <View className='step-content animate-fadeIn'>
          <Text className='step-title'>再次输入确认</Text>
          <Text className='step-hint'>请确保你记住了这4位数字</Text>
          <PinKeyboard
            value={confirmPin}
            onChange={handleConfirmChange}
            onComplete={handleConfirmComplete}
            shake={shake}
          />
          <View className='back-link' onClick={handleReset}>
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
