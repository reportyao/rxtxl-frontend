import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { deriveKey, decrypt } from '../../utils/crypto';
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
      Taro.showToast({ title: '密码错误，请重新输入', icon: 'none' });
    } finally {
      setDecrypting(false);
    }
  };

  const handleUnlock = async () => {
    if (!diary || !user?.salt) return;

    const pin = window.prompt?.('请输入4位日记密码');
    if (pin && pin.length === 4) {
      try {
        const key = await deriveKey(pin, user.salt);
        setCryptoKey(key);
        await decryptDiary(diary, key);
      } catch (err) {
        Taro.showToast({ title: '密码错误', icon: 'none' });
      }
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
            <View className='unlock-btn' onClick={handleUnlock}>
              <Text className='unlock-btn-text'>
                {decrypting ? '解密中...' : '输入密码解锁'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
