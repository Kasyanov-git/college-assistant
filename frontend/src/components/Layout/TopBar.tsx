import React from 'react';
import { KIOSK_CONFIG } from '../../config/kiosk';
import { useClock } from '../../hooks/useClock';
import { CollegeLogo } from '../icons/KioskIcons';

interface Props {
  variant?: 'light' | 'dark';
  showClock?: boolean;
}

export const TopBar: React.FC<Props> = ({ variant = 'light', showClock = true }) => {
  const { time, dateLine } = useClock();
  const isLight = variant === 'light';

  return (
    <header
      className={`flex items-center justify-between px-8 py-5 shrink-0 z-10 ${
        isLight ? 'text-white' : 'text-slate-800'
      }`}
    >
      <div className="flex items-center gap-3">
        <CollegeLogo className="w-10 h-10 shadow-md" />
        <span className={`text-lg font-semibold tracking-tight ${isLight ? '' : 'text-brand-800'}`}>
          {KIOSK_CONFIG.collegeShortName}
        </span>
      </div>

      {showClock && (
        <div className="text-right">
          <div className="text-3xl font-light tabular-nums tracking-tight">{time}</div>
          <div className={`text-sm capitalize ${isLight ? 'text-white/85' : 'text-slate-500'}`}>
            {dateLine}
          </div>
        </div>
      )}
    </header>
  );
};
