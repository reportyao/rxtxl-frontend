/**
 * ===================================================================
 * 石头收藏馆页面 - "河床"Tab (Riverbed Page) v2.0
 * ===================================================================
 *
 * v2.0 改进：从Canvas绘制改为纯DOM/CSS实现
 * 原因：Canvas在微信浏览器和部分移动端浏览器中存在渲染兼容性问题
 *
 * 可视化设计：
 * - 河床背景：CSS渐变沙色，带有半透明水纹动画
 * - 石头形状：CSS椭圆div，大小与出现频率正相关
 * - 石头颜色：使用8种自然色系，按频率分配
 * - 石头文字：白色居中显示
 * - 出现次数：频率>1的石头显示"×N"
 * - 石头高光：CSS伪元素模拟水下光泽
 *
 * 交互设计：
 * - 点击石头：弹出详情弹窗，显示出现次数和日期列表
 * - 点击空白处：关闭弹窗
 */

import { useState, useEffect, useRef } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

/** 石头数据（来自API） */
interface StoneData {
  content: string;
  count: number;
  dates: string[];
  diaryIds: string[];
}

/** 石头布局节点 */
interface StoneNode {
  x: number;       // 百分比位置 (0-100)
  y: number;
  width: number;   // px
  height: number;
  rotation: number; // deg
  content: string;
  count: number;
  color: string;
  opacity: number;
}

/**
 * 石头颜色映射表
 * 使用自然色系，模拟真实河底石头的颜色
 */
const STONE_COLORS = [
  '#8B6F4E', // 赭石色
  '#6B5B4E', // 深褐色
  '#7A8B6F', // 苔绿色
  '#5B6B7A', // 青灰色
  '#8B7A6B', // 暖灰色
  '#6F7A5B', // 橄榄色
  '#7A6B5B', // 土黄色
  '#5B7A6B', // 冷绿色
];

/**
 * 简单的伪随机数生成器（基于种子）
 * 确保同一组石头每次布局一致
 */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function RiverbedPage() {
  const [stones, setStones] = useState<StoneData[]>([]);
  const [totalStones, setTotalStones] = useState(0);
  const [uniqueStones, setUniqueStones] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedStone, setSelectedStone] = useState<StoneData | null>(null);
  const [stoneNodes, setStoneNodes] = useState<StoneNode[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStones();
  }, []);

  useDidShow(() => {
    fetchStones();
  });

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

  /** 当石头数据变化时，计算布局 */
  useEffect(() => {
    if (stones.length === 0) return;

    const sortedStones = [...stones].sort((a, b) => b.count - a.count);
    const maxCount = Math.max(...sortedStones.map(s => s.count), 1);
    const rand = seededRandom(42);

    const nodes: StoneNode[] = [];

    sortedStones.forEach((stone, index) => {
      const sizeRatio = 0.5 + (stone.count / maxCount) * 0.5;
      const w = 60 + sizeRatio * 50;  // 60~110px
      const h = 40 + sizeRatio * 30;  // 40~70px

      // 随机位置（百分比），避免碰撞
      let px: number, py: number;
      let attempts = 0;
      do {
        px = 5 + rand() * 70; // 5%~75%
        py = 5 + rand() * 75; // 5%~80%
        attempts++;
      } while (
        attempts < 50 &&
        nodes.some(n => {
          const dx = Math.abs(n.x - px);
          const dy = Math.abs(n.y - py);
          return dx < 18 && dy < 14;
        })
      );

      nodes.push({
        x: px,
        y: py,
        width: w,
        height: h,
        rotation: (rand() - 0.5) * 30, // -15~15度
        content: stone.content,
        count: stone.count,
        color: STONE_COLORS[index % STONE_COLORS.length],
        opacity: 0.7 + (stone.count / maxCount) * 0.3,
      });
    });

    setStoneNodes(nodes);
  }, [stones]);

  const handleStoneClick = (content: string) => {
    const stoneData = stones.find(s => s.content === content);
    if (stoneData) {
      setSelectedStone(stoneData);
    }
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
        <View className='riverbed-container'>
          {/* 水纹装饰 */}
          <View className='water-ripples'>
            {[0,1,2,3,4,5,6,7].map(i => (
              <View key={i} className={`ripple ripple-${i}`} />
            ))}
          </View>

          {/* 石头们 */}
          {stoneNodes.map((node, idx) => (
            <View
              key={node.content + idx}
              className='stone-item'
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: `${node.width}px`,
                height: `${node.height}px`,
                transform: `rotate(${node.rotation}deg)`,
                background: `radial-gradient(ellipse at 35% 30%, ${lightenColor(node.color, 30)}, ${node.color}, ${darkenColor(node.color, 30)})`,
                opacity: node.opacity,
              }}
              onClick={() => handleStoneClick(node.content)}
            >
              <View className='stone-highlight' />
              <Text className='stone-text'>
                {node.content.length > 6 ? node.content.slice(0, 5) + '…' : node.content}
              </Text>
              {node.count > 1 && (
                <Text className='stone-count'>×{node.count}</Text>
              )}
            </View>
          ))}
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

/** 颜色变亮 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + percent);
  const b = Math.min(255, (num & 0x0000FF) + percent);
  return `rgb(${r},${g},${b})`;
}

/** 颜色变暗 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
  const b = Math.max(0, (num & 0x0000FF) - percent);
  return `rgb(${r},${g},${b})`;
}
