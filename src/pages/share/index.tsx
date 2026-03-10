/**
 * 分享卡片页 v2.0
 *
 * 改进内容：
 * - 全新石头视觉设计：多层渐变+纹理+高光，更有质感
 * - 底部添加 rxtxl.com 二维码和网址
 * - 二维码下方添加说明文字：人选天选轮拼音首字母
 * - 整体配色升级，符合应用暖米色风格
 */
import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import QRCode from 'qrcode';
import './index.scss';

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
   * 绘制精美石头
   * 使用多层渐变模拟真实石头质感：底色 + 纹理层 + 高光
   */
  const drawBeautifulStone = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    stoneText: string
  ) => {
    ctx.save();
    ctx.translate(cx, cy);

    // 石头阴影
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 6;

    // 石头主体渐变（暖棕色系，模拟河底鹅卵石）
    const stoneGrad = ctx.createRadialGradient(-rx * 0.2, -ry * 0.3, rx * 0.1, 0, 0, rx * 1.1);
    stoneGrad.addColorStop(0, '#C4956A');   // 高光区：浅暖棕
    stoneGrad.addColorStop(0.35, '#A0724A'); // 中间过渡
    stoneGrad.addColorStop(0.7, '#7A5230');  // 暗部：深棕
    stoneGrad.addColorStop(1, '#5C3A1E');    // 边缘：最深

    ctx.beginPath();
    // 用贝塞尔曲线绘制不规则石头轮廓（比椭圆更自然）
    ctx.moveTo(0, -ry);
    ctx.bezierCurveTo(rx * 0.9, -ry * 0.9, rx * 1.05, -ry * 0.1, rx * 0.95, ry * 0.6);
    ctx.bezierCurveTo(rx * 0.7, ry * 1.05, -rx * 0.6, ry * 1.05, -rx * 0.95, ry * 0.6);
    ctx.bezierCurveTo(-rx * 1.05, -ry * 0.1, -rx * 0.9, -ry * 0.9, 0, -ry);
    ctx.closePath();
    ctx.fillStyle = stoneGrad;
    ctx.fill();

    // 去除阴影，绘制纹理层
    ctx.shadowColor = 'transparent';

    // 纹理：几条细微的弧线模拟石头纹路
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const offsetY = -ry * 0.3 + i * ry * 0.3;
      ctx.moveTo(-rx * 0.6, offsetY - ry * 0.1);
      ctx.quadraticCurveTo(0, offsetY + ry * 0.15, rx * 0.6, offsetY - ry * 0.05);
      ctx.stroke();
    }

    // 高光：左上角椭圆形高光，模拟光泽
    const hlGrad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, 0, -rx * 0.3, -ry * 0.35, rx * 0.5);
    hlGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
    hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.ellipse(-rx * 0.3, -ry * 0.35, rx * 0.45, ry * 0.3, -0.4, 0, Math.PI * 2);
    ctx.fillStyle = hlGrad;
    ctx.fill();

    // 石头上的文字
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = '#FFF8F0';
    const fontSize = Math.min(rx * 0.38, 16);
    ctx.font = `bold ${fontSize}px "Noto Serif SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const displayText = stoneText.length > 7 ? stoneText.slice(0, 6) + '…' : stoneText;
    ctx.fillText(displayText, 0, 0);

    ctx.restore();
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

    // ===== 背景：暖米色渐变，与应用整体风格一致 =====
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
    // 章节标识
    if (chapter) {
      ctx.fillStyle = '#9B8B7A';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`第 ${chapter} 章`, 32, 52);
    }

    // 引号装饰
    ctx.fillStyle = 'rgba(139,111,78,0.15)';
    ctx.font = 'bold 80px serif';
    ctx.textAlign = 'left';
    ctx.fillText('"', 22, 110);

    // 金句文字
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

    // 底部分割线
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

    // 精美石头（居中，偏上）
    const stoneText = text || '未知的石头';
    drawBeautifulStone(ctx, w / 2, 195, 72, 50, stoneText);

    // 连续天数
    ctx.fillStyle = '#7A6B5A';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`已连续捞石头 ${streak} 天`, w / 2, 290);

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
    // 品牌名
    ctx.fillStyle = '#5C4A3A';
    ctx.font = '13px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('—— 人选天选论 ——', w / 2, h - 125);

    ctx.fillStyle = '#9B8B7A';
    ctx.font = '11px sans-serif';
    ctx.fillText('认识自己的河流', w / 2, h - 105);

    // 生成二维码（32×32 px）
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
      // 将二维码绘制到卡片上（居中，底部区域）
      const qrSize = 52;
      const qrX = w / 2 - qrSize / 2;
      const qrY = h - 90;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    } catch (e) {
      console.error('二维码生成失败:', e);
    }

    // 网址文字
    ctx.fillStyle = '#7A6B5A';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('rxtxl.com', w / 2, h - 28);

    // 说明小字
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
          <Text className='back-icon'>←</Text>
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
