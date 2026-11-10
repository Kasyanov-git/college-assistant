// frontend/src/components/Map/InteractiveMap.tsx

import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useStore } from '../../store/assistantStore';
import { FloorSelector } from './FloorSelector';
import type { MapNode } from '../../types';

// ─── Styling ─────────────────────────────────────────
const ROOM_FILLS: Record<string, { fill: string; stroke: string; icon: string }> = {
  classroom:      { fill: '#ede9fe', stroke: '#a78bfa', icon: '' },
  office:    { fill: '#fef3c7', stroke: '#f59e0b', icon: '📎' },
  lab:       { fill: '#d1fae5', stroke: '#34d399', icon: '💻' },
  cafeteria: { fill: '#fee2e2', stroke: '#f87171', icon: '🍽' },
  library:   { fill: '#e0e7ff', stroke: '#818cf8', icon: '📚' },
  gym:       { fill: '#cffafe', stroke: '#22d3ee', icon: '🏃' },
  wc:        { fill: '#f1f5f9', stroke: '#94a3b8', icon: '🚻' },
  stairs:    { fill: '#fef9c3', stroke: '#facc15', icon: '▤' },
  entrance:  { fill: '#dcfce7', stroke: '#4ade80', icon: '🚪' },
  hall:      { fill: '#f5f3ff', stroke: '#c4b5fd', icon: '' },
  corridor:  { fill: '#faf5ff', stroke: '#e9d5ff', icon: '' },
};

const CLICKABLE = new Set(['classroom', 'office', 'lab', 'locker', 'hall', 'coworking', 'cafeteria', 'conference', 'gym', 'wc', 'cloakroom']);

// ─── Component ───────────────────────────────────────
interface Props { onRoomClick?: (id: string) => void; }

export const InteractiveMap: React.FC<Props> = ({ onRoomClick }) => {
  const {
    mapNodes, mapEdges,
    currentFloor, setCurrentFloor,
    activeRoute, totalFloors, floorsOutline,
  } = useStore();

  const floors = useMemo(() => Array.from({ length: totalFloors }, (_, i) => i + 1), [totalFloors]);
  const svgRef = useRef<SVGSVGElement>(null);

  // ─── Pan & Zoom state ─────────────────────────────
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; viewX: number; viewY: number }>({
    active: false, startX: 0, startY: 0, viewX: 0, viewY: 0,
  });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setView(prev => {
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const newScale = Math.max(0.4, Math.min(4, prev.scale * factor));
      const ratio = newScale / prev.scale;
      return {
        x: mx - (mx - prev.x) * ratio,
        y: my - (my - prev.y) * ratio,
        scale: newScale,
      };
    });
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, viewX: view.x, viewY: view.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [view]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setView(prev => ({ ...prev, x: dragRef.current.viewX + dx, y: dragRef.current.viewY + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current.active = false;
  }, []);

  // ─── Data ─────────────────────────────────────────
  const floorNodes = useMemo(() => mapNodes.filter(n => n.floor === currentFloor), [mapNodes, currentFloor]);
  const nodeMap = useMemo(() => Object.fromEntries(mapNodes.map(n => [n.id, n])), [mapNodes]);
  const outline = floorsOutline[String(currentFloor)];

  const fitToFloor = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !outline) {
      setView({ x: 0, y: 0, scale: 1 });
      return;
    }

    // Pan/zoom transform is applied in SVG user space (viewBox coords), not CSS pixels.
    const vb = svg.viewBox.baseVal;
    const viewportW = vb && vb.width ? vb.width : 1000;
    const viewportH = vb && vb.height ? vb.height : 700;
    const padding = 24;

    const scaleX = (viewportW - padding * 2) / outline.w;
    const scaleY = (viewportH - padding * 2) / outline.h;
    const scale = Math.max(0.4, Math.min(4, Math.min(scaleX, scaleY)));

    const x = (viewportW - outline.w * scale) / 2 - outline.x * scale;
    const y = (viewportH - outline.h * scale) / 2 - outline.y * scale;
    setView({ x, y, scale });
  }, [outline]);

  // Auto-fit map on first render, floor switch and viewport resize.
  useEffect(() => {
    const raf = window.requestAnimationFrame(fitToFloor);
    const onResize = () => fitToFloor();
    window.addEventListener('resize', onResize);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [fitToFloor, currentFloor]);

  const routePoints = useMemo(
    () => activeRoute?.path.filter(p => p.floor === currentFloor) || [],
    [activeRoute, currentFloor],
  );
  const routePath = useMemo(
    () => routePoints.length < 2 ? '' : routePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' '),
    [routePoints],
  );
  const routeNodes = activeRoute?.path_nodes || [];
  const lastRouteNode = routeNodes.length ? routeNodes[routeNodes.length - 1] : null;
  const lastRoutePoint = routePoints.length ? routePoints[routePoints.length - 1] : null;
  const destId =
    lastRouteNode?.node_id ||
    (activeRoute?.path && activeRoute.path.length ? activeRoute.path[activeRoute.path.length - 1].node_id : undefined);

  // Sort: corridors first, then other nodes, route-related last
  const sortedNodes = useMemo(() => {
    const order: Record<string, number> = { corridor: 0, hall: 1 };
    return [...floorNodes].sort((a, b) => {
      const oa = order[a.type] ?? 2;
      const ob = order[b.type] ?? 2;
      return oa - ob;
    });
  }, [floorNodes]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-white/60 shadow-lg border border-lavender-100">

      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between">
        <div className="glass rounded-xl px-4 py-2 shadow-sm border border-lavender-100">
          <span className="font-bold text-lavender-800">{currentFloor} этаж</span>
          {activeRoute && (
            <span className="ml-2 text-sm text-lavender-500">
              → {activeRoute.destination_label} · {activeRoute.estimated_time}
            </span>
          )}
        </div>
        <FloorSelector
          floors={floors} current={currentFloor}
          routeFloors={activeRoute?.floors} onSelect={setCurrentFloor}
        />
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
        <button onClick={() => setView(v => ({ ...v, scale: Math.min(4, v.scale * 1.3) }))}
          className="w-9 h-9 rounded-lg glass shadow border border-lavender-200 text-lavender-700 font-bold text-lg hover:bg-lavender-50">+</button>
        <button onClick={() => setView(v => ({ ...v, scale: Math.max(0.4, v.scale * 0.77) }))}
          className="w-9 h-9 rounded-lg glass shadow border border-lavender-200 text-lavender-700 font-bold text-lg hover:bg-lavender-50">−</button>
        <button onClick={fitToFloor}
          className="w-9 h-9 rounded-lg glass shadow border border-lavender-200 text-lavender-600 text-sm hover:bg-lavender-50">⟲</button>
        {activeRoute && (
          <button onClick={() => useStore.getState().setActiveRoute(null)}
            className="w-9 h-9 rounded-lg glass shadow border border-red-200 text-red-500 text-sm hover:bg-red-50">✕</button>
        )}
      </div>

      {/* SVG */}
      <svg
        ref={svgRef}
        viewBox="0 0 1000 700"
        className="w-full h-full select-none"
        style={{ cursor: dragRef.current.active ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <defs>
          <filter id="roomShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#7c3aed" floodOpacity="0.08" />
          </filter>
          <pattern id="stairsPattern" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#facc15" strokeWidth="2" />
          </pattern>
          <pattern id="gridDots" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="0.5" fill="#d4d4d8" />
          </pattern>
        </defs>

        {/* Transform group for pan/zoom */}
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>

          {/* Background */}
          <rect x="0" y="0" width="1000" height="700" fill="url(#gridDots)" />

          {/* Building outline */}
          {outline && (
            <rect
              x={outline.x} y={outline.y} width={outline.w} height={outline.h}
              rx="12" fill="white" stroke="#c4b5fd" strokeWidth="3"
              filter="url(#roomShadow)"
            />
          )}

          {/* Rooms & Areas */}
          {sortedNodes.map(node => {
            const style = ROOM_FILLS[node.type] || ROOM_FILLS.classroom;
            const w = node.w || 100;
            const h = node.h || 70;
            const rx = node.x - w / 2;
            const ry = node.y - h / 2;
            const isClickable = CLICKABLE.has(node.type);
            const isOnRoute = routeNodes.some(rp => rp.node_id === node.id);
            const isDest = node.id === destId && node.floor === currentFloor;
            const dim = activeRoute && !isOnRoute;

            return (
              <g key={node.id}
                onClick={() => isClickable && onRoomClick?.(node.id)}
                className={isClickable ? 'cursor-pointer' : ''}
                opacity={dim ? 0.35 : 1}
              >
                {/* Destination glow */}
                {isDest && (
                  <rect x={rx - 6} y={ry - 6} width={w + 12} height={h + 12}
                    rx="10" fill="none" stroke="#8b5cf6" strokeWidth="3" opacity="0.4">
                    <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.5s" repeatCount="indefinite" />
                  </rect>
                )}

                {/* classroom rect */}
                <rect
                  x={rx} y={ry} width={w} height={h}
                  rx={node.type === 'corridor' ? 4 : 8}
                  fill={node.type === 'stairs' ? 'url(#stairsPattern)' : style.fill}
                  stroke={isDest ? '#7c3aed' : isOnRoute ? '#8b5cf6' : style.stroke}
                  strokeWidth={isDest ? 2.5 : isOnRoute ? 2 : node.type === 'corridor' ? 0.5 : 1.2}
                  filter={node.type !== 'corridor' ? 'url(#roomShadow)' : undefined}
                />

                {/* Icon (top-left inside classroom) */}
                {style.icon && node.type !== 'corridor' && (
                  <text x={rx + 8} y={ry + 16} fontSize="12" className="pointer-events-none">
                    {style.icon}
                  </text>
                )}

                {/* classroom number / label */}
                {node.type !== 'corridor' && (
                  <>
                    <text
                      x={node.x} y={node.y - (node.name ? 4 : 0)}
                      textAnchor="middle" dominantBaseline="central"
                      fontSize={node.type === 'classroom' || node.type === 'lab' ? '18' : '13'}
                      fontWeight="bold"
                      fill={isDest ? '#7c3aed' : '#374151'}
                      className="pointer-events-none select-none"
                    >
                      {node.label}
                    </text>
                    {/* Sub-label (classroom name) */}
                    {node.name && (
                      <text
                        x={node.x} y={node.y + 14}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize="9" fill="#6b7280"
                        className="pointer-events-none select-none"
                      >
                        {node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name}
                      </text>
                    )}
                  </>
                )}

                {/* Door marker (small gap on corridor side) */}
                {isClickable && node.type !== 'wc' && (
                  <rect
                    x={node.x - 8} y={ry + h - 2}
                    width={16} height={4} rx={2}
                    fill={style.stroke} opacity="0.5"
                  />
                )}
              </g>
            );
          })}

          {/* Route path */}
          {routePath && (
            <>
              <path d={routePath} fill="none" stroke="#8b5cf6" strokeWidth="8"
                strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
              <path d={routePath} fill="none" stroke="#8b5cf6" strokeWidth="4"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="14 7" className="route-line-animated" />
            </>
          )}

          {/* Route start marker */}
          {routePoints.length > 0 && (
            <g>
              <circle cx={routePoints[0].x} cy={routePoints[0].y} r="10"
                fill="#10b981" stroke="white" strokeWidth="2.5" />
              <text x={routePoints[0].x} y={routePoints[0].y + 1}
                textAnchor="middle" dominantBaseline="central" fontSize="11"
                className="pointer-events-none">🤖</text>
            </g>
          )}

          {/* Route dest marker */}
          {destId && lastRoutePoint && lastRoutePoint.node_id === destId && (
            <g>
              <circle cx={lastRoutePoint.x} cy={lastRoutePoint.y} r="12"
                fill="#ef4444" stroke="white" strokeWidth="2.5" />
              <text x={lastRoutePoint.x} y={lastRoutePoint.y + 1}
                textAnchor="middle" dominantBaseline="central" fontSize="12"
                className="pointer-events-none">📍</text>
            </g>
          )}

        </g>
      </svg>
    </div>
  );
};