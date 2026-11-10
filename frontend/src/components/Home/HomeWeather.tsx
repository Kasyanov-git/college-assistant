import React from 'react';
import { useWeather } from '../../hooks/useWeather';
import { weatherIcon } from '../icons/KioskIcons';

interface Props {
  variant?: 'light' | 'dark';
}

export const HomeWeather: React.FC<Props> = ({ variant = 'light' }) => {
  const weather = useWeather();
  const isLight = variant === 'light';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl backdrop-blur-md ${
        isLight
          ? 'bg-white/15 border border-white/25 text-white'
          : 'bg-white border border-slate-200 text-slate-800'
      }`}
    >
      <span className="text-3xl leading-none" aria-hidden>
        {weatherIcon(weather.code)}
      </span>
      <div>
        <p className="text-2xl font-semibold tabular-nums leading-none">
          {weather.loading ? '…' : weather.temp !== null ? `${Math.round(weather.temp)}°` : '—'}
        </p>
        <p className={`text-sm mt-1 ${isLight ? 'text-white/80' : 'text-slate-500'}`}>
          {weather.loading ? 'Погода…' : `${weather.label} · ${weather.place}`}
        </p>
      </div>
    </div>
  );
};
