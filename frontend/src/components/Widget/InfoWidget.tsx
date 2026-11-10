import React from 'react';
import type { AssistantState } from '../../types';
import { useClock } from '../../hooks/useClock';
import { useWeather } from '../../hooks/useWeather';
import { weatherIcon } from '../icons/KioskIcons';

interface Props {
  assistantState?: AssistantState;
  connected?: boolean;
}

export const InfoWidget: React.FC<Props> = ({
  assistantState = 'idle',
  connected = false,
}) => {
  const { time, dateLine } = useClock();
  const weather = useWeather();

  const statusText: Record<AssistantState, string> = {
    idle: 'Готов ответить',
    listening: 'Слушаю вас',
    thinking: 'Обрабатываю запрос',
    speaking: 'Отвечаю',
  };

  return (
    <div className="mx-4 mt-3 mb-2 rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-slate-100">
        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Время</p>
          <p className="text-2xl font-semibold text-slate-900 tabular-nums mt-0.5">{time}</p>
          <p className="text-xs text-slate-500 capitalize mt-0.5">{dateLine}</p>
        </div>

        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Погода</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl leading-none" aria-hidden>
              {weatherIcon(weather.code)}
            </span>
            <div>
              <p className="text-xl font-semibold text-slate-900">
                {weather.loading ? '…' : weather.temp !== null ? `${Math.round(weather.temp)}°` : '—'}
              </p>
              <p className="text-xs text-slate-500">
                {weather.loading ? 'Загрузка…' : weather.label}
                {!weather.loading && ` · ${weather.place}`}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 flex flex-col justify-center">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Помощник</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                connected ? 'bg-emerald-500' : 'bg-red-400'
              }`}
            />
            <p className="text-sm font-medium text-slate-800">{statusText[assistantState]}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
