import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

interface DiaryItem {
  id: string;
  diaryDate: string;
  mainStone: string;
  createdAt: string;
}

export default function DiaryHistoryPage() {
  const [diaries, setDiaries] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchDiaries(1, true);
  }, []);

  const fetchDiaries = async (pageNum: number, refresh: boolean = false) => {
    try {
      setLoading(true);
      const res = await api.get('/api/diaries', { page: pageNum, pageSize: 20 });
      if (res.code === 0) {
        const newList = res.data.list || [];
        if (refresh) {
          setDiaries(newList);
        } else {
          setDiaries(prev => [...prev, ...newList]);
        }
        setHasMore(pageNum < res.data.totalPages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('获取日记列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const goToDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/diary-detail/index?id=${id}` });
  };

  /**
   * 解析日记日期字符串
   * [BUG FIX] YYYY-MM-DD格式在new Date()中会被解析为UTC时间，
   * 导致东八区用户看到的日期可能偏差一天。
   * 修复：手动解析年月日，使用本地时区构造Date对象。
   */
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day); // 本地时区
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[d.getDay()];
    return { month: `${month}月`, day: `${day}`, weekday: `周${weekday}` };
  };

  return (
    <View className='diary-history-page'>
      <View className='page-header'>
        <View className='nav-back' onClick={() => Taro.navigateBack()}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='page-title'>道痕回看</Text>
        <View className='placeholder' />
      </View>

      <ScrollView
        className='diary-list'
        scrollY
        onScrollToLower={() => hasMore && !loading && fetchDiaries(page + 1)}
      >
        {diaries.map((diary, index) => {
          const date = formatDate(diary.diaryDate);
          return (
            <View
              key={diary.id}
              className='diary-item animate-fadeInUp'
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => goToDetail(diary.id)}
            >
              <View className='date-col'>
                <Text className='date-day'>{date.day}</Text>
                <Text className='date-month'>{date.month}</Text>
                <Text className='date-weekday'>{date.weekday}</Text>
              </View>
              <View className='content-col'>
                <View className='stone-tag'>
                  <Text className='stone-text'>🪨 {diary.mainStone}</Text>
                </View>
                <Text className='diary-hint'>点击查看完整道痕</Text>
              </View>
              <View className='arrow-col'>
                <Text className='arrow'>›</Text>
              </View>
            </View>
          );
        })}

        {loading && (
          <View className='loading-state'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        )}

        {!loading && diaries.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-icon'>🏔</Text>
            <Text className='empty-text'>还没有道痕记录</Text>
            <Text className='empty-hint'>去捞第一块石头吧</Text>
          </View>
        )}

        {!hasMore && diaries.length > 0 && (
          <View className='no-more'>
            <Text className='no-more-text'>—— 已到河源 ——</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
