import { useState } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Input } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import './index.scss';

/** 当前模式：登录 or 注册 */
type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAppStore();

  // ===== 表单校验 =====
  const isUsernameValid = username.trim().length >= 2;
  const isPasswordValid = password.length >= 6;
  const isConfirmValid = password === confirmPassword;

  const canSubmitLogin = isUsernameValid && isPasswordValid;
  const canSubmitRegister = isUsernameValid && isPasswordValid && isConfirmValid && confirmPassword.length > 0;

  // ===== 切换模式时清空表单 =====
  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  // ===== 登录 =====
  const handleLogin = async () => {
    if (!canSubmitLogin || loading) return;

    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', {
        username: username.trim(),
        password,
      });

      if (res.code === 0) {
        const { token, user } = res.data;
        setAuth(token, user);

        if (!user.hasPinSet) {
          Taro.redirectTo({ url: '/pages/pin-setup/index' });
        } else {
          Taro.switchTab({ url: '/pages/articles/index' });
        }
      } else {
        Taro.showToast({ title: res.message || '登录失败', icon: 'none' });
      }
    } catch (err) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  // ===== 注册 =====
  const handleRegister = async () => {
    if (!canSubmitRegister || loading) return;

    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', {
        username: username.trim(),
        password,
        confirmPassword,
      });

      if (res.code === 0) {
        const { token, user } = res.data;
        setAuth(token, user);
        Taro.showToast({ title: '注册成功', icon: 'success' });

        setTimeout(() => {
          Taro.redirectTo({ url: '/pages/pin-setup/index' });
        }, 800);
      } else {
        Taro.showToast({ title: res.message || '注册失败', icon: 'none' });
      }
    } catch (err) {
      Taro.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  const canSubmit = isLogin ? canSubmitLogin : canSubmitRegister;

  return (
    <View className='login-page'>
      {/* 头部 */}
      <View className='login-header'>
        <Text className='title'>人选天选论</Text>
        <Text className='subtitle'>认识自己的河流</Text>
      </View>

      {/* 模式切换 Tab */}
      <View className='mode-tabs'>
        <View
          className={`mode-tab ${isLogin ? 'active' : ''}`}
          onClick={() => switchMode('login')}
        >
          <Text className='mode-tab-text'>登录</Text>
        </View>
        <View
          className={`mode-tab ${!isLogin ? 'active' : ''}`}
          onClick={() => switchMode('register')}
        >
          <Text className='mode-tab-text'>注册</Text>
        </View>
      </View>

      {/* 表单 */}
      <View className='login-form'>
        {/* 用户名 */}
        <View className='form-item'>
          <Text className='form-label'>用户名</Text>
          <View className='input-row'>
            <Input
              className='form-input'
              type='text'
              maxlength={20}
              placeholder='请输入用户名（2-20位）'
              placeholderClass='placeholder'
              value={username}
              onInput={e => setUsername(e.detail.value)}
            />
          </View>
        </View>

        {/* 密码 */}
        <View className='form-item'>
          <Text className='form-label'>密码</Text>
          <View className='input-row'>
            <Input
              className='form-input'
              type='text'
              password
              maxlength={50}
              placeholder='请输入密码（至少6位）'
              placeholderClass='placeholder'
              value={password}
              onInput={e => setPassword(e.detail.value)}
            />
          </View>
        </View>

        {/* 确认密码（仅注册时显示） */}
        {!isLogin && (
          <View className='form-item'>
            <Text className='form-label'>确认密码</Text>
            <View className={`input-row ${confirmPassword.length > 0 && !isConfirmValid ? 'input-error' : ''}`}>
              <Input
                className='form-input'
                type='text'
                password
                maxlength={50}
                placeholder='请再次输入密码'
                placeholderClass='placeholder'
                value={confirmPassword}
                onInput={e => setConfirmPassword(e.detail.value)}
              />
            </View>
            {confirmPassword.length > 0 && !isConfirmValid && (
              <Text className='error-tip'>两次密码输入不一致</Text>
            )}
          </View>
        )}

        {/* 提交按钮 */}
        <View
          className={`login-btn ${(!canSubmit || loading) ? 'disabled' : ''}`}
          onClick={isLogin ? handleLogin : handleRegister}
        >
          <Text className='login-btn-text'>
            {loading
              ? (isLogin ? '登录中...' : '注册中...')
              : (isLogin ? '进入河流' : '创建账号')}
          </Text>
        </View>
      </View>

      <View className='login-footer'>
        <Text className='footer-text'>登录即表示同意《用户协议》和《隐私政策》</Text>
      </View>
    </View>
  );
}
