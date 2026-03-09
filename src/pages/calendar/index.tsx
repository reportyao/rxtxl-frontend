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

  const fetchCheckins = async () => {
    try {
      const res = await api.get('/api/diaries/checkins');
      if (res.code === 0) {
        // 从checkins数组中提取日期列表
        const dates = (res.data.checkins || []).map((c: any) => c.checkinDate);
        setCheckinDates(dates);
        setStreakDays(res.data.currentStreak || 0);
        setTotalDays(res.data.totalCheckins || 0);
      }
    } catch (err) {
      console.error('获取打卡数据失败:', err);
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    const now = new Date();
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    if (next <= new Date(now.getFullYear(), now.getMonth() + 1)) {
      setCurrentMonth(next);
    }
  };

  const isCheckedIn = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return checkinDates.includes(dateStr);
  };

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

  // 计算本月打卡天数
  const monthCheckins = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(d => isCheckedIn(d)).length;

  return (
    <View className='calendar-page'>
      <View className='page-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='page-title'>河水日历</Text>
        <View className='placeholder' />
      </View>

      {/* 统计卡片 */}
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

      {/* 日历 */}
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

        {/* 星期头 */}
        <View className='week-header'>
          {weekDays.map(day => (
            <View key={day} className='week-cell'>
              <Text className='week-text'>{day}</Text>
            </View>
          ))}
        </View>

        {/* 日期格子 */}
        <View className='days-grid'>
          {/* 空白格子 */}
          {Array.from({ length: firstDay }, (_, i) => (
            <View key={`empty-${i}`} className='day-cell empty' />
          ))}

          {/* 日期格子 */}
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
        {streakDays >= 30 && (
          <Text className='encourage-text'>三十天不断，河底已渐清。你正在改变。</Text>
        )}
        {streakDays >= 7 && streakDays < 30 && (
          <Text className='encourage-text'>连续七天，水面已起波澜。继续深潜。</Text>
        )}
        {streakDays >= 1 && streakDays < 7 && (
          <Text className='encourage-text'>每一天的坚持，都让河水更清一分。</Text>
        )}
        {streakDays === 0 && (
          <Text className='encourage-text'>今天，去捞一块石头吧。</Text>
        )}
      </View>
    </View>
  );
}
