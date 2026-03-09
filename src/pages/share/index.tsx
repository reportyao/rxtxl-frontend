import { useState, useEffect, useRef } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Canvas } from '@tarojs/components';
import { useAppStore } from '../../store';
import './index.scss';

export default function SharePage() {
  const router = useRouter();
  const [cardReady, setCardReady] = useState(false);
  const { user } = useAppStore();

  const type = router.params.type || 'quote'; // quote | diary | profile
  const text = decodeURIComponent(router.params.text || '');
  const chapter = router.params.chapter || '';
  const streak = router.params.streak || '0';

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const timer = setTimeout(() => {
      generateCard();
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  const generateCard = () => {
    const canvas = document.querySelector('.share-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 2;
    const cardWidth = 340;
    const cardHeight = 480;
    canvas.width = cardWidth * dpr;
    canvas.height = cardHeight * dpr;
    canvas.style.width = `${cardWidth}px`;
    canvas.style.height = `${cardHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, cardWidth, cardHeight);

    // 水墨装饰圆
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.arc(cardWidth - 40, 60, 80, 0, Math.PI * 2);
    ctx.fillStyle = '#3A4A5C';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(40, cardHeight - 80, 60, 0, Math.PI * 2);
    ctx.fillStyle = '#5B8C7A';
    ctx.fill();

    ctx.globalAlpha = 1;

    if (type === 'quote') {
      // 金句分享卡片
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`第${chapter}章`, 32, 50);

      // 金句文字
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px serif';
      ctx.textAlign = 'left';

      const lines = wrapText(ctx, `「${text}」`, cardWidth - 64, 20);
      let y = 100;
      lines.forEach(line => {
        ctx.fillText(line, 32, y);
        y += 32;
      });

      // 分割线
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(32, cardHeight - 120);
      ctx.lineTo(cardWidth - 32, cardHeight - 120);
      ctx.stroke();

      // 底部
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.fillText('—— 人选天选论 ——', cardWidth / 2, cardHeight - 80);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '11px sans-serif';
      ctx.fillText('认识自己的河流', cardWidth / 2, cardHeight - 55);

    } else if (type === 'diary') {
      // 今日一捞分享卡片
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(new Date().toLocaleDateString('zh-CN'), cardWidth / 2, 50);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px serif';
      ctx.fillText('今日捞到一块石头', cardWidth / 2, 90);

      // 石头
      ctx.fillStyle = '#8B6F4E';
      ctx.beginPath();
      ctx.ellipse(cardWidth / 2, 180, 60, 40, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px serif';
      ctx.textAlign = 'center';
      ctx.fillText(text.length > 8 ? text.slice(0, 7) + '…' : text, cardWidth / 2, 185);

      // 连续天数
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '13px sans-serif';
      ctx.fillText(`已连续捞石头 ${streak} 天`, cardWidth / 2, 260);

      // 底部
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(32, cardHeight - 120);
      ctx.lineTo(cardWidth - 32, cardHeight - 120);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '14px serif';
      ctx.fillText('—— 人选天选论 ——', cardWidth / 2, cardHeight - 80);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = '11px sans-serif';
      ctx.fillText('认识自己的河流', cardWidth / 2, cardHeight - 55);
    }

    setCardReady(true);
  };

  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] => {
    const lines: string[] = [];
    let currentLine = '';

    for (const char of text) {
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const handleSave = () => {
    const canvas = document.querySelector('.share-canvas') as HTMLCanvasElement;
    if (!canvas) return;

    try {
      const link = document.createElement('a');
      link.download = `人选天选论_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      Taro.showToast({ title: '已保存到相册', icon: 'success' });
    } catch (err) {
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  return (
    <View className='share-page'>
      <View className='page-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='page-title'>分享卡片</Text>
        <View className='placeholder' />
      </View>

      <View className='card-preview'>
        <canvas className='share-canvas' />
      </View>

      <View className='action-bar'>
        <View className='save-btn' onClick={handleSave}>
          <Text className='save-btn-text'>保存图片</Text>
        </View>
        <Text className='action-hint'>长按图片也可以保存</Text>
      </View>
    </View>
  );
}
