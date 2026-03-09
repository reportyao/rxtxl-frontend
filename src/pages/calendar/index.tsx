/**
 * 河水日历页 - 打卡记录可视化
 *
 * 功能说明：
 * - 顶部醒目展示"已连续捞石头XX天"（朱砂色大字 + 火焰图标）
 * - 三列统计：连续天数、累计天数、本月天数
 * - 月历视图：已打卡日期显示水墨晕染标记
 * - 支持切换月份查看历史打卡记录
 * - 底部根据连续天数显示不同的鼓励语
 *
 * 数据来源：
 * - GET /api/diaries/checkins - 返回打卡日期列表和统计数据
 */
import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

export default function CalendarPage() {
  const [checkinDates, setCheckinDates] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [streakDays, setStreakDays] = useState(0);
  const [totalDays, setTotalDays] = useState(0);

  useEffect(() => {
    fetchCheckins();
  }, []);

  /** 获取打卡数据 */
  const fetchCheckins = async () => {
    try {
      const res = await api.get('/api/diaries/checkins');
      if (res.code === 0) {
        const dates = (res.data.checkins || []).map((c: any) => c.checkinDate);
        setCheckinDates(dates);
        setStreakDays(res.data.currentStreak || 0);
        setTotalDays(res.data.totalCheckins || 0);
      }
    } catch (err) {
      console.error('获取打卡数据失败:', err);
    }
  };

  /** 获取指定月份的天数 */
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  /** 获取指定月份第一天是星期几（0=周日） */
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  /** 切换到上一个月 */
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  /** 切换到下一个月（不能超过当前月） */
  const nextMonth = () => {
    const now = new Date();
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    if (next <= new Date(now.getFullYear(), now.getMonth() + 1)) {
      setCurrentMonth(next);
    }
  };

  /** 判断某天是否已打卡 */
  const isCheckedIn = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return checkinDates.includes(dateStr);
  };

  /** 判断某天是否是今天 */
  const isToday = (day: number) => {
    const now = new Date();
    return (
      currentMonth.getFullYear() === now.getFullYear() &&
      currentMonth.getMonth() === now.getMonth() &&
      day === now.getDate()
    );
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  /** 计算本月打卡天数 */
  const monthCheckins = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => isCheckedIn(d)).length;

  /**
   * 根据连续天数生成鼓励语
   * 不同阶段给予不同的文字激励
   */
  const getEncourageText = () => {
    if (streakDays >= 100) return '百日不断，河底已清澈见底。你已不是从前的你。';
    if (streakDays >= 30) return '三十天不断，河底已渐清。你正在改变。';
    if (streakDays >= 7) return '连续七天，水面已起波澜。继续深潜。';
    if (streakDays >= 1) return '每一天的坚持，都让河水更清一分。';
    return '今天，去捞一块石头吧。';
  };

  return (
    <View className='calendar-page'>
      {/* 顶部导航 */}
      <View className='page-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='page-title'>河水日历</Text>
        <View className='placeholder' />
      </View>

      {/* 醒目的连续打卡天数展示 - 需求要求的核心激励元素 */}
      <View className='streak-hero'>
        <View className='streak-flame'>🔥</View>
        <View className='streak-info'>
          <Text className='streak-number'>{streakDays}</Text>
          <Text className='streak-label'>已连续捞石头</Text>
        </View>
        <Text className='streak-unit'>天</Text>
      </View>

      {/* 三列统计卡片 */}
      <View className='stats-row'>
        <View className='stat-card'>
          <Text className='stat-number'>{streakDays}</Text>
          <Text className='stat-label'>连续天数</Text>
        </View>
        <View className='stat-card'>
          <Text className='stat-number'>{totalDays}</Text>
          <Text className='stat-label'>累计天数</Text>
        </View>
        <View className='stat-card'>
          <Text className='stat-number'>{monthCheckins}</Text>
          <Text className='stat-label'>本月天数</Text>
        </View>
      </View>

      {/* 月历视图 */}
      <View className='calendar-container'>
        {/* 月份导航 */}
        <View className='month-nav'>
          <View className='month-arrow' onClick={prevMonth}>
            <Text className='arrow-text'>‹</Text>
          </View>
          <Text className='month-title'>
            {currentMonth.getFullYear()}年 {monthNames[currentMonth.getMonth()]}
          </Text>
          <View className='month-arrow' onClick={nextMonth}>
            <Text className='arrow-text'>›</Text>
          </View>
        </View>

        {/* 星期头部 */}
        <View className='week-header'>
          {weekDays.map(day => (
            <View key={day} className='week-cell'>
              <Text className='week-text'>{day}</Text>
            </View>
          ))}
        </View>

        {/* 日期格子 */}
        <View className='days-grid'>
          {/* 月初空白格子 */}
          {Array.from({ length: firstDay }, (_, i) => (
            <View key={`empty-${i}`} className='day-cell empty' />
          ))}

          {/* 日期格子 - 已打卡日期显示水墨晕染效果 */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const checked = isCheckedIn(day);
            const today = isToday(day);

            return (
              <View key={day} className={`day-cell ${checked ? 'checked' : ''} ${today ? 'today' : ''}`}>
                <Text className='day-number'>{day}</Text>
                {checked && <View className='ink-mark' />}
              </View>
            );
          })}
        </View>
      </View>

      {/* 鼓励语 */}
      <View className='encourage-section'>
        <Text className='encourage-text'>{getEncourageText()}</Text>
      </View>
    </View>
  );
}
