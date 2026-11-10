// frontend/src/components/Avatar/AnimatedFace.tsx

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { AssistantState } from '../../types';

interface Props {
  state: AssistantState;
  audioLevel: number;
}

export const AnimatedFace: React.FC<Props> = ({ state, audioLevel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [blink, setBlink] = useState(false);
  const [pupilOff, setPupilOff] = useState({ x: 0, y: 0 });
  const [mouthOpen, setMouthOpen] = useState(0);
  const [breathe, setBreathe] = useState(0);

  // ── Blink ──────────────────────────────────
  useEffect(() => {
    const doBlink = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    };
    const id = setInterval(doBlink, 2800 + Math.random() * 2200);
    return () => clearInterval(id);
  }, []);

  // ── Breathing (idle float) ─────────────────
  useEffect(() => {
    let frame: number;
    const t0 = Date.now();
    const animate = () => {
      const t = (Date.now() - t0) / 1000;
      setBreathe(Math.sin(t * 0.8) * 3);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, []);

  // ── Mouth animation (speaking) ─────────────
  useEffect(() => {
    if (state !== 'speaking') {
      setMouthOpen(0);
      return;
    }
    let frame: number;
    const t0 = Date.now();
    const animate = () => {
      const t = (Date.now() - t0) / 1000;
      const v = Math.sin(t * 8) * 0.3 + Math.sin(t * 13.7) * 0.25 + Math.sin(t * 5.3) * 0.2 + 0.35;
      setMouthOpen(Math.max(0.05, Math.min(1, v)));
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [state]);

  // ── Mouth for listening (shows audio level) ──
  useEffect(() => {
    if (state === 'listening') {
      setMouthOpen(audioLevel * 0.6);
    }
  }, [state, audioLevel]);

  // ── Eye tracking (mouse) ───────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height * 0.35;
    const dx = (e.clientX - cx) / rect.width;
    const dy = (e.clientY - cy) / rect.height;
    setPupilOff({
      x: Math.max(-5, Math.min(5, dx * 12)),
      y: Math.max(-4, Math.min(4, dy * 10)),
    });
  }, []);

  // ── Thinking eye animation ─────────────────
  useEffect(() => {
    if (state !== 'thinking') return;
    let frame: number;
    const t0 = Date.now();
    const animate = () => {
      const t = (Date.now() - t0) / 1000;
      setPupilOff({
        x: Math.sin(t * 1.2) * 3,
        y: -2 + Math.cos(t * 0.9) * 2,
      });
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [state]);

  // ── Derived values ─────────────────────────
  const eyeOpenness = blink ? 0.08 : state === 'listening' ? 1.1 : 1;

  // Mouth path
  const mouthY = 134;
  const mouthW = 20;
  const smileH = state === 'idle' || state === 'speaking' ? 8 : 3;
  const openH = mouthOpen * 14;

  // Eyebrow tilt
  const browTilt = state === 'listening' ? -3 : state === 'thinking' ? 3 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="w-full flex items-center justify-center select-none"
      style={{ height: 170 }}
    >
      <svg
        viewBox="0 0 200 180"
        style={{
          width: 200, height: 180,
          transform: `translateY(${breathe}px)`,
          transition: 'transform 0.3s ease',
        }}
      >
        <defs>
          <radialGradient id="faceGrad" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#ede9fe" />
            <stop offset="100%" stopColor="#c4b5fd" />
          </radialGradient>
          <radialGradient id="cheekGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ddd6fe" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ddd6fe" stopOpacity="0" />
          </radialGradient>
          <filter id="fShadow">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#7c3aed" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Head */}
        <ellipse cx="100" cy="95" rx="72" ry="76" fill="url(#faceGrad)"
                 stroke="#a78bfa" strokeWidth="2" filter="url(#fShadow)" />

        {/* Small antenna */}
        <line x1="100" y1="19" x2="100" y2="6" stroke="#a78bfa" strokeWidth="2.5"
              strokeLinecap="round" />
        <circle cx="100" cy="4" r="4" fill="#8b5cf6" />
        {state !== 'idle' && (
          <circle cx="100" cy="4" r="4" fill="#a78bfa" opacity="0.6">
            <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}

        {/* Cheek blush */}
        <ellipse cx="55" cy="115" rx="16" ry="10" fill="url(#cheekGrad)" />
        <ellipse cx="145" cy="115" rx="16" ry="10" fill="url(#cheekGrad)" />

        {/* ── Left Eye ── */}
        <g transform={`translate(72, 82)`}>
          {/* Sclera */}
          <ellipse cx="0" cy="0" rx="17" ry={19 * eyeOpenness}
                   fill="white" stroke="#c4b5fd" strokeWidth="1" />
          {eyeOpenness > 0.2 && (<>
            {/* Iris */}
            <circle cx={pupilOff.x * 0.7} cy={pupilOff.y * 0.7} r="9.5"
                    fill="#7c3aed" />
            {/* Pupil */}
            <circle cx={pupilOff.x} cy={pupilOff.y} r="5"
                    fill="#2e1065" />
            {/* Highlight */}
            <circle cx={pupilOff.x + 3} cy={pupilOff.y - 3} r="2.5"
                    fill="white" opacity="0.9" />
          </>)}
        </g>

        {/* ── Right Eye ── */}
        <g transform={`translate(128, 82)`}>
          <ellipse cx="0" cy="0" rx="17" ry={19 * eyeOpenness}
                   fill="white" stroke="#c4b5fd" strokeWidth="1" />
          {eyeOpenness > 0.2 && (<>
            <circle cx={pupilOff.x * 0.7} cy={pupilOff.y * 0.7} r="9.5"
                    fill="#7c3aed" />
            <circle cx={pupilOff.x} cy={pupilOff.y} r="5"
                    fill="#2e1065" />
            <circle cx={pupilOff.x + 3} cy={pupilOff.y - 3} r="2.5"
                    fill="white" opacity="0.9" />
          </>)}
        </g>

        {/* ── Eyebrows ── */}
        <path d={`M 55 ${65 + browTilt} Q 72 ${58 + browTilt} 89 ${63 + browTilt}`}
              stroke="#7c3aed" strokeWidth="2.5" fill="none" strokeLinecap="round"
              opacity="0.5" />
        <path d={`M 111 ${63 - browTilt} Q 128 ${58 - browTilt} 145 ${65 - browTilt}`}
              stroke="#7c3aed" strokeWidth="2.5" fill="none" strokeLinecap="round"
              opacity="0.5" />

        {/* ── Nose ── */}
        <ellipse cx="100" cy="106" rx="3" ry="2.5" fill="#c4b5fd" opacity="0.5" />

        {/* ── Mouth ── */}
        {openH < 3 ? (
          /* Closed smile */
          <path
            d={`M ${100 - mouthW} ${mouthY} Q 100 ${mouthY + smileH} ${100 + mouthW} ${mouthY}`}
            stroke="#7c3aed" strokeWidth="2.5" fill="none" strokeLinecap="round"
          />
        ) : (
          /* Open mouth */
          <g>
            <path
              d={`M ${100 - mouthW} ${mouthY}
                  Q 100 ${mouthY + openH + 4} ${100 + mouthW} ${mouthY}
                  Q 100 ${mouthY - openH * 0.3} ${100 - mouthW} ${mouthY}`}
              fill="#5b21b6" stroke="#7c3aed" strokeWidth="1.5"
            />
            {/* Tongue hint */}
            {openH > 6 && (
              <ellipse cx="100" cy={mouthY + openH * 0.35} rx={8} ry={openH * 0.2}
                       fill="#c084fc" opacity="0.5" />
            )}
          </g>
        )}

        {/* State indicator dots */}
        {state === 'thinking' && (
          <g>
            <circle cx="88" cy="155" r="2" fill="#a78bfa" opacity="0.6">
              <animate attributeName="opacity" values="0.2;0.8;0.2" dur="0.6s" repeatCount="indefinite" />
            </circle>
            <circle cx="100" cy="155" r="2.5" fill="#a78bfa" opacity="0.6">
              <animate attributeName="opacity" values="0.2;0.8;0.2" dur="0.6s" begin="0.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="112" cy="155" r="2" fill="#a78bfa" opacity="0.6">
              <animate attributeName="opacity" values="0.2;0.8;0.2" dur="0.6s" begin="0.4s" repeatCount="indefinite" />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );
};