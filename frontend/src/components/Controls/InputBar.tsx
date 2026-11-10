import React, { useState, useCallback, useRef } from 'react';
import { useStore } from '../../store/assistantStore';
import { IconSend, IconWave } from '../icons/KioskIcons';
import { VirtualKeyboard } from './VirtualKeyboard';

interface Props {
  onSendText: (text: string) => void;
  interactionMode: 'none' | 'text' | 'voice';
  onModeChange: (mode: 'none' | 'text' | 'voice') => void;
  voiceMode: boolean;
  vadState: 'off' | 'monitoring' | 'recording' | 'cooldown';
  disabled?: boolean;
}

export const InputBar: React.FC<Props> = ({
  onSendText,
  interactionMode,
  onModeChange,
  voiceMode,
  vadState,
  disabled,
}) => {
  const [text, setText] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioLevel = useStore(s => s.audioLevel);

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (t) {
      onSendText(t);
      setText('');
    }
  }, [text, onSendText]);

  const vadLabel: Record<string, string> = {
    off: '',
    monitoring: 'Слушаю окружение…',
    recording: 'Записываю речь…',
    cooldown: 'Обрабатываю…',
  };

  const textMode = interactionMode === 'text';
  const voiceModeActive = interactionMode === 'voice' || voiceMode;
  const someModeActive = textMode || voiceModeActive;


  return (
    <div className="p-3 bg-slate-50 border-t border-slate-200">
      {voiceMode && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-white rounded-xl border border-slate-200">
          <div className="flex gap-0.5 items-end h-5 w-8">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="w-1 rounded-full transition-all duration-75 bg-brand-500"
                style={{
                  height: `${Math.max(3, audioLevel * 20 * (0.5 + (i % 3) * 0.15))}px`,
                  opacity: 0.45,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-slate-600 font-medium">
            {vadLabel[vadState] || ''}
          </span>
          {voiceMode && (
            <span className="text-[10px] text-slate-400 ml-auto">Говорите — я услышу</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5">
        {(!someModeActive || textMode) && (
          <button
            type="button"
            onClick={() => onModeChange(textMode ? 'none' : 'text')}
            disabled={disabled}
            className={`h-24 rounded-2xl border p-4 text-left transition-all ${
              textMode
                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-200'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div className="font-semibold text-lg">⌨ Написать</div>
            <div className={`text-sm mt-1 ${textMode ? 'text-white/90' : 'text-slate-500'}`}>
              {textMode ? 'Режим ввода включен · нажмите для выхода' : 'Открыть клавиатуру'}
            </div>
          </button>
        )}
        {(!someModeActive || voiceModeActive) && (
          <button
            type="button"
            onClick={() => onModeChange(voiceModeActive ? 'none' : 'voice')}
            disabled={disabled}
            className={`h-24 rounded-2xl border p-4 text-left transition-all ${
              voiceModeActive
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            <div className="font-semibold text-lg flex items-center gap-2"><IconWave className="w-5 h-5" /> Голосовой режим</div>
            <div className={`text-sm mt-1 ${voiceModeActive ? 'text-white/90' : 'text-slate-500'}`}>
              {voiceModeActive ? 'Активен · нажмите для выключения' : 'Включить постоянное слушание'}
            </div>
          </button>
        )}
      </div>

      {textMode && (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onFocus={() => setKeyboardVisible(true)}
              readOnly
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Введите вопрос…"
              disabled={disabled}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white
                       focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100
                       text-sm disabled:opacity-40 placeholder:text-slate-400"
            />
            {!disabled && keyboardVisible && <span className="virtual-caret" aria-hidden="true" />}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center
                       hover:bg-brand-700 transition-all shrink-0 disabled:opacity-30"
          >
            <IconSend />
          </button>
        </div>
      )}
      {textMode && keyboardVisible && (
        <VirtualKeyboard
          onKey={value => setText(current => current + value)}
          onBackspace={() => setText(current => current.slice(0, -1))}
          onEnter={handleSend}
          onClose={() => {
            setKeyboardVisible(false);
            inputRef.current?.blur();
          }}
        />
      )}
    </div>
  );
};
