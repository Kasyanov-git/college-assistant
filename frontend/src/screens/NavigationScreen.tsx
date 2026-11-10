import React, { useEffect } from 'react';
import { useStore } from '../store/assistantStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { InteractiveMap } from '../components/Map/InteractiveMap';
import { ScreenShell } from '../components/Layout/ScreenShell';
import { withApiBase } from '../config/runtime';

export const NavigationScreen: React.FC = () => {
  const activeRoute = useStore(s => s.activeRoute);
  const setMapNodes = useStore(s => s.setMapNodes);
  const setMapEdges = useStore(s => s.setMapEdges);
  const setTotalFloors = useStore(s => s.setTotalFloors);
  const setFloorsOutline = useStore(s => s.setFloorsOutline);

  const { sendMapTap } = useWebSocket();

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

  return (
    <ScreenShell
      title="Маршрут по колледжу"
      subtitle="Выберите кабинет на карте или спросите помощника на главном экране"
    >
      <div className="h-full flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {activeRoute && (
          <div className="px-5 py-3 border-b border-slate-100 bg-brand-50/50 flex items-center gap-3">
            <span className="text-sm font-semibold text-brand-800">Активный маршрут</span>
            <span className="text-sm text-slate-700 font-medium">{activeRoute.destination_label}</span>
            <span className="text-sm text-slate-500">
              {activeRoute.target_floor} этаж · ~{activeRoute.estimated_time}
            </span>
          </div>
        )}
        <div className="flex-1 min-h-0 p-2">
          <InteractiveMap onRoomClick={sendMapTap} />
        </div>
      </div>
    </ScreenShell>
  );
};
