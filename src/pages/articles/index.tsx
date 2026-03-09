import { useState, useEffect } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

interface Article {
  id: string;
  title: string;
  summary: string;
  chapter: number;
  publishedAt: string;
  viewCount: number;
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchArticles = async (pageNum: number = 1, refresh: boolean = false) => {
    try {
      setLoading(true);
      const res = await api.get('/api/articles', { page: pageNum, pageSize: 20 });
      if (res.code === 0) {
        const newList = res.data.list || [];
        if (refresh) {
          setArticles(newList);
        } else {
          setArticles(prev => [...prev, ...newList]);
        }
        setHasMore(pageNum < res.data.totalPages);
        setPage(pageNum);
      }
    } catch (err) {
      console.error('获取文章失败:', err);
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useDidShow(() => {
    fetchArticles(1, true);
  });

  usePullDownRefresh(() => {
    fetchArticles(1, true);
  });

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchArticles(page + 1);
    }
  };

  const goToDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/article-detail/index?id=${id}` });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <View className='articles-page'>
      <View className='page-header'>
        <Text className='page-title'>人选天选论</Text>
        <Text className='page-subtitle'>姜蓝</Text>
      </View>

      <ScrollView
        className='article-list'
        scrollY
        onScrollToLower={loadMore}
      >
        {articles.map((article, index) => (
          <View
            key={article.id}
            className='article-card animate-fadeInUp'
            style={{ animationDelay: `${index * 0.05}s` }}
            onClick={() => goToDetail(article.id)}
          >
            <View className='card-chapter'>
              <Text className='chapter-text'>第{article.chapter}章</Text>
            </View>
            <Text className='card-title'>{article.title}</Text>
            {article.summary && (
              <Text className='card-summary'>{article.summary}</Text>
            )}
            <View className='card-meta'>
              <Text className='meta-date'>{formatDate(article.publishedAt)}</Text>
              <Text className='meta-views'>{article.viewCount} 次阅读</Text>
            </View>
          </View>
        ))}

        {loading && (
          <View className='loading-more'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        )}

        {!loading && articles.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>暂无文章</Text>
            <Text className='empty-hint'>下拉刷新试试</Text>
          </View>
        )}

        {!hasMore && articles.length > 0 && (
          <View className='no-more'>
            <Text className='no-more-text'>—— 已到最深处 ——</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
