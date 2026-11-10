import React from 'react';
import { useStore } from '../../store/assistantStore';
import { IconBack } from '../icons/KioskIcons';

interface Props {
  title: string;
  children: React.ReactNode;
}

/** Минимальная шапка — максимум места под контент / iframe */
export const CompactEmbedShell: React.FC<Props> = ({ title, children }) => {
  const setAppScreen = useStore(s => s.setAppScreen);

  return (
    <div className="h-screen w-screen flex flex-col bg-kiosk-bg">
      <header className="shrink-0 flex items-center gap-4 px-4 py-3 border-b border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setAppScreen('home')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200
                     text-slate-700 text-sm font-medium shadow-sm active:scale-[0.98]"
        >
          <IconBack />
          На главную
        </button>
        <h1 className="text-lg font-semibold text-slate-900 truncate">{title}</h1>
      </header>
      <div className="flex-1 min-h-0 p-2">{children}</div>
    </div>
  );
};
