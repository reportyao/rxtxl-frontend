/**
 * 文章列表页 - "读"Tab
 *
 * 功能说明：
 * - 以章节为单位的卡片式列表，按倒序排列（最新章节在最前）
 * - 新文章（3天内发布）显示"新"标识
 * - 支持下拉刷新加载最新文章
 * - 支持上拉触底加载更多（分页）
 * - 卡片点击进入文章详情页
 *
 * 数据来源：
 * - GET /api/articles?page=1&pageSize=20
 */
import { useState } from 'react';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { View, Text, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

/** 文章列表项数据结构 */
interface Article {
  id: string;
  title: string;
  summary: string;
  chapter: number;
  publishedAt: string;
  viewCount: number;
}

/** 判断文章是否为"新"文章（3天内发布） */
const isNewArticle = (publishedAt: string): boolean => {
  if (!publishedAt) return false;
  const publishDate = new Date(publishedAt).getTime();
  const now = Date.now();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  return now - publishDate < THREE_DAYS;
};

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  /**
   * 获取文章列表
   * @param pageNum - 页码
   * @param refresh - 是否为刷新操作（true则替换列表，false则追加）
   */
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

  /** 页面显示时刷新文章列表 */
  useDidShow(() => {
    fetchArticles(1, true);
  });

  /** 下拉刷新 */
  usePullDownRefresh(() => {
    fetchArticles(1, true);
  });

  /** 上拉触底加载更多 */
  const loadMore = () => {
    if (hasMore && !loading) {
      fetchArticles(page + 1);
    }
  };

  /** 跳转到文章详情页 */
  const goToDetail = (id: string) => {
    Taro.navigateTo({ url: `/pages/article-detail/index?id=${id}` });
  };

  /** 格式化日期为 YYYY.MM.DD 格式 */
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <View className='articles-page'>
      {/* 页面头部 - 应用名称和作者 */}
      <View className='page-header'>
        <Text className='page-title'>人选天选论</Text>
        <Text className='page-subtitle'>姜蓝</Text>
      </View>

      {/* 文章卡片滚动列表 */}
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
              <Text className='chapter-text'>{article.chapter === 0 ? '序' : `第${article.chapter}篇`}</Text>
              {/* 新文章标识：3天内发布的文章显示"新"标签 */}
              {isNewArticle(article.publishedAt) && (
                <View className='new-badge'>
                  <Text className='new-badge-text'>新</Text>
                </View>
              )}
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

        {/* 加载中状态 */}
        {loading && (
          <View className='loading-more'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        )}

        {/* 空状态 */}
        {!loading && articles.length === 0 && (
          <View className='empty-state'>
            <Text className='empty-text'>暂无文章</Text>
            <Text className='empty-hint'>下拉刷新试试</Text>
          </View>
        )}

        {/* 已加载全部 */}
        {!hasMore && articles.length > 0 && (
          <View className='no-more'>
            <Text className='no-more-text'>—— 已到最深处 ——</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
