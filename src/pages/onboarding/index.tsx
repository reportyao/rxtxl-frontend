import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import './index.scss';

const SLIDES = [
  {
    text: '你的思想，是一条河。',
    duration: 3000,
  },
  {
    text: '河底有两块石头，\n一块叫贪婪，一块叫恐惧。',
    duration: 3500,
  },
  {
    text: '这里，是你每天捞石头的地方。',
    duration: 2500,
    showButton: true,
  },
];

export default function OnboardingPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [textVisible, setTextVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);

  const goToNext = useCallback(() => {
    if (currentSlide < SLIDES.length - 1) {
      setTextVisible(false);
      setTimeout(() => {
        setCurrentSlide(prev => prev + 1);
      }, 500);
    }
  }, [currentSlide]);

  useEffect(() => {
    // 文字淡入
    const fadeInTimer = setTimeout(() => {
      setTextVisible(true);
    }, 300);

    // 自动切换（如果不是最后一屏或最后一屏的按钮还没出现）
    const slide = SLIDES[currentSlide];
    let autoTimer: NodeJS.Timeout | null = null;

    if (!slide.showButton) {
      autoTimer = setTimeout(goToNext, slide.duration + 300);
    } else {
      // 最后一屏，延迟显示按钮
      setTimeout(() => {
        setButtonVisible(true);
      }, slide.duration);
    }

    return () => {
      clearTimeout(fadeInTimer);
      if (autoTimer) clearTimeout(autoTimer);
    };
  }, [currentSlide, goToNext]);

  const handleStart = () => {
    Taro.setStorageSync('hasOnboarded', 'true');
    Taro.redirectTo({ url: '/pages/login/index' });
  };

  const handleSkip = () => {
    Taro.setStorageSync('hasOnboarded', 'true');
    Taro.redirectTo({ url: '/pages/login/index' });
  };

  return (
    <View className='onboarding-page'>
      {/* 水墨背景动画 */}
      <View className='ink-background'>
        <View className='ink-circle ink-circle-1' />
        <View className='ink-circle ink-circle-2' />
        <View className='ink-circle ink-circle-3' />
      </View>

      {/* 跳过按钮 */}
      <View className='skip-btn' onClick={handleSkip}>
        <Text>跳过</Text>
      </View>

      {/* 文字内容 */}
      <View className='content-area'>
        <Text className={`slide-text ${textVisible ? 'visible' : ''}`}>
          {SLIDES[currentSlide].text}
        </Text>

        {SLIDES[currentSlide].showButton && buttonVisible && (
          <View className='start-btn animate-fadeInUp' onClick={handleStart}>
            <Text className='start-btn-text'>开始捞石头</Text>
          </View>
        )}
      </View>

      {/* 进度指示器 */}
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
