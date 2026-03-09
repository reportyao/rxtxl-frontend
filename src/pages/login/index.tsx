import { useState, useRef } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Input } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import './index.scss';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { setAuth } = useAppStore();

  const isPhoneValid = /^1[3-9]\d{9}$/.test(phone);
  const isCodeValid = code.length === 6;

  // 发送验证码
  const handleSendCode = async () => {
    if (!isPhoneValid || countdown > 0 || codeSending) return;

    setCodeSending(true);
    try {
      const res = await api.post('/api/auth/send-code', { phone });
      if (res.code === 0) {
        Taro.showToast({ title: '验证码已发送', icon: 'success' });

        // 开发模式下自动填入验证码
        if (res.data?.devCode) {
          setCode(res.data.devCode);
        }

        // 开始倒计时
        setCountdown(60);
        timerRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        Taro.showToast({ title: res.message, icon: 'none' });
      }
    } catch (err) {
      Taro.showToast({ title: '发送失败，请重试', icon: 'none' });
    } finally {
      setCodeSending(false);
    }
  };

  // 登录
  const handleLogin = async () => {
    if (!isPhoneValid || !isCodeValid || loading) return;

    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { phone, code });
      if (res.code === 0) {
        const { token, user, isNewUser } = res.data;
        setAuth(token, user);

        if (!user.hasPinSet) {
          Taro.redirectTo({ url: '/pages/pin-setup/index' });
        } else {
          Taro.switchTab({ url: '/pages/articles/index' });
        }
      } else {
        Taro.showToast({ title: res.message, icon: 'none' });
      }
    } catch (err) {
      Taro.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='login-page'>
      <View className='login-header'>
        <Text className='title'>人选天选论</Text>
        <Text className='subtitle'>认识自己的河流</Text>
      </View>

      <View className='login-form'>
        {/* 手机号输入 */}
        <View className='form-item'>
          <Text className='form-label'>手机号</Text>
          <View className='input-row'>
            <Input
              className='form-input'
              type='number'
              maxlength={11}
              placeholder='请输入手机号'
              placeholderClass='placeholder'
              value={phone}
              onInput={e => setPhone(e.detail.value)}
            />
          </View>
        </View>

        {/* 验证码输入 */}
        <View className='form-item'>
          <Text className='form-label'>验证码</Text>
          <View className='input-row'>
            <Input
              className='form-input code-input'
              type='number'
              maxlength={6}
              placeholder='请输入验证码'
              placeholderClass='placeholder'
              value={code}
              onInput={e => setCode(e.detail.value)}
            />
            <View
              className={`send-code-btn ${(!isPhoneValid || countdown > 0) ? 'disabled' : ''}`}
              onClick={handleSendCode}
            >
              <Text className='send-code-text'>
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Text>
            </View>
          </View>
        </View>

        {/* 登录按钮 */}
        <View
          className={`login-btn ${(!isPhoneValid || !isCodeValid || loading) ? 'disabled' : ''}`}
          onClick={handleLogin}
        >
          <Text className='login-btn-text'>
            {loading ? '登录中...' : '进入河流'}
          </Text>
        </View>
      </View>

      <View className='login-footer'>
        <Text className='footer-text'>登录即表示同意《用户协议》和《隐私政策》</Text>
      </View>
    </View>
  );
}
