/**
 * 分享卡片页 v4.0
 *
 * v4.0 改进内容：
 * - 生成完成后先显示图片预览，用户确认后再保存
 * - 预览界面：全屏展示卡片 + 保存/返回按钮
 * - iOS：提示长按图片保存；Android/桌面：点击按钮直接下载
 * - 生成过程中显示加载动画
 */
import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Image } from '@tarojs/components';
import QRCode from 'qrcode';
import './index.scss';

// 水墨石头图片（AI生成）
import stoneImg1 from '../../assets/stone-ink-1.png';
import stoneImg2 from '../../assets/stone-ink-2.png';
import stoneImg3 from '../../assets/stone-ink-3.png';

const STONE_IMAGES = [stoneImg1, stoneImg2, stoneImg3];

type Stage = 'generating' | 'preview';

export default function SharePage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('generating');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const type = router.params.type || 'quote';
  const text = decodeURIComponent(router.params.text || router.params.stoneName || router.params.stone || '');
  const chapter = router.params.chapter || '';
  const streak = router.params.streak || '0';

  useEffect(() => {
    const timer = setTimeout(() => {
      generateCard();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  /** 根据石头名称确定性选择图片 */
  const getStoneImageIndex = (stoneName: string): number => {
    let hash = 0;
    for (let i = 0; i < stoneName.length; i++) {
      hash = ((hash << 5) - hash) + stoneName.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % STONE_IMAGES.length;
  };

  /** 加载图片为 HTMLImageElement */
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  /** 生成分享卡片，完成后转为 dataURL 进入预览阶段 */
  const generateCard = async () => {
    if (typeof document === 'undefined') return;

    const canvas = document.getElementById('shareCanvas') as HTMLCanvasElement;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 2;
    const cardWidth = 340;
    const cardHeight = 540;
    canvas.width = cardWidth * dpr;
    canvas.height = cardHeight * dpr;
    canvas.style.width = `${cardWidth}px`;
    canvas.style.height = `${cardHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 背景：暖米色渐变
    const bgGrad = ctx.createLinearGradient(0, 0, 0, cardHeight);
    bgGrad.addColorStop(0, '#F5F0E8');
    bgGrad.addColorStop(0.5, '#EDE8DE');
    bgGrad.addColorStop(1, '#E4DDD2');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // 装饰：右上角淡色圆形
    ctx.globalAlpha = 0.06;
    ctx.beginPath();
    ctx.arc(cardWidth - 20, 30, 90, 0, Math.PI * 2);
    ctx.fillStyle = '#8B6F4E';
    ctx.fill();
    ctx.globalAlpha = 1;

    // 装饰：左下角淡色圆形
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    ctx.arc(30, cardHeight - 100, 70, 0, Math.PI * 2);
    ctx.fillStyle = '#5B7A6B';
    ctx.fill();
    ctx.globalAlpha = 1;

    if (type === 'quote') {
      await drawQuoteCard(ctx, cardWidth, cardHeight);
    } else {
      await drawDailyCard(ctx, cardWidth, cardHeight);
    }

    // 转为 dataURL，进入预览阶段
    try {
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewUrl(dataUrl);
      setStage('preview');
    } catch (e) {
      // 跨域图片可能导致 toDataURL 失败，直接进入预览（canvas可见）
      setStage('preview');
    }
  };

  /** 绘制金句分享卡片 */
  const drawQuoteCard = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (chapter) {
      ctx.fillStyle = '#9B8B7A';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`第 ${chapter} 篇`, 32, 52);
    }

    ctx.fillStyle = 'rgba(139,111,78,0.15)';
    ctx.font = 'bold 80px serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', 22, 110);

    ctx.fillStyle = '#3D2B1A';
    ctx.font = '19px "Noto Serif SC", serif';
    ctx.textAlign = 'left';
    const displayText = text || '认识自己的河流';
    const lines = wrapText(ctx, displayText, w - 64);
    let y = 100;
    lines.forEach(line => {
      ctx.fillText(line, 36, y);
      y += 30;
    });

    ctx.strokeStyle = 'rgba(139,111,78,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, h - 145);
    ctx.lineTo(w - 32, h - 145);
    ctx.stroke();

    await drawBottomSection(ctx, w, h);
  };

  /** 绘制今日一捞分享卡片 */
  const drawDailyCard = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#9B8B7A';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(new Date().toLocaleDateString('zh-CN'), w / 2, 48);

    ctx.fillStyle = '#3D2B1A';
    ctx.font = '15px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('今日捞到一块石头', w / 2, 82);

    const stoneText = text || '未知的石头';
    const imgIndex = getStoneImageIndex(stoneText);
    const imgSrc = STONE_IMAGES[imgIndex];

    try {
      const stoneImage = await loadImage(imgSrc);
      const stoneSize = 140;
      const stoneX = w / 2 - stoneSize / 2;
      const stoneY = 105;
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(stoneImage, stoneX, stoneY, stoneSize, stoneSize);
      ctx.shadowColor = 'transparent';
    } catch (e) {
      ctx.fillStyle = '#8B7A6B';
      ctx.beginPath();
      ctx.ellipse(w / 2, 175, 60, 42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#3D2B1A';
    ctx.font = 'bold 18px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayName = stoneText.length > 8 ? stoneText.slice(0, 7) + '…' : stoneText;
    ctx.fillText(`「${displayName}」`, w / 2, 268);

    ctx.fillStyle = '#7A6B5A';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const streakNum = parseInt(streak, 10) || 0;
    ctx.fillText(`已连续捞石头 ${streakNum} 天`, w / 2, 300);

    ctx.strokeStyle = 'rgba(139,111,78,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, h - 145);
    ctx.lineTo(w - 32, h - 145);
    ctx.stroke();

    await drawBottomSection(ctx, w, h);
  };

  /** 绘制底部公共区域 */
  const drawBottomSection = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = '#5C4A3A';
    ctx.font = '13px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('—— 人选天选论 ——', w / 2, h - 125);

    ctx.fillStyle = '#9B8B7A';
    ctx.font = '11px sans-serif';
    ctx.fillText('认识自己的河流', w / 2, h - 105);

    try {
      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, 'https://rxtxl.com', {
        width: 64,
        margin: 1,
        color: { dark: '#5C4A3A', light: '#F5F0E8' },
      });
      const qrSize = 52;
      ctx.drawImage(qrCanvas, w / 2 - qrSize / 2, h - 90, qrSize, qrSize);
    } catch (e) {
      console.error('二维码生成失败:', e);
    }

    ctx.fillStyle = '#7A6B5A';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('rxtxl.com', w / 2, h - 28);

    ctx.fillStyle = '#B0A090';
    ctx.font = '9px sans-serif';
    ctx.fillText('人选天选轮拼音首字母', w / 2, h - 13);
  };

  /** 文字自动换行 */
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const lines: string[] = [];
    let currentLine = '';
    for (const char of text) {
      const testLine = currentLine + char;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  /** 保存图片 */
  const handleSave = () => {
    setSaving(true);
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        // iOS：提示长按预览图保存
        Taro.showModal({
          title: '保存图片',
          content: '请长按上方卡片图片，选择"存储图像"即可保存到相册',
          showCancel: false,
          confirmText: '我知道了',
        });
        setSaving(false);
        return;
      }

      // Android / 桌面：优先用 dataURL 下载
      if (previewUrl) {
        const link = document.createElement('a');
        link.download = `人选天选论_${Date.now()}.png`;
        link.href = previewUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        Taro.showToast({ title: '已保存', icon: 'success' });
        setSaving(false);
        return;
      }

      // 兜底：从 canvas 获取
      const canvas = document.getElementById('shareCanvas') as HTMLCanvasElement;
      if (!canvas) { setSaving(false); return; }
      canvas.toBlob((blob) => {
        if (!blob) {
          Taro.showToast({ title: '保存失败', icon: 'none' });
          setSaving(false);
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `人选天选论_${Date.now()}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Taro.showToast({ title: '已保存', icon: 'success' });
        setSaving(false);
      }, 'image/png');
    } catch (err) {
      Taro.showToast({ title: '请长按图片保存', icon: 'none' });
      setSaving(false);
    }
  };

  // ===== 生成中界面 =====
  if (stage === 'generating') {
    return (
      <View className='share-page'>
        {/* 隐藏的 canvas 用于绘制 */}
        <canvas id='shareCanvas' style={{ position: 'fixed', left: '-9999px', top: '-9999px', width: '340px', height: '540px' }} />
        <View className='generating-state'>
          <View className='ink-spinner'>
            <View className='ink-drop' />
            <View className='ink-drop' />
            <View className='ink-drop' />
          </View>
          <Text className='generating-text'>正在生成卡片...</Text>
          <Text className='generating-hint'>片刻之间，墨迹成画</Text>
        </View>
      </View>
    );
  }

  // ===== 预览界面 =====
  return (
    <View className='share-page share-page--preview'>
      {/* 顶部导航 */}
      <View className='page-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='page-title'>分享卡片</Text>
        <View className='placeholder' />
      </View>

      {/* 预览区域 */}
      <View className='preview-area'>
        {previewUrl ? (
          /* 用 img 标签展示，用户可长按保存（iOS） */
          <img
            src={previewUrl}
            alt='分享卡片预览'
            className='preview-img'
            style={{ width: '100%', maxWidth: '340px', borderRadius: '16px', boxShadow: '0 12px 40px rgba(92,74,58,0.2), 0 4px 12px rgba(92,74,58,0.1)', display: 'block' }}
          />
        ) : (
          /* toDataURL 失败时显示 canvas */
          <canvas id='shareCanvas' style={{ width: '340px', height: '540px', borderRadius: '16px' }} />
        )}
      </View>

      {/* 操作区 */}
      <View className='action-bar'>
        <View className={`save-btn ${saving ? 'disabled' : ''}`} onClick={!saving ? handleSave : undefined}>
          <Text className='save-btn-text'>{saving ? '保存中...' : '保存图片'}</Text>
        </View>
        <Text className='action-hint'>iOS 用户可长按图片直接保存到相册</Text>
      </View>
    </View>
  );
}
