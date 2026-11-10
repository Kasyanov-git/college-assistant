// frontend/src/hooks/useAudioRecorder.ts

import { useCallback, useRef } from 'react';
import { useStore } from '../store/assistantStore';

const SILENCE_THRESHOLD = 0.012;
const SILENCE_TIMEOUT_SEC = 2.0;
const MIN_RECORDING_SEC = 0.5;

export function useAudioRecorder(onComplete: (base64: string) => void) {
  // ═══ Стабильная ссылка на callback через ref ═══
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isRecording = useStore(s => s.isRecording);
  const setIsRecording = useStore(s => s.setIsRecording);
  const setAudioLevel = useStore(s => s.setAudioLevel);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const silenceFramesRef = useRef(0);
  const hasSpokenRef = useRef(false);
  const activeRef = useRef(false);
  const startTimeRef = useRef(0);

  const stopAndSend = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;

    const sampleRate = audioCtxRef.current?.sampleRate || 48000;

    try {
      processorRef.current?.disconnect();
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    } catch {}

    setIsRecording(false);
    setAudioLevel(0);

    const chunks = chunksRef.current;
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    if (chunks.length === 0 || elapsed < MIN_RECORDING_SEC) return;

    const totalLen = chunks.reduce((a, c) => a + c.length, 0);
    const merged = new Float32Array(totalLen);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

    const pcm16k = downsample(merged, sampleRate, 16000);
    const wav = encodeWAV(pcm16k, 16000);
    onCompleteRef.current(arrayBufferToBase64(wav));
  }, [setIsRecording, setAudioLevel]);  // Стабильные deps!

  const start = useCallback(async () => {
    if (useStore.getState().voiceMode) return;
    if (activeRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      chunksRef.current = [];
      silenceFramesRef.current = 0;
      hasSpokenRef.current = false;
      activeRef.current = true;
      startTimeRef.current = Date.now();

      const frameDur = 4096 / ctx.sampleRate;

      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        if (!activeRef.current) return;
        const input = ev.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(input));

        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        setAudioLevel(Math.min(1, rms * 10));

        if (rms > SILENCE_THRESHOLD) { silenceFramesRef.current = 0; hasSpokenRef.current = true; }
        else { silenceFramesRef.current++; }

        if (hasSpokenRef.current && silenceFramesRef.current * frameDur > SILENCE_TIMEOUT_SEC) {
          stopAndSend();
        }
      };

      source.connect(processor);
      processor.connect(ctx.destination);
      audioCtxRef.current = ctx;
      processorRef.current = processor;
      streamRef.current = stream;
      setIsRecording(true);
    } catch (err) {
      console.error('[Rec] Mic error:', err);
      setIsRecording(false);
    }
  }, [setIsRecording, setAudioLevel, stopAndSend]);

  const stop = useCallback(() => {
    stopAndSend();
  }, [stopAndSend]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  return { isRecording, start, stop, toggle };
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