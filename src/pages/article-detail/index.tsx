import { useState, useEffect } from 'react';
import Taro, { useRouter } from '@tarojs/taro';
import { View, Text, RichText } from '@tarojs/components';
import { api } from '../../utils/request';
import './index.scss';

interface ArticleDetail {
  id: string;
  title: string;
  content: string;
  chapter: number;
  publishedAt: string;
  viewCount: number;
  quotes: string[];
}

export default function ArticleDetailPage() {
  const router = useRouter();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareTip, setShowShareTip] = useState(false);

  useEffect(() => {
    const id = router.params.id;
    if (id) {
      fetchArticle(id);
    }
  }, []);

  const fetchArticle = async (id: string) => {
    try {
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
  };

  const handleBack = () => {
    Taro.navigateBack();
  };

  const handleShareQuote = (quote: string) => {
    // 跳转到分享卡片页面
    Taro.navigateTo({
      url: `/pages/share/index?type=quote&text=${encodeURIComponent(quote)}&chapter=${article?.chapter || 0}`,
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return `${d.getFullYear()}年${months[d.getMonth()]}${d.getDate()}日`;
  };

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
    <View className='article-detail-page'>
      {/* 顶部导航 */}
      <View className='nav-bar'>
        <View className='nav-back' onClick={handleBack}>
          <Text className='back-icon'>←</Text>
        </View>
        <View className='nav-share' onClick={() => setShowShareTip(!showShareTip)}>
          <Text className='share-icon'>⊕</Text>
        </View>
      </View>

      {/* 文章头部 */}
      <View className='article-header'>
        <Text className='article-chapter'>第{article.chapter}章</Text>
        <Text className='article-title'>{article.title}</Text>
        <View className='article-meta'>
          <Text className='meta-date'>{formatDate(article.publishedAt)}</Text>
          <Text className='meta-divider'>·</Text>
          <Text className='meta-views'>{article.viewCount} 次阅读</Text>
        </View>
      </View>

      {/* 分割线 */}
      <View className='divider'>
        <View className='divider-line' />
        <View className='divider-dot' />
        <View className='divider-line' />
      </View>

      {/* 文章正文 */}
      <View className='article-content'>
        <RichText nodes={article.content} />
      </View>

      {/* 金句区域 */}
      {article.quotes && article.quotes.length > 0 && (
        <View className='quotes-section'>
          <Text className='quotes-title'>本章金句</Text>
          {article.quotes.map((quote, idx) => (
            <View key={idx} className='quote-card' onClick={() => handleShareQuote(quote)}>
              <Text className='quote-text'>「{quote}」</Text>
              <View className='quote-share'>
                <Text className='quote-share-text'>分享</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 底部 */}
      <View className='article-footer'>
        <Text className='footer-text'>—— 本章完 ——</Text>
      </View>

      {/* 分享提示 */}
      {showShareTip && (
        <View className='share-tip-overlay' onClick={() => setShowShareTip(false)}>
          <View className='share-tip-card' onClick={e => e.stopPropagation()}>
            <Text className='share-tip-title'>分享本章</Text>
            <Text className='share-tip-desc'>长按下方金句可生成分享卡片</Text>
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
