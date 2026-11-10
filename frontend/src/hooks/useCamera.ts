// frontend/src/hooks/useCamera.ts

import { useCallback, useEffect, useRef, useState } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (videoEl: HTMLVideoElement) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      videoRef.current = videoEl;
      setActive(true);
      setError(null);
    } catch (e: any) {
      setError('Камера недоступна');
      console.warn('[Camera]', e.message);
    }
  }, []);

  const stop = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { start, stop, active, error };
}