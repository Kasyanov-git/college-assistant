import React, { useEffect, useRef } from 'react';
import type { Message } from '../../types';

interface Props {
  messages: Message[];
}

export const ChatPanel: React.FC<Props> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-[240px]">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
            <span className="text-brand-600 text-lg font-semibold">?</span>
          </div>
          <p className="text-slate-600 text-sm font-medium">
            Задайте вопрос голосом или текстом
          </p>
          <p className="text-slate-400 text-xs mt-2">
            Например: «Где приёмная комиссия?»
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 chat-scroll">
      {messages.map(msg => (
        <div
          key={msg.id}
          className={`max-w-[88%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap animate-slide-up ${
            msg.role === 'user'
              ? 'ml-auto bg-brand-600 text-white rounded-2xl rounded-br-md'
              : 'mr-auto bg-slate-50 text-slate-800 rounded-2xl rounded-bl-md border border-slate-100'
          }`}
        >
          {msg.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
