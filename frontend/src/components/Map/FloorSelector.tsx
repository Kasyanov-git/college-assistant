// frontend/src/components/Map/FloorSelector.tsx

import React from 'react';

interface Props {
  floors: number[];
  current: number;
  routeFloors?: number[];
  onSelect: (f: number) => void;
}

export const FloorSelector: React.FC<Props> = ({ floors, current, routeFloors, onSelect }) => (
  <div className="flex gap-1.5 glass rounded-xl p-1.5 shadow-sm border border-lavender-100">
    {floors.map(f => (
      <button key={f} onClick={() => onSelect(f)}
        className={`w-9 h-9 rounded-lg font-bold text-sm transition-all ${
          f === current
            ? 'bg-lavender-600 text-white shadow-md'
            : routeFloors?.includes(f)
              ? 'bg-lavender-200 text-lavender-700'
              : 'text-lavender-500 hover:bg-lavender-50'
        }`}
      >{f}</button>
    ))}
  </div>
);