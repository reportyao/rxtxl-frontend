/**
 * 道痕日记页 - "捞石头"Tab
 *
 * 功能说明：
 * - 7层引导式对话写作，逐步引导用户深入自我探索
 * - 本地草稿实时保存到localStorage，中途退出可恢复
 * - 完成后使用AES-256加密日记内容并上传服务器
 * - 完成页面提供"分享今日一捞"入口
 * - [v1.2] 支持一日多条日记：已写过当天日记后显示"再记一条"按钮
 *
 * 加密流程：
 * 1. 用户完成7层写作
 * 2. 前端将所有回答JSON序列化
 * 3. 使用用户PIN派生的AES密钥加密
 * 4. 加密后的密文上传服务器
 *
 * 本地草稿：
 * - 每次输入自动保存到localStorage
 * - key格式: diary_draft_{date}
 * - 用户完成保存后清除草稿
 */
import { useState, useEffect, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Textarea, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { deriveKey, encrypt, hashString } from '../../utils/crypto';
import type { CryptoKey } from '../../utils/crypto';
import PinKeyboard from '../../components/PinKeyboard';
import './index.scss';

/**
 * 引导式对话的7个层次
 * 每层包含：引导问题、提示文字、输入框placeholder
 * 对应需求文档第7章的完整交互文案设计
 */
const GUIDE_STEPS = [
  {
    id: 'event',
    question: '今天，什么事让你的河面起了波澜？',
    hint: '只描述发生了什么，不解释、不评价、不抒情',
    placeholder: '今天发生了什么事让你心里不平静...',
  },
  {
    id: 'reaction',
    question: '那一刻，你的第一反应是什么？',
    hint: '不是正确答案，是你最直接的感觉，比如"想反驳""很酸""想逃"',
    placeholder: '我的第一反应是...',
  },
  {
    id: 'greed',
    question: '如果顺着这股劲往前走……你其实想得到什么？',
    hint: '写具体的，不要写大词。比如"想让他承认我没错""想比那个人强"',
    placeholder: '我其实想要...',
  },
  {
    id: 'fear',
    question: '在这件事的背后……你其实在害怕什么？',
    hint: '写最丑、最小、最直接的那个"怕"。比如"怕被看不起""怕选错了"',
    placeholder: '我最怕的是...',
  },
  {
    id: 'excuse',
    question: '为了让自己舒服一点，你给这件事找了什么理由？',
    hint: '比如"我不是嫉妒，我只是客观分析""我不是害怕，我只是再等等"',
    placeholder: '我给自己找的理由是...',
  },
  {
    id: 'stone',
    question: '今天，你从河底捞出来的那块石头是什么？',
    hint: '只写一块，一句话。比如"怕被看轻""想证明自己更强"',
    placeholder: '今天的石头是...',
  },
  {
    id: 'choice',
    question: '如果明天再遇到同样的事，你准备怎么选？',
    hint: '前六步是在看石头，这一步，开始接近"人选"',
    placeholder: '我准备...',
  },
];

/** 获取今天的日期字符串 YYYY-MM-DD（使用本地时区，避免UTC时差问题） */
const getTodayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** 本地草稿的localStorage key */
const getDraftKey = () => `diary_draft_${getTodayStr()}`;

export default function DiaryPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentText, setCurrentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [todayDone, setTodayDone] = useState(false);
  const [todayStone, setTodayStone] = useState('');
  const [todayCount, setTodayCount] = useState(0); // 今天已写的日记数量
  const [isWritingNew, setIsWritingNew] = useState(false); // 是否正在写新的一条

  // PIN输入弹窗状态
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinResolve, setPinResolve] = useState<((key: CryptoKey | null) => void) | null>(null);

  const { user, cryptoKey, setCryptoKey, setUser } = useAppStore();

  /**
   * 页面加载时：
   * 1. 检查今天是否已写过日记
   * 2. 尝试恢复本地草稿
   */
  useEffect(() => {
    checkTodayDiary();
    restoreDraft();
  }, []);

  /** 检查今天已写过多少条日记 */
  const checkTodayDiary = async () => {
    try {
      const today = getTodayStr();
      const res = await api.get('/api/diaries', { date: today });
      if (res.code === 0 && res.data.list && res.data.list.length > 0) {
        setTodayDone(true);
        setTodayCount(res.data.list.length);
        // 保存最新一条的主石头用于分享
        const latestDiary = res.data.list[0]; // list按日期降序，第一条是最新的
        if (latestDiary.mainStone) {
          setTodayStone(latestDiary.mainStone);
        }
      }
    } catch (err) {
      // 静默失败，不影响写作
    }
  };

  /** 从localStorage恢复草稿 */
  const restoreDraft = () => {
    try {
      const draftStr = Taro.getStorageSync(getDraftKey());
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.answers && draft.step !== undefined) {
          setAnswers(draft.answers);
          setCurrentStep(draft.step);
          setCurrentText(draft.currentText || '');
          Taro.showToast({ title: '已恢复上次写作进度', icon: 'none', duration: 2000 });
        }
      }
    } catch (err) {
      // 草稿恢复失败，从头开始
    }
  };

  /**
   * 保存草稿到localStorage
   * 每次用户输入或切换步骤时自动调用
   */
  const saveDraft = useCallback((step: number, ans: Record<string, string>, text: string) => {
    try {
      const draft = { step, answers: ans, currentText: text, savedAt: Date.now() };
      Taro.setStorageSync(getDraftKey(), JSON.stringify(draft));
    } catch (err) {
      // 存储失败静默处理
    }
  }, []);

  /** 清除今天的草稿 */
  const clearDraft = () => {
    try {
      Taro.removeStorageSync(getDraftKey());
    } catch (err) {
      // 静默处理
    }
  };

  /** 处理文本输入 - 同时保存草稿 */
  const handleTextInput = (value: string) => {
    setCurrentText(value);
    saveDraft(currentStep, answers, value);
  };

  /** 返回上一步修改 */
  const handlePrev = () => {
    if (currentStep <= 0) return;
    const prevStepIndex = currentStep - 1;
    const prevStep = GUIDE_STEPS[prevStepIndex];
    // 把当前输入保存到answers（如果有内容的话）
    const step = GUIDE_STEPS[currentStep];
    let newAnswers = { ...answers };
    if (currentText.trim()) {
      newAnswers[step.id] = currentText.trim();
    }
    // 从answers中取出上一步的回答，放回输入框
    const prevAnswer = newAnswers[prevStep.id] || '';
    // 从answers中删除上一步的回答（因为要重新编辑）
    delete newAnswers[prevStep.id];
    setAnswers(newAnswers);
    setCurrentText(prevAnswer);
    setCurrentStep(prevStepIndex);
    saveDraft(prevStepIndex, newAnswers, prevAnswer);
  };

  /** 点击"继续深潜"或"捞出石头" */
  const handleNext = () => {
    if (!currentText.trim()) {
      Taro.showToast({ title: '写下你的感受再继续', icon: 'none' });
      return;
    }

    const step = GUIDE_STEPS[currentStep];
    const newAnswers = { ...answers, [step.id]: currentText.trim() };
    setAnswers(newAnswers);
    setCurrentText('');

    if (currentStep < GUIDE_STEPS.length - 1) {
      // 还有下一步
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveDraft(nextStep, newAnswers, '');
    } else {
      // 完成所有步骤，保存日记
      handleSave(newAnswers);
    }
  };

  /**
   * 保存日记 - 加密并上传
   * @param allAnswers - 7层完整回答
   */
  const handleSave = async (allAnswers: Record<string, string>) => {
    if (saving) return;
    setSaving(true);

    try {
      // 确保有加密密钥
      let key = cryptoKey;
      if (!key) {
        // 需要用户输入PIN来派生密钥
        key = await promptForPin();
        if (!key) {
          setSaving(false);
          return;
        }
      }

      // 将所有回答序列化为JSON，然后加密
      const diaryContent = JSON.stringify(allAnswers);
      const { encryptedData, iv } = await encrypt(diaryContent, key);

      // 提取主石头（第6层回答）并生成hash用于聚合
      const mainStone = allAnswers.stone || '';
      const mainStoneHash = await hashString(mainStone);

      const today = getTodayStr();

      // 上传加密后的日记到服务器
      const res = await api.post('/api/diaries', {
        encryptedData,
        iv,
        mainStone,
        mainStoneHash,
        diaryDate: today,
      });

      if (res.code === 0) {
        setShowComplete(true);
        setTodayDone(true);
        setTodayStone(mainStone);
        setTodayCount(prev => prev + 1);
        setIsWritingNew(false);
        clearDraft();
        // 保存成功后刷新用户的连续天数
        try {
          const checkinRes = await api.get('/api/diaries/checkins');
          if (checkinRes.code === 0 && checkinRes.data) {
            setUser({ streakDays: checkinRes.data.currentStreak || 0 });
          }
        } catch (_) { /* 忽略streak刷新失败 */ }
      } else {
        Taro.showToast({ title: res.message, icon: 'none' });
      }
    } catch (err) {
      console.error('保存日记失败:', err);
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * 弹出PIN输入弹窗，返回派生的CryptoKey
   */
  const promptForPin = (): Promise<CryptoKey | null> => {
    return new Promise((resolve) => {
      setPinInput('');
      setPinResolve(() => resolve);
      setShowPinModal(true);
    });
  };

  /** PIN输入完成（4位）自动确认 */
  const handlePinComplete = async (val: string) => {
    if (!pinResolve) return;
    try {
      // 如果 user.salt 不存在（旧登录态），先从 /api/auth/me 获取
      let salt = user?.salt;
      if (!salt) {
        try {
          const meRes = await api.get('/api/auth/me');
          if (meRes.code === 0 && meRes.data?.salt) {
            salt = meRes.data.salt;
            useAppStore.getState().setUser({ salt: meRes.data.salt });
          }
        } catch (_e) {
          // ignore
        }
      }
      if (!salt) {
        Taro.showToast({ title: '无法获取加密盐值，请重新登录', icon: 'none' });
        setPinInput('');
        pinResolve(null);
        return;
      }
      const key = await deriveKey(val, salt);
      setCryptoKey(key);
      setShowPinModal(false);
      pinResolve(key);
    } catch (err) {
      Taro.showToast({ title: '密码错误，请重试', icon: 'none' });
      setPinInput('');
    }
  };

  /** PIN输入取消 */
  const handlePinCancel = () => {
    setShowPinModal(false);
    if (pinResolve) pinResolve(null);
  };

  /** 跳转到日记历史列表 */
  const handleGoHistory = () => {
    Taro.navigateTo({ url: '/pages/diary-history/index' });
  };

  /** 跳转到"今日一捞"分享页 */
  const handleShareToday = () => {
    const stone = todayStone || answers.stone || '';
    const streak = user?.streakDays || 0;
    Taro.navigateTo({
      url: `/pages/share/index?type=daily&stone=${encodeURIComponent(stone)}&streak=${streak}`,
    });
  };

  /** 再记一条日记 - 重置写作状态但不清除todayDone */
  const handleWriteAnother = () => {
    setCurrentStep(0);
    setAnswers({});
    setCurrentText('');
    setShowComplete(false);
    setIsWritingNew(true);
    clearDraft();
  };

  // ===== 渲染：今天已写过且不在写新的 =====
  if (todayDone && !showComplete && !isWritingNew) {
    return (
      <View className='diary-page'>
        <View className='done-state'>
          <View className='done-icon'>🪨</View>
          <Text className='done-title'>
            {todayCount > 1
              ? `今天已经捞了 ${todayCount} 块石头`
              : '今天的石头已经捞过了'}
          </Text>
          {todayStone && (
            <Text className='done-stone'>「{todayStone}」</Text>
          )}
          <Text className='done-hint'>每一次捞石头，都是向河底更近一步</Text>
          <View className='done-actions'>
            <View className='action-btn primary' onClick={handleWriteAnother}>
              <Text className='action-btn-text'>再记一条日记</Text>
            </View>
            <View className='action-btn' onClick={handleGoHistory}>
              <Text className='action-btn-text'>回看道痕</Text>
            </View>
            <View className='action-btn secondary' onClick={() => Taro.switchTab({ url: '/pages/riverbed/index' })}>
              <Text className='action-btn-text'>查看河床</Text>
            </View>
            <View className='action-btn outline' onClick={handleShareToday}>
              <Text className='action-btn-text'>分享今日一捞</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ===== 渲染：完成状态 =====
  if (showComplete) {
    return (
      <View className='diary-page'>
        <View className='complete-state animate-fadeIn'>
          <View className='ripple-container'>
            <View className='ripple-circle r1' />
            <View className='ripple-circle r2' />
            <View className='ripple-circle r3' />
            <View className='stone-emoji'>🪨</View>
          </View>
          <Text className='complete-title'>今天的石头已捞出</Text>
          <View className='stone-display'>
            <Text className='stone-label'>主石头</Text>
            <Text className='stone-content'>「{answers.stone}」</Text>
          </View>
          <Text className='complete-hint'>每一次捞石头，都是向河底更近一步</Text>
          <View className='complete-actions'>
            <View className='action-btn primary' onClick={handleWriteAnother}>
              <Text className='action-btn-text'>再记一条日记</Text>
            </View>
            <View className='action-btn' onClick={handleShareToday}>
              <Text className='action-btn-text'>分享今日一捞</Text>
            </View>
            <View className='action-btn secondary' onClick={handleGoHistory}>
              <Text className='action-btn-text'>查看道痕</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // ===== 渲染：写作状态 =====
  const step = GUIDE_STEPS[currentStep];

  return (
    <View className='diary-page'>
      {/* 顶部标题和进度 */}
      <View className='diary-header'>
        <Text className='header-title'>捞石头</Text>
        <Text className='header-progress'>{currentStep + 1} / {GUIDE_STEPS.length}</Text>
      </View>

      {/* 进度条 */}
      <View className='progress-bar'>
        <View
          className='progress-fill'
          style={{ width: `${((currentStep + 1) / GUIDE_STEPS.length) * 100}%` }}
        />
      </View>

      <ScrollView className='diary-content' scrollY>
        {/* 已回答的步骤（折叠显示，点击可返回修改） */}
        {Object.entries(answers).map(([key, value], idx) => {
          const prevStep = GUIDE_STEPS[idx];
          if (!prevStep) return null;
          return (
            <View key={key} className='answered-step' onClick={() => {
              // 点击已回答的步骤，跳回该步骤修改
              const step = GUIDE_STEPS[currentStep];
              let newAnswers = { ...answers };
              if (currentText.trim()) {
                newAnswers[step.id] = currentText.trim();
              }
              // 取出该步骤的回答放回输入框
              const targetAnswer = newAnswers[prevStep.id] || '';
              // 删除该步骤及之后的所有回答
              const keysToRemove = GUIDE_STEPS.slice(idx).map(s => s.id);
              keysToRemove.forEach(k => delete newAnswers[k]);
              setAnswers(newAnswers);
              setCurrentText(targetAnswer);
              setCurrentStep(idx);
              saveDraft(idx, newAnswers, targetAnswer);
            }}>
              <Text className='answered-question'>{prevStep.question}</Text>
              <Text className='answered-text'>{value}</Text>
              <Text className='answered-edit-hint'>点击修改</Text>
            </View>
          );
        })}

        {/* 当前步骤 - 引导式对话 */}
        <View className='current-step animate-fadeInUp'>
          <Text className='step-question'>{step.question}</Text>
          <Text className='step-hint'>{step.hint}</Text>
          <Textarea
            className='step-textarea'
            placeholder={step.placeholder}
            placeholderClass='textarea-placeholder'
            value={currentText}
            onInput={e => handleTextInput(e.detail.value)}
            autoFocus
            maxlength={1000}
          />
          <View className='step-footer'>
            <Text className='char-count'>{currentText.length}/1000</Text>
            <View className='step-footer-btns'>
              {currentStep > 0 && (
                <View className='prev-btn' onClick={handlePrev}>
                  <Text className='prev-btn-text'>← 上一步</Text>
                </View>
              )}
              <View
                className={`next-btn ${!currentText.trim() ? 'disabled' : ''}`}
                onClick={handleNext}
              >
                <Text className='next-btn-text'>
                  {currentStep === GUIDE_STEPS.length - 1
                    ? (saving ? '保存中...' : '捞出石头')
                    : '继续深潜 →'
                  }
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* PIN码输入弹窗 - 自定义键盘，兼容所有平台 */}
      {showPinModal && (
        <View className='pin-modal-overlay' onClick={handlePinCancel}>
          <View className='pin-modal' onClick={e => e.stopPropagation()}>
            <Text className='pin-modal-title'>请输入日记密码</Text>
            <Text className='pin-modal-desc'>4位数字密码，用于加密你的道痕</Text>
            <PinKeyboard
              value={pinInput}
              onChange={setPinInput}
              onComplete={handlePinComplete}
            />
            <View className='pin-modal-cancel' onClick={handlePinCancel}>
              <Text className='pin-modal-cancel-text'>取消</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
