import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, ScrollView, Input } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { deriveKey, decrypt, hashPin } from '../../utils/crypto';
import './index.scss';

const STEP_LABELS: Record<string, string> = {
  event: '河面上飘过了什么',
  emotion: '河水是什么颜色',
  thought: '水面之下的念头',
  fear: '深处的恐惧',
  desire: '真正的渴望',
  stone: '捞到的石头',
  insight: '对自己说的话',
};

interface DiaryData {
  id: string;
  diaryDate: string;
  mainStone: string;
  encryptedData: string;
  iv: string;
  createdAt: string;
}

export default function DiaryDetailPage() {
  const router = useRouter();
  const [diary, setDiary] = useState<DiaryData | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const { user, cryptoKey, setCryptoKey } = useAppStore();

  useEffect(() => {
    const id = router.params.id;
    if (id) {
      fetchDiary(id);
    }
  }, []);

  const fetchDiary = async (id: string) => {
    try {
      const res = await api.get(`/api/diaries/${id}`);
      if (res.code === 0) {
        setDiary(res.data);
        // 尝试自动解密
        if (cryptoKey) {
          await decryptDiary(res.data, cryptoKey);
        }
      }
    } catch (err) {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const decryptDiary = async (data: DiaryData, key: CryptoKey) => {
    setDecrypting(true);
    try {
      const plaintext = await decrypt(data.encryptedData, data.iv, key);
      const content = JSON.parse(plaintext);
      setDecryptedContent(content);
    } catch (err) {
      console.error('解密失败:', err);
      setCryptoKey(null);
    } finally {
      setDecrypting(false);
    }
  };

  const handlePinInput = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setPinInput(cleaned);
    setPinError('');
  };

  const handleUnlock = async () => {
    if (!diary || !user?.salt || pinInput.length !== 4) return;

    setDecrypting(true);
    setPinError('');
    try {
      const key = await deriveKey(pinInput, user.salt);
      // 先尝试解密，如果成功说明PIN正确
      const plaintext = await decrypt(diary.encryptedData, diary.iv, key);
      const content = JSON.parse(plaintext);
      setCryptoKey(key);
      setDecryptedContent(content);
      setShowPinModal(false);
      setPinInput('');
    } catch (err) {
      setPinError('密码错误，请重新输入');
      setPinInput('');
    } finally {
      setDecrypting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  if (loading) {
    return (
      <View className='diary-detail-page'>
        <View className='loading-state'>
          <Text className='loading-text'>加载中...</Text>
        </View>
      </View>
    );
  }

  if (!diary) {
    return (
      <View className='diary-detail-page'>
        <View className='error-state'>
          <Text className='error-text'>道痕未找到</Text>
        </View>
      </View>
    );
  }

  return (
    <View className='diary-detail-page'>
      <View className='page-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='page-title'>{formatDate(diary.diaryDate)}</Text>
        <View className='placeholder' />
      </View>

      <ScrollView className='detail-content' scrollY>
        {/* 主石头展示 */}
        <View className='stone-header'>
          <Text className='stone-emoji'>🪨</Text>
          <Text className='stone-main'>「{diary.mainStone}」</Text>
        </View>

        {/* 解密内容 */}
        {decryptedContent ? (
          <View className='decrypted-content animate-fadeIn'>
            {Object.entries(decryptedContent).map(([key, value]) => (
              <View key={key} className='content-section'>
                <Text className='section-label'>{STEP_LABELS[key] || key}</Text>
                <Text className='section-text'>{value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className='locked-content'>
            <View className='lock-icon'>🔒</View>
            <Text className='lock-text'>日记内容已加密</Text>
            <Text className='lock-hint'>输入日记密码查看完整道痕</Text>
            <View className='unlock-btn' onClick={() => { setShowPinModal(true); setPinInput(''); setPinError(''); }}>
              <Text className='unlock-btn-text'>
                {decrypting ? '解密中...' : '输入密码解锁'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 自定义PIN输入弹窗 */}
      {showPinModal && (
        <View className='pin-modal-overlay' onClick={() => setShowPinModal(false)}>
          <View className='pin-modal' onClick={e => e.stopPropagation()}>
            <Text className='pin-modal-title'>输入日记密码</Text>
            <Text className='pin-modal-hint'>请输入4位数字密码解锁道痕</Text>
            
            <View className='pin-dots'>
              {[0, 1, 2, 3].map(i => (
                <View key={i} className={`pin-dot ${i < pinInput.length ? 'filled' : ''}`} />
              ))}
            </View>
            
            <Input
              className='pin-input-hidden'
              type='number'
              maxlength={4}
              focus
              value={pinInput}
              onInput={e => handlePinInput(e.detail.value)}
            />

            {pinError && <Text className='pin-error'>{pinError}</Text>}

            <View className='pin-modal-actions'>
              <View className='pin-cancel' onClick={() => setShowPinModal(false)}>
                <Text className='pin-cancel-text'>取消</Text>
              </View>
              <View
                className={`pin-confirm ${pinInput.length !== 4 || decrypting ? 'disabled' : ''}`}
                onClick={handleUnlock}
              >
                <Text className='pin-confirm-text'>
                  {decrypting ? '解密中...' : '确认'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
