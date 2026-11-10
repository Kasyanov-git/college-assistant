import React, { useEffect, useState } from 'react';
import { CompactEmbedShell } from '../Layout/CompactEmbedShell';
import type { EmbedDisplayMode } from '../../config/kiosk';
import { useEmbedAllowed } from '../../hooks/useEmbedAllowed';
import { useStore } from '../../store/assistantStore';
import { openExternalWindow } from '../../utils/externalWindow';

interface Props {
  title: string;
  url: string;
  configKey: 'scheduleUrl';
  embedMode: EmbedDisplayMode;
}

export const IframeScreen: React.FC<Props> = ({
  title,
  url,
  configKey,
  embedMode,
}) => {
  const hasUrl = Boolean(url?.trim());
  const { loading, allowed, useExternal } = useEmbedAllowed(url, embedMode);
  const setAppScreen = useStore(s => s.setAppScreen);
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    setPopupBlocked(false);
  }, [url, configKey]);

  useEffect(() => {
    if (!hasUrl || loading || !useExternal) return;

    const result = openExternalWindow(configKey, url);
    if (result === 'blocked') {
      setPopupBlocked(true);
      return;
    }
    setAppScreen('home');
  }, [hasUrl, loading, useExternal, url, configKey, setAppScreen]);

  return (
    <CompactEmbedShell title={title}>
      <div className="h-full rounded-xl overflow-hidden border border-slate-200 bg-white flex flex-col">
        {!hasUrl && <Placeholder configKey={configKey} />}

        {hasUrl && popupBlocked && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-slate-600">Браузер заблокировал окно. Разрешите всплывающие окна для киоска.</p>
            <button
              type="button"
              onClick={() => {
                const r = openExternalWindow(configKey, url);
                if (r !== 'blocked') setAppScreen('home');
              }}
              className="px-6 py-3 rounded-xl bg-brand-600 text-white font-medium active:scale-[0.98]"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {hasUrl && !popupBlocked && (loading || useExternal) && (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            {loading ? 'Загрузка…' : 'Открываем сайт…'}
          </div>
        )}

        {hasUrl && !loading && !useExternal && allowed && (
          <iframe
            title={title}
            src={url}
            className="flex-1 w-full min-h-0 border-0"
            allow="fullscreen"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </div>
    </CompactEmbedShell>
  );
};

const Placeholder: React.FC<{ configKey: string }> = ({ configKey }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
    <h2 className="text-xl font-semibold text-slate-800">Раздел в подготовке</h2>
    <p className="text-slate-500 mt-2 max-w-md">
      Укажите публичный URL в файле конфигурации.
    </p>
    <code className="mt-6 px-4 py-3 rounded-xl bg-slate-100 text-sm text-brand-800 font-mono">
      frontend/src/config/kiosk.ts → {configKey}
    </code>
  </div>
);
