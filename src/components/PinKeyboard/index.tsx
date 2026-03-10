/**
 * PinKeyboard - 可复用的自定义数字键盘组件
 * 兼容 HTTP 和 HTTPS 环境，不依赖系统键盘
 */
import { View, Text } from '@tarojs/components';
import './index.scss';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

interface PinKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  maxLength?: number;
  shake?: boolean;
}

export default function PinKeyboard({
  value,
  onChange,
  onComplete,
  maxLength = 4,
  shake = false,
}: PinKeyboardProps) {

  const handleKey = (key: string) => {
    if (key === 'del') {
      onChange(value.slice(0, -1));
    } else if (key !== '' && value.length < maxLength) {
      const newVal = value + key;
      onChange(newVal);
      if (newVal.length === maxLength && onComplete) {
        onComplete(newVal);
      }
    }
  };

  return (
    <View className='pin-keyboard'>
      {/* PIN 圆点显示 */}
      <View className={`pin-keyboard-dots ${shake ? 'shake' : ''}`}>
        {Array.from({ length: maxLength }).map((_, i) => (
          <View key={i} className={`pin-keyboard-dot ${i < value.length ? 'filled' : ''}`} />
        ))}
      </View>

      {/* 数字键盘 */}
      <View className='pin-keyboard-numpad'>
        {KEYS.map((key, idx) => (
          <View
            key={idx}
            className={`numpad-key ${key === '' ? 'numpad-key-empty' : ''} ${key === 'del' ? 'numpad-key-del' : ''}`}
            onClick={() => key !== '' && handleKey(key)}
          >
            {key === 'del' ? (
              <Text className='numpad-del-text'>⌫</Text>
            ) : (
              <Text className='numpad-key-text'>{key}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
