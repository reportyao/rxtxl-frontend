import { useState, useEffect, useRef, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Canvas } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

interface StoneData {
  content: string;
  count: number;
  dates: string[];
  diaryIds: string[];
}

interface StoneNode {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  content: string;
  count: number;
  color: string;
  opacity: number;
}

// 石头颜色映射（按出现频率）
const STONE_COLORS = [
  '#8B6F4E', // 赭石
  '#6B5B4E', // 深褐
  '#7A8B6F', // 苔绿
  '#5B6B7A', // 青灰
  '#8B7A6B', // 暖灰
  '#6F7A5B', // 橄榄
  '#7A6B5B', // 土黄
  '#5B7A6B', // 冷绿
];

export default function RiverbedPage() {
  const [stones, setStones] = useState<StoneData[]>([]);
  const [totalStones, setTotalStones] = useState(0);
  const [uniqueStones, setUniqueStones] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedStone, setSelectedStone] = useState<StoneData | null>(null);
  const canvasRef = useRef<any>(null);
  const stoneNodesRef = useRef<StoneNode[]>([]);

  useEffect(() => {
    fetchStones();
  }, []);

  const fetchStones = async () => {
    try {
      const res = await api.get('/api/diaries/stones');
      if (res.code === 0) {
        setStones(res.data.stones || []);
        setTotalStones(res.data.totalStones || 0);
        setUniqueStones(res.data.uniqueStones || 0);
      }
    } catch (err) {
      console.error('获取石头数据失败:', err);
    } finally {
      setLoading(false);
    }
  };

  // 在H5环境下使用Canvas绘制河床
  const drawRiverbed = useCallback((canvas: HTMLCanvasElement) => {
    if (!canvas || stones.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 清空画布
    ctx.clearRect(0, 0, width, height);

    // 绘制河床背景
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#D4CFC4');
    gradient.addColorStop(0.3, '#C8C0B4');
    gradient.addColorStop(0.7, '#BEB5A6');
    gradient.addColorStop(1, '#B0A898');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 绘制水纹
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const y = (height / 8) * i + 20;
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 5) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 8);
      }
      ctx.stroke();
    }

    // 生成石头节点
    const nodes: StoneNode[] = [];
    const sortedStones = [...stones].sort((a, b) => b.count - a.count);
    const maxCount = Math.max(...sortedStones.map(s => s.count), 1);

    sortedStones.forEach((stone, index) => {
      const sizeRatio = 0.5 + (stone.count / maxCount) * 0.5;
      const baseRx = 30 + sizeRatio * 25;
      const baseRy = 20 + sizeRatio * 15;

      // 随机位置（避免重叠）
      let x: number, y: number;
      let attempts = 0;
      do {
        x = baseRx + Math.random() * (width - baseRx * 2);
        y = baseRy + Math.random() * (height - baseRy * 2);
        attempts++;
      } while (
        attempts < 50 &&
        nodes.some(n => Math.hypot(n.x - x, n.y - y) < (n.rx + baseRx) * 0.9)
      );

      nodes.push({
        x,
        y,
        rx: baseRx,
        ry: baseRy,
        rotation: (Math.random() - 0.5) * 0.5,
        content: stone.content,
        count: stone.count,
        color: STONE_COLORS[index % STONE_COLORS.length],
        opacity: 0.6 + (stone.count / maxCount) * 0.4,
      });
    });

    stoneNodesRef.current = nodes;

    // 绘制石头
    nodes.forEach(node => {
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(node.rotation);

      // 石头阴影
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;

      // 石头形状（椭圆）
      ctx.beginPath();
      ctx.ellipse(0, 0, node.rx, node.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = node.opacity;
      ctx.fill();

      // 石头高光
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      ctx.ellipse(-node.rx * 0.2, -node.ry * 0.2, node.rx * 0.4, node.ry * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      // 石头文字
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${Math.min(node.rx * 0.4, 14)}px "Noto Serif SC", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = node.content.length > 6 ? node.content.slice(0, 5) + '…' : node.content;
      ctx.fillText(text, 0, 0);

      // 出现次数
      if (node.count > 1) {
        ctx.font = `${Math.min(node.rx * 0.25, 10)}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`×${node.count}`, 0, node.ry * 0.55);
      }

      ctx.restore();
    });
  }, [stones]);

  // Canvas初始化
  useEffect(() => {
    if (typeof document === 'undefined' || stones.length === 0) return;

    const timer = setTimeout(() => {
      const canvasEl = document.querySelector('.riverbed-canvas') as HTMLCanvasElement;
      if (canvasEl) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasEl.getBoundingClientRect();
        canvasEl.width = rect.width * dpr;
        canvasEl.height = rect.height * dpr;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
        drawRiverbed(canvasEl);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [stones, drawRiverbed]);

  // Canvas点击事件
  const handleCanvasClick = (e: any) => {
    const canvasEl = document.querySelector('.riverbed-canvas') as HTMLCanvasElement;
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 检查是否点击了某个石头
    for (const node of stoneNodesRef.current) {
      const dx = (x - node.x) / node.rx;
      const dy = (y - node.y) / node.ry;
      if (dx * dx + dy * dy <= 1) {
        const stoneData = stones.find(s => s.content === node.content);
        if (stoneData) {
          setSelectedStone(stoneData);
        }
        return;
      }
    }
    setSelectedStone(null);
  };

  return (
    <View className='riverbed-page'>
      <View className='page-header'>
        <Text className='page-title'>河床</Text>
        <View className='header-stats'>
          <Text className='stats-text'>{uniqueStones} 种石头 · 共 {totalStones} 块</Text>
        </View>
      </View>

      {loading ? (
        <View className='loading-state'>
          <Text className='loading-text'>探索河底中...</Text>
        </View>
      ) : stones.length === 0 ? (
        <View className='empty-state'>
          <Text className='empty-icon'>🏔</Text>
          <Text className='empty-title'>河床还是空的</Text>
          <Text className='empty-hint'>去捞第一块石头，开始认识你的河底</Text>
          <View className='empty-btn' onClick={() => Taro.switchTab({ url: '/pages/diary/index' })}>
            <Text className='empty-btn-text'>开始捞石头</Text>
          </View>
        </View>
      ) : (
        <View className='canvas-container'>
          <canvas
            className='riverbed-canvas'
            onClick={handleCanvasClick}
          />
        </View>
      )}

      {/* 石头详情弹窗 */}
      {selectedStone && (
        <View className='stone-modal' onClick={() => setSelectedStone(null)}>
          <View className='modal-content animate-fadeInUp' onClick={e => e.stopPropagation()}>
            <Text className='modal-stone-emoji'>🪨</Text>
            <Text className='modal-stone-name'>「{selectedStone.content}」</Text>
            <Text className='modal-stone-count'>出现 {selectedStone.count} 次</Text>
            <View className='modal-dates'>
              <Text className='dates-label'>出现日期</Text>
              {selectedStone.dates.slice(0, 10).map(date => (
                <Text key={date} className='date-item'>{date}</Text>
              ))}
              {selectedStone.dates.length > 10 && (
                <Text className='date-more'>还有 {selectedStone.dates.length - 10} 天...</Text>
              )}
            </View>
            <View className='modal-close' onClick={() => setSelectedStone(null)}>
              <Text className='close-text'>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
