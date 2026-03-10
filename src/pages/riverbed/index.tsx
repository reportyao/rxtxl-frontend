/**
 * ===================================================================
 * 石头收藏馆页面 - "河床"Tab (Riverbed Page)
 * ===================================================================
 *
 * 使用Canvas 2D绘制俯视河床可视化场景，展示用户所有捞出的石头。
 *
 * 可视化设计：
 * - 河床背景：渐变沙色，带有半透明水纹波浪线
 * - 石头形状：椭圆形，大小与出现频率正相关
 * - 石头颜色：使用8种自然色系（赭石、深褐、苔绿等），按频率分配
 * - 石头文字：白色宋体，显示主石头内容（超过6字截断）
 * - 出现次数：频率>1的石头在下方显示"×N"
 * - 石头高光：左上角半透明白色椭圆，模拟水下光泽
 *
 * 交互设计：
 * - 点击石头：弹出详情弹窗，显示出现次数和日期列表
 * - 点击空白处：关闭弹窗
 * - 支持touch和click事件（兼容移动端和桌面端）
 *
 * 技术实现：
 * - 使用原生Canvas API（非Taro Canvas组件），确保H5环境下的性能
 * - 支持高DPI屏幕（devicePixelRatio适配）
 * - 石头布局使用随机位置 + 碰撞检测，避免重叠
 * - 碰撞检测最多尝试50次，超过则接受当前位置（防止死循环）
 *
 * 数据来源：
 * - GET /api/diaries/stones → 返回聚合后的石头列表
 * - 每块石头包含：content（内容）、count（出现次数）、dates（出现日期）
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

/** 石头数据（来自API） */
interface StoneData {
  content: string;    // 主石头内容文本
  count: number;      // 出现次数
  dates: string[];    // 出现日期列表
  diaryIds: string[]; // 关联的日记ID列表
}

/** Canvas中的石头渲染节点 */
interface StoneNode {
  x: number;        // 中心X坐标
  y: number;        // 中心Y坐标
  rx: number;       // 椭圆X轴半径
  ry: number;       // 椭圆Y轴半径
  rotation: number; // 旋转角度（弧度）
  content: string;  // 石头内容文本
  count: number;    // 出现次数
  color: string;    // 填充颜色
  opacity: number;  // 不透明度（频率越高越不透明）
}

/**
 * 石头颜色映射表
 * 使用自然色系，模拟真实河底石头的颜色
 * 按石头出现频率排序后依次分配
 */
const STONE_COLORS = [
  '#8B6F4E', // 赭石色（最高频石头）
  '#6B5B4E', // 深褐色
  '#7A8B6F', // 苔绿色
  '#5B6B7A', // 青灰色
  '#8B7A6B', // 暖灰色
  '#6F7A5B', // 橄榄色
  '#7A6B5B', // 土黄色
  '#5B7A6B', // 冷绿色（最低频石头）
];

export default function RiverbedPage() {
  // ===== 状态管理 =====
  const [stones, setStones] = useState<StoneData[]>([]);       // 石头数据列表
  const [totalStones, setTotalStones] = useState(0);           // 石头总块数
  const [uniqueStones, setUniqueStones] = useState(0);         // 不同种类的石头数
  const [loading, setLoading] = useState(true);                // 加载状态
  const [selectedStone, setSelectedStone] = useState<StoneData | null>(null); // 当前选中的石头

  /** 存储Canvas中所有石头节点的位置信息，用于点击检测 */
  const stoneNodesRef = useRef<StoneNode[]>([]);

  /** 页面加载时获取石头数据 */
  useEffect(() => {
    fetchStones();
  }, []);

  /** 每次 Tab 切换到河床时刷新数据 */
  useDidShow(() => {
    fetchStones();
  });

  /** 从API获取聚合后的石头数据 */
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

  /**
   * Canvas河床绘制函数
   *
   * 绘制流程：
   * 1. 绘制河床渐变背景（沙色渐变）
   * 2. 绘制水纹波浪线（8条半透明正弦曲线）
   * 3. 计算石头布局（按频率排序，随机位置 + 碰撞检测）
   * 4. 绘制每块石头（椭圆 + 阴影 + 高光 + 文字 + 次数）
   *
   * @param canvas - HTML Canvas元素
   */
  const drawRiverbed = useCallback((canvas: HTMLCanvasElement) => {
    if (!canvas || stones.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // ===== Step 1: 清空画布并绘制河床背景 =====
    ctx.clearRect(0, 0, width, height);

    // 垂直渐变：浅沙色 → 深沙色，模拟水深效果
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#D4CFC4');   // 浅沙色（水面附近）
    gradient.addColorStop(0.3, '#C8C0B4');
    gradient.addColorStop(0.7, '#BEB5A6');
    gradient.addColorStop(1, '#B0A898');   // 深沙色（河底深处）
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // ===== Step 2: 绘制水纹波浪线 =====
    // 8条半透明白色正弦曲线，模拟水面波纹的光影
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const y = (height / 8) * i + 20;
      ctx.moveTo(0, y);
      for (let x = 0; x < width; x += 5) {
        // 正弦曲线，每条线的相位不同（+i），产生自然的波浪效果
        ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * 8);
      }
      ctx.stroke();
    }

    // ===== Step 3: 计算石头布局 =====
    const nodes: StoneNode[] = [];
    // 按出现频率降序排列，高频石头先放置（优先获得好位置）
    const sortedStones = [...stones].sort((a, b) => b.count - a.count);
    const maxCount = Math.max(...sortedStones.map(s => s.count), 1);

    sortedStones.forEach((stone, index) => {
      // 石头大小与出现频率正相关：频率越高，石头越大
      const sizeRatio = 0.5 + (stone.count / maxCount) * 0.5; // 0.5 ~ 1.0
      const baseRx = 30 + sizeRatio * 25;  // X轴半径：30 ~ 55px
      const baseRy = 20 + sizeRatio * 15;  // Y轴半径：20 ~ 35px

      // 随机位置 + 碰撞检测（最多尝试50次）
      // 确保石头不超出画布边界，且不与已放置的石头重叠
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
        rotation: (Math.random() - 0.5) * 0.5, // -0.25 ~ 0.25弧度的随机旋转
        content: stone.content,
        count: stone.count,
        color: STONE_COLORS[index % STONE_COLORS.length],
        opacity: 0.6 + (stone.count / maxCount) * 0.4, // 0.6 ~ 1.0
      });
    });

    // 保存节点信息到ref，供点击检测使用
    stoneNodesRef.current = nodes;

    // ===== Step 4: 绘制每块石头 =====
    nodes.forEach(node => {
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate(node.rotation);

      // 石头阴影（模拟水下深度感）
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 3;

      // 石头主体（椭圆形）
      ctx.beginPath();
      ctx.ellipse(0, 0, node.rx, node.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = node.opacity;
      ctx.fill();

      // 石头高光（左上角的半透明白色椭圆，模拟水下光泽）
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      ctx.ellipse(-node.rx * 0.2, -node.ry * 0.2, node.rx * 0.4, node.ry * 0.3, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();

      // 石头文字（居中显示，超过6字截断加省略号）
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `${Math.min(node.rx * 0.4, 14)}px "Noto Serif SC", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const text = node.content.length > 6 ? node.content.slice(0, 5) + '…' : node.content;
      ctx.fillText(text, 0, 0);

      // 出现次数标记（频率>1时显示"×N"）
      if (node.count > 1) {
        ctx.font = `${Math.min(node.rx * 0.25, 10)}px sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillText(`×${node.count}`, 0, node.ry * 0.55);
      }

      ctx.restore();
    });
  }, [stones]);

  /**
   * Canvas初始化和高DPI适配
   *
   * 高DPI适配原理：
   * - Canvas的CSS尺寸和实际像素尺寸是独立的
   * - 在2x Retina屏幕上，需要将Canvas的实际像素设为CSS尺寸的2倍
   * - 然后通过ctx.scale(2, 2)放大绘制，确保图形清晰不模糊
   */
  useEffect(() => {
    if (typeof document === 'undefined' || stones.length === 0) return;

    // 延迟100ms等待DOM渲染完成
    const timer = setTimeout(() => {
      const canvasEl = document.querySelector('.riverbed-canvas') as HTMLCanvasElement;
      if (canvasEl) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvasEl.getBoundingClientRect();
        // 设置Canvas实际像素尺寸（CSS尺寸 × 设备像素比）
        canvasEl.width = rect.width * dpr;
        canvasEl.height = rect.height * dpr;
        const ctx = canvasEl.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr); // 缩放绘制上下文以匹配DPI
        }
        drawRiverbed(canvasEl);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [stones, drawRiverbed]);

  /**
   * Canvas点击事件处理
   *
   * 通过椭圆方程判断点击位置是否在某个石头内部：
   * (dx/rx)² + (dy/ry)² <= 1 → 点在椭圆内
   *
   * 兼容处理：
   * - 移动端：使用touches/changedTouches获取坐标
   * - 桌面端：使用clientX/clientY获取坐标
   */
  const handleCanvasClick = (e: any) => {
    const canvasEl = document.querySelector('.riverbed-canvas') as HTMLCanvasElement;
    if (!canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();

    // 兼容触摸和鼠标事件，获取点击坐标
    let clientX: number, clientY: number;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX || 0;
      clientY = e.clientY || 0;
    }

    // 转换为Canvas内部坐标
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 遍历所有石头节点，检查点击是否命中
    for (const node of stoneNodesRef.current) {
      const dx = (x - node.x) / node.rx;
      const dy = (y - node.y) / node.ry;
      // 椭圆方程：(x/a)² + (y/b)² <= 1
      if (dx * dx + dy * dy <= 1) {
        const stoneData = stones.find(s => s.content === node.content);
        if (stoneData) {
          setSelectedStone(stoneData);
        }
        return;
      }
    }
    // 点击空白处，关闭弹窗
    setSelectedStone(null);
  };

  // ===== 页面渲染 =====
  return (
    <View className='riverbed-page'>
      {/* 页面标题和统计信息 */}
      <View className='page-header'>
        <Text className='page-title'>河床</Text>
        <View className='header-stats'>
          <Text className='stats-text'>{uniqueStones} 种石头 · 共 {totalStones} 块</Text>
        </View>
      </View>

      {/* 三种状态：加载中 / 空状态 / Canvas河床 */}
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

      {/* 石头详情弹窗 - 点击石头后弹出 */}
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
