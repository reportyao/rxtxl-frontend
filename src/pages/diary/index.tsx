import { useState, useEffect } from 'react';
import Taro from '@tarojs/taro';
import { View, Text, Textarea, ScrollView } from '@tarojs/components';
import { api } from '../../utils/request';
import { useAppStore } from '../../store';
import { deriveKey, encrypt, hashString } from '../../utils/crypto';
import './index.scss';

// 引导式对话的7个层次
const GUIDE_STEPS = [
  {
    id: 'event',
    question: '今天，你的河面上飘过了什么？',
    hint: '写下今天让你情绪波动最大的一件事。不需要完整叙述，几句话就够了。',
    placeholder: '今天发生了什么事让你心里不平静...',
  },
  {
    id: 'emotion',
    question: '那一刻，河水是什么颜色的？',
    hint: '试着描述当时的情绪。是愤怒的红？焦虑的灰？还是委屈的蓝？不要评判，只是感受。',
    placeholder: '当时我感到...',
  },
  {
    id: 'thought',
    question: '水面之下，你在想什么？',
    hint: '那个情绪背后，你脑子里在转的念头是什么？"他不应该这样对我"？"我不够好"？把它原原本本写出来。',
    placeholder: '我当时心里的声音是...',
  },
  {
    id: 'fear',
    question: '如果继续往下潜，你怕什么？',
    hint: '那个念头再往深处走，你最怕的是什么？怕失去什么？怕被看到什么？怕变成什么？',
    placeholder: '我最怕的是...',
  },
  {
    id: 'desire',
    question: '你真正想要的是什么？',
    hint: '恐惧的反面，往往就是你最渴望的东西。你其实想要什么？被认可？被爱？安全感？自由？',
    placeholder: '我其实想要...',
  },
  {
    id: 'stone',
    question: '你捞到了什么石头？',
    hint: '用一句话概括今天捞到的这块石头。比如"怕被看轻"、"渴望被认可"、"害怕失控"。这就是你今天的主石头。',
    placeholder: '今天的石头是...',
  },
  {
    id: 'insight',
    question: '看着这块石头，你想对自己说什么？',
    hint: '不需要解决问题，不需要给答案。只是看着它，和它待一会儿。如果有什么话想对自己说，写下来。',
    placeholder: '我想对自己说...',
  },
];

export default function DiaryPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentText, setCurrentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [todayDone, setTodayDone] = useState(false);
  const { user, cryptoKey, setCryptoKey } = useAppStore();

  useEffect(() => {
    checkTodayDiary();
  }, []);

  const checkTodayDiary = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await api.get('/api/diaries', { date: today });
      if (res.code === 0 && res.data.list && res.data.list.length > 0) {
        setTodayDone(true);
      }
    } catch (err) {
      // 忽略
    }
  };

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
      setCurrentStep(prev => prev + 1);
    } else {
      // 完成所有步骤
      handleSave(newAnswers);
    }
  };

  const handleSave = async (allAnswers: Record<string, string>) => {
    if (saving) return;
    setSaving(true);

    try {
      // 确保有加密密钥
      let key = cryptoKey;
      if (!key) {
        // 需要用户输入PIN
        const pinResult = await promptForPin();
        if (!pinResult) {
          setSaving(false);
          return;
        }
        key = pinResult;
      }

      // 加密日记内容
      const diaryContent = JSON.stringify(allAnswers);
      const { encryptedData, iv } = await encrypt(diaryContent, key);

      // 生成主石头hash
      const mainStone = allAnswers.stone || '';
      const mainStoneHash = await hashString(mainStone);

      const today = new Date().toISOString().split('T')[0];

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

  const promptForPin = (): Promise<CryptoKey | null> => {
    return new Promise((resolve) => {
      // 简化处理：在H5中使用prompt
      const pin = window.prompt?.('请输入4位日记密码');
      if (pin && pin.length === 4 && user?.salt) {
        deriveKey(pin, user.salt).then(key => {
          setCryptoKey(key);
          resolve(key);
        }).catch(() => {
          Taro.showToast({ title: '密码错误', icon: 'none' });
          resolve(null);
        });
      } else {
        resolve(null);
      }
    });
  };

  const handleGoHistory = () => {
    Taro.navigateTo({ url: '/pages/diary-history/index' });
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setAnswers({});
    setCurrentText('');
    setShowComplete(false);
    setTodayDone(false);
  };

  // 今天已写过
  if (todayDone && !showComplete) {
    return (
      <View className='diary-page'>
        <View className='done-state'>
          <View className='done-icon'>🪨</View>
          <Text className='done-title'>今天的石头已经捞过了</Text>
          <Text className='done-hint'>明天再来，持续捞石头才能看清河底</Text>
          <View className='done-actions'>
            <View className='action-btn' onClick={handleGoHistory}>
              <Text className='action-btn-text'>回看道痕</Text>
            </View>
            <View className='action-btn secondary' onClick={() => Taro.switchTab({ url: '/pages/riverbed/index' })}>
              <Text className='action-btn-text'>查看河床</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // 完成状态
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
            <View className='action-btn' onClick={handleGoHistory}>
              <Text className='action-btn-text'>查看道痕</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // 写作状态
  const step = GUIDE_STEPS[currentStep];

  return (
    <View className='diary-page'>
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
        {/* 已回答的步骤（折叠显示） */}
        {Object.entries(answers).map(([key, value], idx) => {
          const prevStep = GUIDE_STEPS[idx];
          if (!prevStep) return null;
          return (
            <View key={key} className='answered-step'>
              <Text className='answered-question'>{prevStep.question}</Text>
              <Text className='answered-text'>{value}</Text>
            </View>
          );
        })}

        {/* 当前步骤 */}
        <View className='current-step animate-fadeInUp'>
          <Text className='step-question'>{step.question}</Text>
          <Text className='step-hint'>{step.hint}</Text>
          <Textarea
            className='step-textarea'
            placeholder={step.placeholder}
            placeholderClass='textarea-placeholder'
            value={currentText}
            onInput={e => setCurrentText(e.detail.value)}
            autoFocus
            maxlength={1000}
          />
          <View className='step-footer'>
            <Text className='char-count'>{currentText.length}/1000</Text>
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
      </ScrollView>
    </View>
  );
}
