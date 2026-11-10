// frontend/src/components/SidePanel/SidePanel.tsx

import React, { useState, useEffect } from 'react';
import { InteractiveMap } from '../Map/InteractiveMap';
import { useStore } from '../../store/assistantStore';

interface Props {
  onRoomClick?: (id: string) => void;
}

export const SidePanel: React.FC<Props> = ({ onRoomClick }) => {
  const [time, setTime] = useState(new Date());
  const activeRoute = useStore((s) => s.activeRoute);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="h-full flex flex-col gap-3 p-3">
      {/* Map */}
      <div className="flex-1 bg-white/70 rounded-2xl shadow-lg border border-lavender-100 overflow-hidden min-h-0">
        <InteractiveMap onRoomClick={onRoomClick} />
      </div>

      {/* Route info */}
      {activeRoute && (
        <div className="bg-lavender-50 rounded-xl p-3 border border-lavender-200 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">🗺</span>
            <div>
              <p className="text-sm font-semibold text-lavender-800">{activeRoute.destination_label}</p>
              <p className="text-xs text-lavender-500">{activeRoute.target_floor} этаж · {activeRoute.estimated_time}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info card */}
      <div className="bg-white/70 rounded-2xl p-4 shadow-sm border border-lavender-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold text-lavender-700">{timeStr}</span>
          <span className="text-xs text-lavender-400 capitalize">{dateStr}</span>
        </div>
        <div className="space-y-1.5 text-xs text-lavender-600">
          <div className="flex items-center gap-2">
            <span>🏫</span>
            <span>Технологический колледж</span>
          </div>
          <div className="flex items-center gap-2">
            <span>🕐</span>
            <span>Работаем: 8:00 – 20:00</span>
          </div>
          <div className="flex items-center gap-2">
            <span>📞</span>
            <span>+7 (495) 123-45-67</span>
          </div>
        </div>
      </div>
    </div>
  );
};