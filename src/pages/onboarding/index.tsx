/**
 * Onboarding 新用户引导页
 *
 * 功能说明：
 * - 3屏沉浸式引导，展示"河流世界"核心概念
 * - 支持自动播放（每屏停留指定时长后自动切换）
 * - 支持手动左右滑动切换
 * - 支持点击"跳过"直接进入登录
 * - 第三屏显示"开始捞石头"按钮
 *
 * 交互细节：
 * - 文字逐行淡入，如同毛笔书写
 * - 背景为水墨晕染动画
 * - 进度指示器显示当前位置
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './index.scss';

/** 引导页幻灯片配置 */
const SLIDES = [
  {
    text: '你的思想，是一条河。',
    duration: 3000, // 停留3秒后自动切换
  },
  {
    text: '河底有两块石头，\n一块叫贪婪，一块叫恐惧。',
    duration: 3500,
  },
  {
    text: '这里，是你每天捞石头的地方。',
    duration: 2500,
    showButton: true, // 最后一屏显示按钮
  },
];

/** 滑动手势的最小触发距离（像素） */
const SWIPE_THRESHOLD = 50;

export default function OnboardingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [textVisible, setTextVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);

  // 触摸滑动相关状态
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  /**
   * 切换到下一屏
   * 如果已经是最后一屏则不执行
   */
  const goToNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setTextVisible(false);
      setButtonVisible(false);
      setTimeout(() => {
        setCurrentSlide(prev => prev + 1);
      }, 500);
    }
  }, [currentSlide]);

  /**
   * 切换到上一屏
   * 如果已经是第一屏则不执行
   */
  const goToPrev = useCallback(() => {
    if (currentSlide > 0) {
      setTextVisible(false);
      setButtonVisible(false);
      setTimeout(() => {
        setCurrentSlide(prev => prev - 1);
      }, 500);
    }
  }, [currentSlide]);

  /**
   * 自动播放逻辑
   * - 非最后一屏：停留指定时长后自动切换
   * - 最后一屏：延迟显示"开始捞石头"按钮
   */
  useEffect(() => {
    // 文字淡入动画
    const fadeInTimer = setTimeout(() => {
      setTextVisible(true);
    }, 300);

    const slide = SLIDES[currentSlide];
    let autoTimer: NodeJS.Timeout | null = null;

    if (!slide.showButton) {
      // 非最后一屏：自动切换到下一屏
      autoTimer = setTimeout(goToNext, slide.duration + 300);
    } else {
      // 最后一屏：延迟显示按钮
      setTimeout(() => {
        setButtonVisible(true);
      }, slide.duration);
    }

    return () => {
      clearTimeout(fadeInTimer);
      if (autoTimer) clearTimeout(autoTimer);
    };
  }, [currentSlide, goToNext]);

  /**
   * 触摸开始事件 - 记录起始X坐标
   */
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.touches[0].clientX;
  };

  /**
   * 触摸移动事件 - 记录当前X坐标
   */
  const handleTouchMove = (e: any) => {
    touchEndX.current = e.touches[0].clientX;
  };

  /**
   * 触摸结束事件 - 判断滑动方向并切换
   * 左滑 = 下一屏，右滑 = 上一屏
   */
  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) {
        // 左滑 → 下一屏
        goToNext();
      } else {
        // 右滑 → 上一屏
        goToPrev();
      }
    }
    // 重置触摸坐标
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  /** 点击"开始捞石头"按钮 */
  const handleStart = () => {
    Taro.setStorageSync('hasOnboarded', 'true');
    Taro.redirectTo({ url: '/pages/login/index' });
  };

  /** 点击"跳过"按钮 */
  const handleSkip = () => {
    Taro.setStorageSync('hasOnboarded', 'true');
    Taro.redirectTo({ url: '/pages/login/index' });
  };

  return (
    <View
      className='onboarding-page'
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 水墨背景动画 - 三层晕染圆形叠加 */}
      <View className='ink-background'>
        <View className='ink-circle ink-circle-1' />
        <View className='ink-circle ink-circle-2' />
        <View className='ink-circle ink-circle-3' />
      </View>

      {/* 右上角跳过按钮 */}
      <View className='skip-btn' onClick={handleSkip}>
        <Text>跳过</Text>
      </View>

      {/* 中央文字内容区 */}
      <View className='content-area'>
        <Text className={`slide-text ${textVisible ? 'visible' : ''}`}>
          {SLIDES[currentSlide].text}
        </Text>

        {/* 最后一屏的"开始捞石头"按钮 */}
        {SLIDES[currentSlide].showButton && buttonVisible && (
          <View className='start-btn animate-fadeInUp' onClick={handleStart}>
            <Text className='start-btn-text'>开始捞石头</Text>
          </View>
        )}
      </View>

      {/* 底部进度指示器 */}
      <View className='progress-dots'>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            className={`dot ${index === currentSlide ? 'active' : ''} ${index < currentSlide ? 'passed' : ''}`}
          />
        ))}
      </View>
    </View>
  );
}
