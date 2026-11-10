// frontend/src/components/Avatar/AssistantAvatar.tsx

import React from 'react';
import type { AssistantState } from '../../types';

interface Props {
  state: AssistantState;
  name: string;
  connected: boolean;
}

const STATE_CONFIG: Record<AssistantState, { emoji: string; label: string; color: string }> = {
  idle: { emoji: '😊', label: 'Готов помочь!', color: 'from-blue-600 to-blue-700' },
  listening: { emoji: '👂', label: 'Слушаю вас...', color: 'from-green-600 to-green-700' },
  thinking: { emoji: '🤔', label: 'Обрабатываю...', color: 'from-yellow-600 to-yellow-700' },
  speaking: { emoji: '🗣️', label: 'Говорю...', color: 'from-purple-600 to-purple-700' },
};

export const AssistantAvatar: React.FC<Props> = ({ state, name, connected }) => {
  const config = STATE_CONFIG[state];

  return (
    <div className={`p-5 bg-gradient-to-r ${config.color} text-white text-center transition-all duration-500`}>
      <div className={`text-5xl mb-1 transition-transform duration-300 ${
        state === 'thinking' ? 'animate-bounce-subtle' :
        state === 'listening' ? 'scale-110' : ''
      }`}>
        {config.emoji}
      </div>
      <h1 className="text-lg font-bold">{name}</h1>
      <p className="text-white/70 text-sm">{config.label}</p>
      <div className="flex items-center justify-center gap-1.5 mt-1.5">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
        <span className="text-xs text-white/50">{connected ? 'онлайн' : 'офлайн'}</span>
      </div>
    </div>
  );
};