/**
 * 道痕详情页 - 查看单条日记的完整内容
 *
 * 功能说明：
 * - 显示日记日期和主石头
 * - 需要输入PIN密码解密查看完整内容
 * - 使用PinKeyboard组件替代隐藏Input，解决移动端密码输入兼容性问题
 * - [v1.2] 增加分享功能，可生成精美长图分享
 */
import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { deriveKey, decrypt } from '../../utils/crypto';
import type { CryptoKey } from '../../utils/crypto';
import PinKeyboard from '../../components/PinKeyboard';
import './index.scss';

/**
 * STEP_LABELS的key与日记页的GUIDE_STEPS id匹配
 */
const STEP_LABELS: Record<string, string> = {
  event: '今天，什么事让你的河面起了波澜',
  reaction: '那一刻，你的第一反应是什么',
  greed: '你其实想得到什么',
  fear: '你其实在害怕什么',
  excuse: '你给这件事找了什么理由',
  stone: '今天捞出来的石头',
  choice: '明天再遇到，你准备怎么选',
};

/** 步骤顺序（确保渲染顺序一致） */
const STEP_ORDER = ['event', 'reaction', 'greed', 'fear', 'excuse', 'stone', 'choice'];

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
  const [pinShake, setPinShake] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);
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

  const decryptDiary = async (data: DiaryData, key: CryptoKey) => { // eslint-disable-line @typescript-eslint/no-explicit-any
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

  /** PIN输入完成自动解锁 */
  const handlePinComplete = async (val: string) => {
    if (!diary) return;

    setDecrypting(true);
    setPinError('');
    try {
      // 如果 user.salt 不存在（旧登录态），先从 /api/auth/me 获取
      let salt = user?.salt;
      if (!salt) {
        try {
          const meRes = await api.get('/api/auth/me');
          if (meRes.code === 0 && meRes.data?.salt) {
            salt = meRes.data.salt;
            // 更新 store 中的 user，补充 salt
            useAppStore.getState().setUser({ salt: meRes.data.salt });
          }
        } catch (_e) {
          // ignore
        }
      }
      if (!salt) {
        setPinError('无法获取加密盐值，请重新登录');
        setPinInput('');
        return;
      }
      const key = await deriveKey(val, salt);
      const plaintext = await decrypt(diary.encryptedData, diary.iv, key);
      const content = JSON.parse(plaintext);
      setCryptoKey(key);
      setDecryptedContent(content);
      setShowPinModal(false);
      setPinInput('');
    } catch (err) {
      setPinError('密码错误，请重新输入');
      setPinInput('');
      setPinShake(true);
      setTimeout(() => setPinShake(false), 500);
    } finally {
      setDecrypting(false);
    }
  };

  /**
   * 解析日记日期字符串（本地时区）
   */
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${year}年${month}月${day}日`;
  };

  /**
   * 生成分享长图
   * 使用Canvas将日记内容渲染为精美长图
   */
  const handleShare = async () => {
    if (!diary || !decryptedContent) {
      Taro.showToast({ title: '请先解锁日记内容', icon: 'none' });
      return;
    }

    setGeneratingShare(true);
    try {
      // 使用DOM方式生成分享图片
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const dpr = 2; // 高清
      const canvasWidth = 750;
      const padding = 60;
      const contentWidth = canvasWidth - padding * 2;

      // 预计算内容高度
      ctx.font = '28px serif';
      let totalHeight = 0;
      totalHeight += 120; // 顶部留白
      totalHeight += 60;  // 日期
      totalHeight += 80;  // 主石头
      totalHeight += 40;  // 分隔线

      const entries = STEP_ORDER
        .filter(key => decryptedContent[key])
        .map(key => ({ key, label: STEP_LABELS[key] || key, value: decryptedContent[key] }));

      for (const entry of entries) {
        totalHeight += 50; // label
        // 估算文本行数
        const lines = Math.ceil(ctx.measureText(entry.value).width / (contentWidth - 20));
        totalHeight += Math.max(lines, 1) * 42 + 30; // 内容 + 间距
      }

      totalHeight += 120; // 底部二维码区域
      totalHeight += 80;  // 底部留白

      canvas.width = canvasWidth * dpr;
      canvas.height = totalHeight * dpr;
      ctx.scale(dpr, dpr);

      // 背景
      ctx.fillStyle = '#F7F4ED';
      ctx.fillRect(0, 0, canvasWidth, totalHeight);

      // 顶部装饰线
      ctx.strokeStyle = '#D4CFC4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, 80);
      ctx.lineTo(canvasWidth - padding, 80);
      ctx.stroke();

      let y = 120;

      // 日期
      ctx.fillStyle = '#8A8A8A';
      ctx.font = '24px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatDate(diary.diaryDate), canvasWidth / 2, y);
      y += 60;

      // 主石头
      ctx.fillStyle = '#8B6F4E';
      ctx.font = 'bold 32px "Noto Serif SC", serif';
      ctx.fillText(`「${diary.mainStone}」`, canvasWidth / 2, y);
      y += 50;

      // 分隔线
      ctx.strokeStyle = '#D4CFC4';
      ctx.beginPath();
      ctx.moveTo(canvasWidth / 2 - 60, y);
      ctx.lineTo(canvasWidth / 2 + 60, y);
      ctx.stroke();
      y += 40;

      // 内容区域
      ctx.textAlign = 'left';
      for (const entry of entries) {
        // 标签
        ctx.fillStyle = '#B8B0A8';
        ctx.font = '22px "Noto Sans SC", sans-serif';
        ctx.fillText(entry.label, padding, y);
        y += 36;

        // 内容 - 自动换行
        ctx.fillStyle = '#2C2C2C';
        ctx.font = '26px "Noto Serif SC", serif';
        const words = entry.value.split('');
        let line = '';
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i];
          const metrics = ctx.measureText(testLine);
          if (metrics.width > contentWidth && i > 0) {
            ctx.fillText(line, padding + 10, y);
            line = words[i];
            y += 38;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, padding + 10, y);
        y += 50;
      }

      // 底部分隔线
      y += 20;
      ctx.strokeStyle = '#D4CFC4';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(canvasWidth - padding, y);
      ctx.stroke();
      y += 30;

      // 底部品牌信息
      ctx.fillStyle = '#B8B0A8';
      ctx.font = '20px "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('人选天选论 · rxtxl.com', canvasWidth / 2, y);
      y += 30;
      ctx.fillStyle = '#D4CFC4';
      ctx.font = '18px "Noto Sans SC", sans-serif';
      ctx.fillText('每天捞一块石头，看清自己的河底', canvasWidth / 2, y);

      // 导出图片
      const dataUrl = canvas.toDataURL('image/png');

      // 创建下载链接
      const link = document.createElement('a');
      link.download = `道痕-${diary.diaryDate}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Taro.showToast({ title: '图片已保存', icon: 'success' });
    } catch (err) {
      console.error('生成分享图片失败:', err);
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' });
    } finally {
      setGeneratingShare(false);
    }
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
        {/* 分享按钮 */}
        {decryptedContent ? (
          <View className='share-btn' onClick={handleShare}>
            <Text className='share-btn-text'>{generatingShare ? '...' : '分享'}</Text>
          </View>
        ) : (
          <View className='placeholder' />
        )}
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
            {STEP_ORDER.map(key => {
              const value = decryptedContent[key];
              if (!value) return null;
              return (
                <View key={key} className='content-section'>
                  <Text className='section-label'>{STEP_LABELS[key] || key}</Text>
                  <Text className='section-text'>{value}</Text>
                </View>
              );
            })}

            {/* 底部分享按钮 */}
            <View className='share-section'>
              <View className='share-action-btn' onClick={handleShare}>
                <Text className='share-action-text'>
                  {generatingShare ? '生成中...' : '生成分享图片'}
                </Text>
              </View>
            </View>
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

      {/* 自定义PIN输入弹窗 - 使用PinKeyboard组件 */}
      {showPinModal && (
        <View className='pin-modal-overlay' onClick={() => setShowPinModal(false)}>
          <View className='pin-modal' onClick={e => e.stopPropagation()}>
            <Text className='pin-modal-title'>输入日记密码</Text>
            <Text className='pin-modal-hint'>请输入4位数字密码解锁道痕</Text>
            {pinError && <Text className='pin-error'>{pinError}</Text>}
            <PinKeyboard
              value={pinInput}
              onChange={setPinInput}
              onComplete={handlePinComplete}
              shake={pinShake}
            />
            {decrypting && (
              <Text className='pin-loading'>解密中...</Text>
            )}
            <View className='pin-cancel-btn' onClick={() => setShowPinModal(false)}>
              <Text className='pin-cancel-text'>取消</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
