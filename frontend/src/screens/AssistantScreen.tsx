import React, { useEffect, useState } from 'react';
import { useStore } from '../store/assistantStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useVoiceActivation } from '../hooks/useVoiceActivation';
import { stopAssistantAudio } from '../utils/audioPlayback';
import { CameraView } from '../components/Camera/CameraView';
import { ChatPanel } from '../components/Chat/ChatPanel';
import { SuggestionsBar } from '../components/Controls/SuggestionsBar';
import { InputBar } from '../components/Controls/InputBar';
import { InteractiveMap } from '../components/Map/InteractiveMap';
import { InfoWidget } from '../components/Widget/InfoWidget';
import { IconBack } from '../components/icons/KioskIcons';
import { withApiBase } from '../config/runtime';

export const AssistantScreen: React.FC = () => {
  const [interactionMode, setInteractionMode] = useState<'none' | 'text' | 'voice'>('none');
  const state = useStore(s => s.state);
  const messages = useStore(s => s.messages);
  const suggestions = useStore(s => s.suggestions);
  const connected = useStore(s => s.connected);
  const activeRoute = useStore(s => s.activeRoute);
  const debugStubMode = useStore(s => s.debugStubMode);
  const setDebugStubMode = useStore(s => s.setDebugStubMode);
  const setAppScreen = useStore(s => s.setAppScreen);
  const pendingVoiceMode = useStore(s => s.pendingVoiceMode);
  const setPendingVoiceMode = useStore(s => s.setPendingVoiceMode);
  const setVoiceMode = useStore(s => s.setVoiceMode);

  const setMapNodes = useStore(s => s.setMapNodes);
  const setMapEdges = useStore(s => s.setMapEdges);
  const setTotalFloors = useStore(s => s.setTotalFloors);
  const setFloorsOutline = useStore(s => s.setFloorsOutline);

  const { sendText, sendAudio, sendMapTap } = useWebSocket();
  const { voiceMode, vadState } = useVoiceActivation(sendAudio);
  const audioPlaying = useStore(s => s.audioPlaying);

  useEffect(() => {
    fetch(withApiBase('/api/map/graph'))
      .then(r => r.json())
      .then(data => {
        setMapNodes(data.nodes || []);
        setMapEdges(data.edges || []);
        const maxFloor = Math.max(
          ...(data.nodes || [{ floor: 1 }]).map((n: { floor?: number }) => n.floor || 1),
        );
        setTotalFloors(maxFloor);
      })
      .catch(err => console.error('Map load error:', err));

    fetch(withApiBase('/api/map/floors_outline'))
      .then(r => (r.ok ? r.json() : {}))
      .then(o => setFloorsOutline(o))
      .catch(() => setFloorsOutline({}));
  }, [setMapNodes, setMapEdges, setTotalFloors, setFloorsOutline]);

  useEffect(() => {
    if (!pendingVoiceMode) return;
    setVoiceMode(true);
    setInteractionMode('voice');
    setPendingVoiceMode(false);
  }, [pendingVoiceMode, setPendingVoiceMode, setVoiceMode]);

  useEffect(() => {
    return () => {
      stopAssistantAudio();
    };
  }, []);

  useEffect(() => {
    if (!voiceMode && interactionMode === 'voice') {
      setInteractionMode('none');
    }
  }, [voiceMode, interactionMode]);

  const handleModeChange = (mode: 'none' | 'text' | 'voice') => {
    if (mode === 'text') {
      setVoiceMode(false);
      setInteractionMode('text');
      return;
    }
    if (mode === 'voice') {
      setVoiceMode(true);
      setInteractionMode('voice');
      return;
    }
    setVoiceMode(false);
    setInteractionMode('none');
  };

  const assistantPanelVisual =
    interactionMode === 'text'
      ? 'assistant-mode-text'
      : interactionMode === 'voice'
        ? 'assistant-mode-voice'
        : 'bg-white';

  return (
    <div className={`h-screen w-screen flex flex-col bg-kiosk-bg p-3 gap-3 ${
      interactionMode === 'voice' ? 'assistant-page-voice' : ''
    }`}>
      <div className="flex items-center justify-between px-1 shrink-0">
        <button
          type="button"
          onClick={() => setAppScreen('home')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200
                     text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50"
        >
          <IconBack />
          На главную
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDebugStubMode(!debugStubMode)}
            title="Debug: заглушки LLM/TTS"
            className={`text-[10px] px-2.5 py-1 rounded-lg border font-medium ${
              debugStubMode
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-white text-slate-500 border-slate-200'
            }`}
          >
            STUBS {debugStubMode ? 'ON' : 'OFF'}
          </button>
          {voiceMode && (
            <span className="text-[10px] bg-brand-100 text-brand-700 px-2.5 py-1 rounded-lg font-medium">
              Голосовой режим
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-3 min-h-0">
        <div className="flex-[3] flex flex-col min-w-0 relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm">
          <div className="absolute top-4 left-44 z-20">
            <CameraView />
          </div>

          {activeRoute && (
            <div className="mx-3 mt-3 px-4 py-2.5 rounded-xl border border-brand-100 bg-brand-50/80 flex items-center gap-3">
              <span className="text-sm font-semibold text-brand-800">Маршрут</span>
              <div className="text-sm text-slate-700">
                <span className="font-semibold">{activeRoute.destination_label}</span>
                <span className="text-slate-500 ml-2">
                  {activeRoute.target_floor} этаж · ~{activeRoute.estimated_time}
                </span>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 p-2">
            <InteractiveMap onRoomClick={sendMapTap} />
          </div>
        </div>

        <div className={`w-[440px] shrink-0 flex flex-col rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-colors ${assistantPanelVisual}`}>
          <InfoWidget assistantState={state} connected={connected} />
          {interactionMode === 'voice' && (
            <div className="mx-4 mb-2 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-700 animate-pulse">
              🎙 Голосовой режим активен
            </div>
          )}
          {interactionMode === 'text' && (
            <div className="mx-4 mb-2 rounded-xl border border-orange-200 bg-orange-50/90 px-3 py-2 text-xs text-orange-700">
              ⌨ Режим ввода с клавиатуры
            </div>
          )}
          {audioPlaying && (
            <div className="mx-4 mb-3">
              <button
                type="button"
                onClick={stopAssistantAudio}
                className={`w-full rounded-2xl px-4 py-4 text-sm font-semibold shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  interactionMode === 'voice'
                    ? 'bg-emerald-600 text-white shadow-emerald-300/60 focus:ring-emerald-400'
                    : 'bg-slate-700 text-white shadow-slate-400/60 focus:ring-slate-500'
                }`}
              >
                Пропустить воспроизведение
              </button>
            </div>
          )}
          <ChatPanel messages={messages} />
          <SuggestionsBar suggestions={suggestions} onSelect={sendText} />
          <InputBar
            onSendText={sendText}
            interactionMode={interactionMode}
            onModeChange={handleModeChange}
            voiceMode={voiceMode}
            vadState={vadState}
            disabled={!connected && !debugStubMode}
          />
        </div>
      </div>
    </div>
  );
};
