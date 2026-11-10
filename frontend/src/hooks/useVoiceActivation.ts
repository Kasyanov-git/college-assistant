// frontend/src/hooks/useVoiceActivation.ts

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store/assistantStore';

const SPEECH_THRESHOLD = 0.015;
const SILENCE_TIMEOUT_MS = 2000;
const MIN_SPEECH_MS = 400;
const COOLDOWN_MS = 1500;

export function useVoiceActivation(onRecordingComplete: (base64: string) => void) {
  // ═══ Стабильная ссылка на callback ═══
  const onCompleteRef = useRef(onRecordingComplete);
  onCompleteRef.current = onRecordingComplete;

  // Селекторы — стабильные
  const voiceMode = useStore(s => s.voiceMode);
  const setVoiceMode = useStore(s => s.setVoiceMode);
  const vadState = useStore(s => s.vadState);
  const setVadState = useStore(s => s.setVadState);
  const setAudioLevel = useStore(s => s.setAudioLevel);
  const setIsRecording = useStore(s => s.setIsRecording);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const stateRef = useRef<'monitoring' | 'recording' | 'cooldown'>('monitoring');
  const silenceStartRef = useRef(0);
  const speechStartRef = useRef(0);
  const activeRef = useRef(false);

  // ═══ Cleanup (стабильная через ref pattern) ═══
  const cleanup = useCallback(() => {
    if (!activeRef.current) return;      // <-- Предотвращает лишние set()
    activeRef.current = false;
    try {
      processorRef.current?.disconnect();
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    } catch {}
    processorRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    setAudioLevel(0);
    setIsRecording(false);
    setVadState('off');
  }, [setAudioLevel, setIsRecording, setVadState]);

  // ═══ Send buffer ═══
  const sendBuffer = useCallback(() => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) return;

    const totalLen = chunks.reduce((a, c) => a + c.length, 0);
    const merged = new Float32Array(totalLen);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

    const sampleRate = audioCtxRef.current?.sampleRate || 48000;
    const pcm16k = downsample(merged, sampleRate, 16000);
    if (pcm16k.length < 16000 * 0.3) return;

    const wav = encodeWAV(pcm16k, 16000);
    const b64 = arrayBufferToBase64(wav);
    onCompleteRef.current(b64);          // <-- ref, стабильный
  }, []);  // <-- пустые deps! callback через ref

  // ═══ Start listening ═══
  const startListening = useCallback(async () => {
    if (activeRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      stateRef.current = 'monitoring';
      activeRef.current = true;
      chunksRef.current = [];

      setVadState('monitoring');

      const frameDuration = 4096 / ctx.sampleRate;

      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        if (!activeRef.current) return;

        // Пропускаем, пока ассистент говорит или думает
        const assistantState = useStore.getState().state;
        if (assistantState === 'speaking' || assistantState === 'thinking') {
          if (stateRef.current === 'recording') {
            chunksRef.current = [];
            stateRef.current = 'monitoring';
            setVadState('monitoring');
            setIsRecording(false);
          }
          return;
        }

        if (stateRef.current === 'cooldown') return;

        const input = ev.inputBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        setAudioLevel(Math.min(1, rms * 10));

        const now = Date.now();
        const isSpeech = rms > SPEECH_THRESHOLD;

        if (stateRef.current === 'monitoring') {
          if (isSpeech) {
            stateRef.current = 'recording';
            setVadState('recording');
            setIsRecording(true);
            chunksRef.current = [];
            speechStartRef.current = now;
            silenceStartRef.current = 0;
            chunksRef.current.push(new Float32Array(input));
          }
        } else if (stateRef.current === 'recording') {
          chunksRef.current.push(new Float32Array(input));

          if (isSpeech) {
            silenceStartRef.current = 0;
          } else {
            if (silenceStartRef.current === 0) silenceStartRef.current = now;
            const silenceDur = now - silenceStartRef.current;
            const speechDur = now - speechStartRef.current;

            if (silenceDur > SILENCE_TIMEOUT_MS && speechDur > MIN_SPEECH_MS) {
              stateRef.current = 'cooldown';
              setVadState('cooldown');
              setIsRecording(false);

              sendBuffer();

              setTimeout(() => {
                if (activeRef.current) {
                  stateRef.current = 'monitoring';
                  setVadState('monitoring');
                  chunksRef.current = [];
                }
              }, COOLDOWN_MS);
            }
          }
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      audioCtxRef.current = ctx;
      processorRef.current = processor;
      streamRef.current = stream;

      console.log('[VoiceActivation] Started, sampleRate:', ctx.sampleRate);
    } catch (err) {
      console.error('[VoiceActivation] Mic error:', err);
      activeRef.current = false;
      setVadState('off');
    }
  }, [setVadState, setAudioLevel, setIsRecording, sendBuffer]);
  // ☝️ Все deps стабильны — хук не пересоздаётся

  // ═══ Effect: start/stop на основе voiceMode ═══
  useEffect(() => {
    if (voiceMode) {
      startListening();
    } else {
      cleanup();
    }
    return () => { cleanup(); };
  }, [voiceMode]);
  // ☝️ Только voiceMode в deps! startListening и cleanup стабильны

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode(!useStore.getState().voiceMode);
  }, [setVoiceMode]);

  return { voiceMode, vadState, toggleVoiceMode };
}

// ─── Audio utils ─────────────────────────────────────

function downsample(buf: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return buf;
  const r = from / to, len = Math.round(buf.length / r), out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const s = i * r, lo = Math.floor(s), hi = Math.min(lo + 1, buf.length - 1), f = s - lo;
    out[i] = buf[lo] * (1 - f) + buf[hi] * f;
  }
  return out;
}

function encodeWAV(samples: Float32Array, sr: number): ArrayBuffer {
  const ds = samples.length * 2, buf = new ArrayBuffer(44 + ds), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0,'RIFF'); v.setUint32(4,36+ds,true); w(8,'WAVE'); w(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true);
  v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,ds,true);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, s < 0 ? s*0x8000 : s*0x7FFF, true); o += 2;
  }
  return buf;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return btoa(s);
}