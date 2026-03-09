/**
 * 文章详情页 - 沉浸式阅读体验
 *
 * 功能说明：
 * - 沉浸式阅读：默认隐藏顶部导航，点击屏幕中央区域唤出/隐藏导航栏
 * - 左右滑动切换上一章/下一章
 * - 金句特殊样式渲染（居中、加粗、黛青色）
 * - 金句长按/点击生成分享卡片
 * - 文章富文本内容渲染
 *
 * 交互细节：
 * - 点击屏幕中央1/3区域切换导航栏显示
 * - 左滑 = 下一章，右滑 = 上一章
 * - 金句区域可点击跳转到分享卡片页面
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, RichText, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

/** 文章详情数据结构 */
interface ArticleDetail {
  id: string;
  title: string;
  content: string;
  chapter: number;
  publishedAt: string;
  viewCount: number;
  quotes: string[];
}

/** 滑动手势的最小触发距离（像素） */
const SWIPE_THRESHOLD = 80;

export default function ArticleDetailPage() {
  const router = useRouter();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNav, setShowNav] = useState(true);       // 是否显示导航栏
  const [showShareTip, setShowShareTip] = useState(false);
  const [allArticleIds, setAllArticleIds] = useState<{id: string; chapter: number}[]>([]);

  // 触摸滑动相关
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  /** 获取文章详情 */
  const fetchArticle = useCallback(async (id: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/articles/${id}`);
      if (res.code === 0) {
        setArticle(res.data);
      } else {
        Taro.showToast({ title: '文章不存在', icon: 'none' });
      }
    } catch (err) {
      Taro.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }, []);

  /** 获取所有文章ID列表（用于章节切换） */
  const fetchArticleList = useCallback(async () => {
    try {
      const res = await api.get('/api/articles', { page: 1, pageSize: 999 });
      if (res.code === 0 && res.data.list) {
        setAllArticleIds(res.data.list.map((a: any) => ({ id: a.id, chapter: a.chapter })));
      }
    } catch (err) {
      // 静默失败，不影响阅读
    }
  }, []);

  useEffect(() => {
    const id = router.params.id;
    if (id) {
      fetchArticle(id);
      fetchArticleList();
    }
  }, []);

  /**
   * 切换到指定方向的章节
   * @param direction - 'prev' 上一章 | 'next' 下一章
   */
  const switchChapter = (direction: 'prev' | 'next') => {
    if (!article || allArticleIds.length === 0) return;

    const currentIndex = allArticleIds.findIndex(a => a.id === article.id);
    if (currentIndex === -1) return;

    // 列表是倒序的（最新在前），所以 prev = index+1, next = index-1
    const targetIndex = direction === 'next' ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0) {
      Taro.showToast({ title: '已是最新章节', icon: 'none', duration: 1500 });
      return;
    }
    if (targetIndex >= allArticleIds.length) {
      Taro.showToast({ title: '已是第一章', icon: 'none', duration: 1500 });
      return;
    }

    fetchArticle(allArticleIds[targetIndex].id);
  };

  /** 触摸开始 */
  const handleTouchStart = (e: any) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  /** 触摸结束 - 判断水平滑动切换章节 */
  const handleTouchEnd = (e: any) => {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - endX;
    const diffY = Math.abs(touchStartY.current - endY);

    // 只有水平滑动距离大于阈值，且水平距离大于垂直距离时才触发
    if (Math.abs(diffX) > SWIPE_THRESHOLD && Math.abs(diffX) > diffY) {
      if (diffX > 0) {
        // 左滑 → 下一章
        switchChapter('next');
      } else {
        // 右滑 → 上一章
        switchChapter('prev');
      }
    }
  };

  /**
   * 点击屏幕中央区域切换导航栏显示
   * 屏幕纵向分为3等份，点击中间1/3区域切换
   */
  const handleContentTap = (e: any) => {
    const { clientY } = e.detail || e;
    const screenHeight = Taro.getSystemInfoSync().windowHeight;
    const topThird = screenHeight / 3;
    const bottomThird = (screenHeight / 3) * 2;

    if (clientY > topThird && clientY < bottomThird) {
      setShowNav(prev => !prev);
    }
  };

  /** 返回上一页 */
  const handleBack = () => {
    Taro.navigateBack();
  };

  /** 跳转到分享卡片页面 */
  const handleShareQuote = (quote: string) => {
    Taro.navigateTo({
      url: `/pages/share/index?type=quote&text=${encodeURIComponent(quote)}&chapter=${article?.chapter || 0}`,
    });
  };

  /** 格式化日期 */
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return `${d.getFullYear()}年${months[d.getMonth()]}${d.getDate()}日`;
  };

  // 加载中状态
  if (loading) {
    return (
      <View className='article-detail-page'>
        <View className='loading-state'>
          <View className='ink-loading' />
          <Text className='loading-text'>墨迹渲染中...</Text>
        </View>
      </View>
    );
  }

  // 文章不存在
  if (!article) {
    return (
      <View className='article-detail-page'>
        <View className='error-state'>
          <Text className='error-text'>文章未找到</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      className='article-detail-page'
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 顶部导航栏 - 沉浸式设计，可隐藏 */}
      <View className={`nav-bar ${showNav ? 'visible' : 'hidden'}`}>
        <View className='nav-back' onClick={handleBack}>
          <Text className='back-icon'>←</Text>
        </View>
        <Text className='nav-title'>第{article.chapter}章</Text>
        <View className='nav-share' onClick={() => setShowShareTip(!showShareTip)}>
          <Text className='share-icon'>⊕</Text>
        </View>
      </View>

      {/* 可滚动的文章内容区 */}
      <ScrollView
        className='article-scroll'
        scrollY
        onClick={handleContentTap}
      >
        {/* 文章头部信息 */}
        <View className='article-header'>
          <Text className='article-chapter'>第{article.chapter}章</Text>
          <Text className='article-title'>{article.title}</Text>
          <View className='article-meta'>
            <Text className='meta-date'>{formatDate(article.publishedAt)}</Text>
            <Text className='meta-divider'>·</Text>
            <Text className='meta-views'>{article.viewCount} 次阅读</Text>
          </View>
        </View>

        {/* 装饰分割线 */}
        <View className='divider'>
          <View className='divider-line' />
          <View className='divider-dot' />
          <View className='divider-line' />
        </View>

        {/* 文章正文 - 富文本渲染 */}
        <View className='article-content'>
          <RichText nodes={article.content} />
        </View>

        {/* 金句区域 - 特殊样式展示 */}
        {article.quotes && article.quotes.length > 0 && (
          <View className='quotes-section'>
            <Text className='quotes-title'>本章金句</Text>
            {article.quotes.map((quote, idx) => (
              <View key={idx} className='quote-card' onClick={() => handleShareQuote(quote)}>
                <Text className='quote-text'>「{quote}」</Text>
                <View className='quote-share'>
                  <Text className='quote-share-text'>点击分享</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 章节切换提示 */}
        <View className='chapter-nav-hint'>
          <Text className='hint-text'>← 右滑上一章 | 左滑下一章 →</Text>
        </View>

        {/* 底部 */}
        <View className='article-footer'>
          <Text className='footer-text'>—— 本章完 ——</Text>
        </View>
      </ScrollView>

      {/* 分享弹窗 */}
      {showShareTip && (
        <View className='share-tip-overlay' onClick={() => setShowShareTip(false)}>
          <View className='share-tip-card' onClick={e => e.stopPropagation()}>
            <Text className='share-tip-title'>分享本章</Text>
            <Text className='share-tip-desc'>选择一句金句生成分享卡片</Text>
            {article.quotes && article.quotes.length > 0 ? (
              article.quotes.map((quote, idx) => (
                <View key={idx} className='share-tip-quote' onClick={() => { handleShareQuote(quote); setShowShareTip(false); }}>
                  <Text className='share-tip-quote-text'>「{quote}」</Text>
                </View>
              ))
            ) : (
              <Text className='share-tip-empty'>本章暂无金句</Text>
            )}
            <View className='share-tip-close' onClick={() => setShowShareTip(false)}>
              <Text className='share-tip-close-text'>关闭</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
