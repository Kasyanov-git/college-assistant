import React, { useRef, useEffect } from 'react';
import { useCamera } from '../../hooks/useCamera';

export const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { start, active, error } = useCamera();

  useEffect(() => {
    if (videoRef.current) start(videoRef.current);
  }, [start]);

  return (
    <div className="relative w-36 h-24 rounded-xl overflow-hidden shadow-md border border-slate-200 bg-slate-100">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`w-full h-full object-cover ${active ? '' : 'hidden'}`}
        style={{ transform: 'scaleX(-1)' }}
      />
      {!active && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-[10px] text-center px-2">
          {error || 'Камера…'}
        </div>
      )}
      {active && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/50 rounded-md px-1.5 py-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-white font-medium uppercase tracking-wide">Live</span>
        </div>
      )}
    </div>
  );
};
