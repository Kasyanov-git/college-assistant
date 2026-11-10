// frontend/src/store/assistantStore.ts

import { create } from 'zustand';
import type { Message, AssistantState, RouteData, MapNode, MapEdge } from '../types';
import type { AppScreen } from '../config/kiosk';

interface Store {
  appScreen: AppScreen;
  setAppScreen: (screen: AppScreen) => void;
  pendingVoiceMode: boolean;
  setPendingVoiceMode: (enabled: boolean) => void;

  state: AssistantState;
  setState: (s: AssistantState) => void;

  messages: Message[];
  addMessage: (m: Message) => void;
  clearMessages: () => void;

  currentFloor: number;
  setCurrentFloor: (f: number) => void;
  totalFloors: number;
  setTotalFloors: (f: number) => void;
  activeRoute: RouteData | null;
  setActiveRoute: (r: RouteData | null) => void;
  mapNodes: MapNode[];
  setMapNodes: (n: MapNode[]) => void;
  mapEdges: MapEdge[];
  setMapEdges: (e: MapEdge[]) => void;

  suggestions: string[];
  setSuggestions: (s: string[]) => void;

  // Recording
  isRecording: boolean;
  setIsRecording: (r: boolean) => void;
  audioLevel: number;
  setAudioLevel: (l: number) => void;

  // Voice activation
  voiceMode: boolean;
  setVoiceMode: (v: boolean) => void;
  vadState: 'off' | 'monitoring' | 'recording' | 'cooldown';
  setVadState: (s: 'off' | 'monitoring' | 'recording' | 'cooldown') => void;

  audioPlaying: boolean;
  setAudioPlaying: (playing: boolean) => void;

  connected: boolean;
  setConnected: (c: boolean) => void;
  notification: string | null;
  setNotification: (message: string | null) => void;

  // Debug stubs (avoid LLM/TTS calls while developing)
  debugStubMode: boolean;
  setDebugStubMode: (enabled: boolean) => void;

  // Floor outlines
  floorsOutline: Record<string, { x: number; y: number; w: number; h: number }>;
  setFloorsOutline: (o: Record<string, { x: number; y: number; w: number; h: number }>) => void;
}

export const useStore = create<Store>((set) => ({
  appScreen: 'home',
  setAppScreen: (screen) => set((state) => screen === 'assistant'
    ? { appScreen: screen }
    : {
        appScreen: screen,
        voiceMode: false,
        vadState: 'off',
        isRecording: false,
        audioLevel: 0,
        messages: [],
        activeRoute: null,
      }),
  pendingVoiceMode: false,
  setPendingVoiceMode: (enabled) => set({ pendingVoiceMode: enabled }),

  state: 'idle',
  setState: (s) => set({ state: s }),

  messages: [],
  addMessage: (m) => set((prev) => ({ messages: [...prev.messages.slice(-100), m] })),
  clearMessages: () => set({ messages: [] }),

  currentFloor: 2,
  setCurrentFloor: (f) => set({ currentFloor: f }),
  totalFloors: 3,
  setTotalFloors: (f) => set({ totalFloors: f }),
  activeRoute: null,
  setActiveRoute: (r) => set({ activeRoute: r }),
  mapNodes: [],
  setMapNodes: (n) => set({ mapNodes: n }),
  mapEdges: [],
  setMapEdges: (e) => set({ mapEdges: e }),

  suggestions: [
    'Как пройти в библиотеку?', 'Расскажи о колледже',
    'Какие специальности?', 'Где приёмная комиссия?',
  ],
  setSuggestions: (s) => set({ suggestions: s }),

  isRecording: false,
  setIsRecording: (r) => set({ isRecording: r }),
  audioLevel: 0,
  setAudioLevel: (l) => set({ audioLevel: l }),

  voiceMode: false,
  setVoiceMode: (v) => set({ voiceMode: v }),
  vadState: 'off',
  setVadState: (s) => set({ vadState: s }),

  audioPlaying: false,
  setAudioPlaying: (playing) => set({ audioPlaying: playing }),

  connected: false,
  setConnected: (c) => set({ connected: c }),
  notification: null,
  setNotification: (message) => set({ notification: message }),

  debugStubMode: typeof window !== 'undefined' ? localStorage.getItem('debug_stub_mode') === '1' : false,
  setDebugStubMode: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('debug_stub_mode', enabled ? '1' : '0');
    }
    set({ debugStubMode: enabled });
  },

  floorsOutline: {},
  setFloorsOutline: (o) => set({ floorsOutline: o }),
}));