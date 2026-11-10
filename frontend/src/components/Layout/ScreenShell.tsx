import React from 'react';
import { useStore } from '../../store/assistantStore';
import { TopBar } from './TopBar';
import { IconBack } from '../icons/KioskIcons';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export const ScreenShell: React.FC<Props> = ({
  title,
  subtitle,
  children,
  className = '',
}) => {
  const setAppScreen = useStore(s => s.setAppScreen);

  return (
    <div className={`h-screen w-screen flex flex-col bg-kiosk-bg ${className}`}>
      <div className="flex items-center gap-3 px-6 pt-4 pb-0 shrink-0">
        <button
          type="button"
          onClick={() => setAppScreen('home')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200
                     text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50 transition-colors"
        >
          <IconBack />
          На главную
        </button>
      </div>

      <TopBar variant="dark" showClock />

      <div className="px-8 pb-2 shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1">{subtitle}</p>}
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6">{children}</div>
    </div>
  );
};
