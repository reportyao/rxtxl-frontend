/**
 * 分享卡片页 v3.0
 *
 * v3.0 改进内容：
 * - 使用AI生成的水墨风格石头图片替代Canvas绘制的丑石头
 * - 修复连续天数bug：从URL参数正确读取streak
 * - 石头图片通过import引入，打包时自动处理路径
 * - 石头名称叠加在图片上方，水墨书法风格
 */
import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import QRCode from 'qrcode';
import './index.scss';

// 水墨石头图片（AI生成）
import stoneImg1 from '../../assets/stone-ink-1.png';
import stoneImg2 from '../../assets/stone-ink-2.png';
import stoneImg3 from '../../assets/stone-ink-3.png';

const STONE_IMAGES = [stoneImg1, stoneImg2, stoneImg3];

export default function SharePage() {
  const router = useRouter();
  const [cardReady, setCardReady] = useState(false);

  const type = router.params.type || 'quote';
  const text = decodeURIComponent(router.params.text || router.params.stoneName || router.params.stone || '');
  const chapter = router.params.chapter || '';
  const streak = router.params.streak || '0';

  useEffect(() => {
    const timer = setTimeout(() => {
      generateCard();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  /**
   * 根据石头名称选择一张石头图片（确定性选择）
   */
  const getStoneImageIndex = (stoneName: string): number => {
    let hash = 0;
    for (let i = 0; i < stoneName.length; i++) {
      hash = ((hash << 5) - hash) + stoneName.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % STONE_IMAGES.length;
  };

  /**
   * 加载图片为Image对象
   */
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  /**
   * 生成分享卡片主函数
   */
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

    // ===== 背景：暖米色渐变 =====
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

    setCardReady(true);
  };

  /** 绘制金句分享卡片 */
  const drawQuoteCard = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (chapter) {
      ctx.fillStyle = '#9B8B7A';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`第 ${chapter} 章`, 32, 52);
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

  /** 绘制今日一捞分享卡片 - 使用AI水墨石头图片 */
  const drawDailyCard = async (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // 日期
    ctx.fillStyle = '#9B8B7A';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(new Date().toLocaleDateString('zh-CN'), w / 2, 48);

    // 标题
    ctx.fillStyle = '#3D2B1A';
    ctx.font = '15px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('今日捞到一块石头', w / 2, 82);

    // ===== 绘制水墨石头图片 =====
    const stoneText = text || '未知的石头';
    const imgIndex = getStoneImageIndex(stoneText);
    const imgSrc = STONE_IMAGES[imgIndex];

    try {
      const stoneImage = await loadImage(imgSrc);
      // 石头图片尺寸和位置
      const stoneSize = 140;
      const stoneX = w / 2 - stoneSize / 2;
      const stoneY = 105;

      // 绘制石头图片阴影
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;
      ctx.drawImage(stoneImage, stoneX, stoneY, stoneSize, stoneSize);
      ctx.shadowColor = 'transparent';
    } catch (e) {
      // 图片加载失败时用简单椭圆代替
      ctx.fillStyle = '#8B7A6B';
      ctx.beginPath();
      ctx.ellipse(w / 2, 175, 60, 42, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 石头名称（在图片下方）
    ctx.fillStyle = '#3D2B1A';
    ctx.font = 'bold 18px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayName = stoneText.length > 8 ? stoneText.slice(0, 7) + '…' : stoneText;
    ctx.fillText(`「${displayName}」`, w / 2, 268);

    // 连续天数
    ctx.fillStyle = '#7A6B5A';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    const streakNum = parseInt(streak, 10) || 0;
    ctx.fillText(`已连续捞石头 ${streakNum} 天`, w / 2, 300);

    // 底部分割线
    ctx.strokeStyle = 'rgba(139,111,78,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, h - 145);
    ctx.lineTo(w - 32, h - 145);
    ctx.stroke();

    await drawBottomSection(ctx, w, h);
  };

  /**
   * 绘制底部公共区域：品牌名 + 二维码 + 网址 + 说明
   */
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
        color: {
          dark: '#5C4A3A',
          light: '#F5F0E8',
        },
      });
      const qrSize = 52;
      const qrX = w / 2 - qrSize / 2;
      const qrY = h - 90;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
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
    const canvas = document.getElementById('shareCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        Taro.showModal({
          title: '保存图片',
          content: '请长按下方卡片图片，选择"存储图像"即可保存到相册',
          showCancel: false,
          confirmText: '我知道了',
        });
      } else {
        canvas.toBlob((blob) => {
          if (!blob) { Taro.showToast({ title: '保存失败', icon: 'none' }); return; }
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `人选天选论_${Date.now()}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          Taro.showToast({ title: '已保存', icon: 'success' });
        }, 'image/png');
      }
    } catch (err) {
      Taro.showToast({ title: '请长按图片保存', icon: 'none' });
    }
  };

  return (
    <View className='share-page'>
      <View className='page-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>\u2190</Text>
        </View>
        <Text className='page-title'>分享卡片</Text>
        <View className='placeholder' />
      </View>

      <View className='card-preview'>
        <canvas id='shareCanvas' style={{ width: '340px', height: '540px', borderRadius: '16px' }} />
      </View>

      <View className='action-bar'>
        <View className={`save-btn ${!cardReady ? 'disabled' : ''}`} onClick={handleSave}>
          <Text className='save-btn-text'>{cardReady ? '保存图片' : '生成中...'}</Text>
        </View>
        <Text className='action-hint'>长按图片也可以保存</Text>
      </View>
    </View>
  );
}
