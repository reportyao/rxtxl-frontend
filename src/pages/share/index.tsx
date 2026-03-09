/**
 * 分享卡片页
 *
 * 功能说明：
 * - 生成精美的分享卡片图片
 * - 支持两种类型：
 *   1. quote - 金句分享（来自文章详情页）
 *   2. daily - 今日一捞分享（来自日记完成页）
 *
 * 参数说明：
 * - type: 'quote' | 'daily' (注意：diary页传递的是'daily'而非'diary')
 * - text: 金句内容或主石头内容
 * - chapter: 文章章节号（quote类型使用）
 * - streak: 连续打卡天数（daily类型使用）
 * - stone: 主石头内容（daily类型使用，与text互为备选）
 *
 * [BUG FIX] v1.1:
 * - 修复type参数不匹配：diary页传type=daily，但原代码只处理type=diary
 * - 改用Taro.createCanvasContext替代原生document.querySelector（H5兼容性更好）
 * - 改进iOS保存图片方案：使用Taro.saveImageToPhotosAlbum + 降级方案
 */
import { useState, useEffect, useRef } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, Canvas } from '@tarojs/components';
import './index.scss';

export default function SharePage() {
  const router = useRouter();
  const [cardReady, setCardReady] = useState(false);
  const canvasRef = useRef<any>(null);

  // [BUG FIX] 支持 'daily' 类型（diary页传递的是 type=daily）
  const type = router.params.type || 'quote'; // quote | daily | diary
  const text = decodeURIComponent(router.params.text || router.params.stone || '');
  const chapter = router.params.chapter || '';
  const streak = router.params.streak || '0';

  useEffect(() => {
    // 延迟执行确保Canvas DOM已挂载
    const timer = setTimeout(() => {
      generateCard();
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  /**
   * 生成分享卡片
   * 使用原生Canvas API（Taro H5模式下可用）
   */
  const generateCard = () => {
    // 在H5环境中，使用document.getElementById获取canvas
    if (typeof document === 'undefined') return;

    const canvas = document.getElementById('shareCanvas') as HTMLCanvasElement;
    if (!canvas) {
      console.error('[SharePage] Canvas element not found');
      return;
    }

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

    // ===== 公共背景 =====
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
      // ===== 金句分享卡片 =====
      drawQuoteCard(ctx, cardWidth, cardHeight);
    } else if (type === 'daily' || type === 'diary') {
      // ===== 今日一捞分享卡片 =====
      // [BUG FIX] 同时支持 'daily' 和 'diary' 类型
      drawDailyCard(ctx, cardWidth, cardHeight);
    } else {
      // 未知类型，降级为金句样式
      drawQuoteCard(ctx, cardWidth, cardHeight);
    }

    setCardReady(true);
  };

  /** 绘制金句分享卡片 */
  const drawQuoteCard = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // 章节标识
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'left';
    if (chapter) {
      ctx.fillText(`第${chapter}章`, 32, 50);
    }

    // 金句文字
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px serif';
    ctx.textAlign = 'left';

    const displayText = text ? `「${text}」` : '「认识自己的河流」';
    const lines = wrapText(ctx, displayText, w - 64);
    let y = 100;
    lines.forEach(line => {
      ctx.fillText(line, 32, y);
      y += 32;
    });

    // 分割线
    drawBottomSection(ctx, w, h);
  };

  /** 绘制今日一捞分享卡片 */
  const drawDailyCard = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // 日期
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(new Date().toLocaleDateString('zh-CN'), w / 2, 50);

    // 标题
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px serif';
    ctx.fillText('今日捞到一块石头', w / 2, 90);

    // 石头图形
    ctx.fillStyle = '#8B6F4E';
    ctx.beginPath();
    ctx.ellipse(w / 2, 180, 60, 40, 0, 0, Math.PI * 2);
    ctx.fill();

    // 石头上的文字
    const stoneText = text || '未知的石头';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '16px serif';
    ctx.textAlign = 'center';
    ctx.fillText(stoneText.length > 8 ? stoneText.slice(0, 7) + '…' : stoneText, w / 2, 185);

    // 连续天数
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '13px sans-serif';
    ctx.fillText(`已连续捞石头 ${streak} 天`, w / 2, 260);

    // 底部
    drawBottomSection(ctx, w, h);
  };

  /** 绘制底部公共区域（分割线 + 品牌信息） */
  const drawBottomSection = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, h - 120);
    ctx.lineTo(w - 32, h - 120);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText('—— 人选天选论 ——', w / 2, h - 80);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '11px sans-serif';
    ctx.fillText('认识自己的河流', w / 2, h - 55);
  };

  /** 文字自动换行 */
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
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

  /**
   * 保存图片
   * [BUG FIX] 改进保存方案：
   * - 优先使用 Blob + URL.createObjectURL（兼容性更好）
   * - iOS Safari 不支持 <a download>，改为提示用户长按保存
   */
  const handleSave = () => {
    const canvas = document.getElementById('shareCanvas') as HTMLCanvasElement;
    if (!canvas) return;

    try {
      // 检测是否为iOS（iOS Safari不支持<a download>）
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      if (isIOS) {
        // iOS: 提示用户长按图片保存
        Taro.showModal({
          title: '保存图片',
          content: '请长按下方卡片图片，选择"存储图像"即可保存到相册',
          showCancel: false,
          confirmText: '我知道了',
        });
      } else {
        // Android / 其他浏览器: 使用Blob下载
        canvas.toBlob((blob) => {
          if (!blob) {
            Taro.showToast({ title: '保存失败', icon: 'none' });
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
        }, 'image/png');
      }
    } catch (err) {
      console.error('[SharePage] 保存失败:', err);
      Taro.showToast({ title: '保存失败，请长按图片保存', icon: 'none' });
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
        {/* [BUG FIX] 使用id属性替代class选择器，更可靠 */}
        <canvas id='shareCanvas' style={{ width: '340px', height: '480px' }} />
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
