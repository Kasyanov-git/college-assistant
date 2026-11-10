// frontend/src/hooks/useWebSocket.ts

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store/assistantStore';
import type { AssistantResponsePayload, RouteData, AssistantState } from '../types';
import { getWebSocketUrl, toAbsoluteMediaUrl, withApiBase } from '../config/runtime';
import { playAssistantAudio } from '../utils/audioPlayback';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);

  // Берём ТОЛЬКО сеттеры — они стабильны
  const setConnected = useStore(s => s.setConnected);
  const setState = useStore(s => s.setState);
  const addMessage = useStore(s => s.addMessage);
  const setActiveRoute = useStore(s => s.setActiveRoute);
  const setCurrentFloor = useStore(s => s.setCurrentFloor);
  const setSuggestions = useStore(s => s.setSuggestions);
  const setNotification = useStore(s => s.setNotification);
  const debugStubMode = useStore(s => s.debugStubMode);

  const normalizeRouteData = useCallback((input: any): RouteData => {
    const visualPath = Array.isArray(input?.path) ? input.path : [];
    const pathNodes = Array.isArray(input?.path_nodes)
      ? input.path_nodes
      : Array.isArray(input?.path_details)
        ? input.path_details
        : [];

    return {
      path: visualPath,
      path_nodes: pathNodes,
      target_floor: Number(input?.target_floor ?? 1),
      estimated_time: String(input?.estimated_time ?? ''),
      destination_label: String(input?.destination_label ?? ''),
      floors: Array.isArray(input?.floors) ? input.floors : [],
    };
  }, []);

  const pushAssistantDebugMessage = useCallback((text: string) => {
    addMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      text,
      timestamp: new Date(),
    });
  }, [addMessage]);

  const fetchRouteDebug = useCallback(async (destination: string): Promise<RouteData | null> => {
    try {
      const resp = await fetch(withApiBase('/api/map/route'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return normalizeRouteData(data.route);
    } catch {
      return null;
    }
  }, [normalizeRouteData]);

  const handleMessage = useCallback((event: MessageEvent) => {
    let msg: any;
    try {
      msg = JSON.parse(event.data);
    } catch { return; }

    const { type, payload } = msg;

    switch (type) {
      case 'notification':
        setNotification(payload.text as string);
        window.setTimeout(() => setNotification(null), Number(payload.duration_ms || 4000));
        break;
      case 'state_change':
        setState(payload.state as AssistantState);
        break;

      case 'stt_result':
        addMessage({
          id: crypto.randomUUID(), role: 'user',
          text: payload.text as string, timestamp: new Date(),
        });
        break;

      case 'assistant_response': {
        const resp = payload as AssistantResponsePayload;
        addMessage({
          id: crypto.randomUUID(), role: 'assistant',
          text: resp.text, timestamp: new Date(), ui_actions: resp.ui_actions,
        });

        if (resp.ui_actions) {
          for (const action of resp.ui_actions) {
            if (action.action === 'show_route') {
              const route = normalizeRouteData(action.data);
              setActiveRoute(route);
              setCurrentFloor(route.target_floor);
            }
            if (action.action === 'reset_to_idle') {
              setActiveRoute(null);
            }
          }
        }

        if (resp.suggestions?.length) setSuggestions(resp.suggestions);
        if (resp.audio_url && !useStore.getState().debugStubMode) {
          playAssistantAudio(toAbsoluteMediaUrl(resp.audio_url));
        }
        break;
      }
    }
  }, [setState, addMessage, setActiveRoute, setCurrentFloor, setSuggestions, setNotification, normalizeRouteData]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWebSocketUrl('/api/ws/chat'));

    ws.onopen = () => setConnected(true);
    ws.onmessage = handleMessage;
    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = window.setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      try { ws.close(); } catch {}
    };

    wsRef.current = ws;
  }, [handleMessage, setConnected]);

  useEffect(() => {
    connect();
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: 'ping', payload: {} }));
    }, 30000);
    return () => {
      clearInterval(ping);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // ═══ Стабильные функции отправки (через ref → никогда не меняются) ═══

  const sendText = useCallback((text: string) => {
    const store = useStore.getState();
    store.addMessage({ id: crypto.randomUUID(), role: 'user', text, timestamp: new Date() });
    if (store.debugStubMode) {
      void (async () => {
        setState('thinking');
        const route = await fetchRouteDebug(text);
        if (route) {
          setActiveRoute(route);
          setCurrentFloor(route.target_floor);
          pushAssistantDebugMessage(`(STUB) Маршрут построен до ${route.destination_label}. TTS отключен в debug-режиме.`);
          setSuggestions(['Спасибо!', 'Где туалет?', 'Как пройти в 239?']);
        } else {
          pushAssistantDebugMessage(
            '(STUB) Debug-режим: LLM/TTS отключены. Для навигации используйте номер кабинета, название помещения или клик по карте.'
          );
          setSuggestions(['Как пройти в 243?', 'Где коворкинг?', 'Где учительская?']);
        }
        setState('idle');
      })();
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'text_input', payload: { text } }));
    }
  }, [fetchRouteDebug, pushAssistantDebugMessage, setActiveRoute, setCurrentFloor, setState, setSuggestions]);

  const sendAudio = useCallback((b64: string) => {
    if (useStore.getState().debugStubMode) {
      pushAssistantDebugMessage('(STUB) Голосовой канал отключен в debug-режиме, чтобы не расходовать LLM/TTS.');
      setState('idle');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({
        type: 'audio_chunk', payload: { audio: b64, format: 'wav', is_final: true },
      }));
  }, [pushAssistantDebugMessage, setState]);

  const sendMapTap = useCallback((roomId: string) => {
    if (useStore.getState().debugStubMode) {
      void (async () => {
        setState('thinking');
        const route = await fetchRouteDebug(roomId);
        if (route) {
          setActiveRoute(route);
          setCurrentFloor(route.target_floor);
          pushAssistantDebugMessage(`(STUB) Путь до ${route.destination_label} построен. TTS отключен.`);
          setSuggestions(['Спасибо!', 'Показать другой маршрут', 'Где лестница?']);
        } else {
          pushAssistantDebugMessage('(STUB) Не удалось построить маршрут для выбранной точки.');
        }
        setState('idle');
      })();
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'map_tap', payload: { room_id: roomId } }));
    }
  }, [fetchRouteDebug, pushAssistantDebugMessage, setActiveRoute, setCurrentFloor, setState, setSuggestions]);

  return { sendText, sendAudio, sendMapTap };
}