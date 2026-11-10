import React from 'react';

interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export const SuggestionsBar: React.FC<Props> = ({ suggestions, onSelect }) => {
  if (!suggestions.length) return null;

  return (
    <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-slate-100">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(s)}
          className="px-3 py-1.5 text-xs text-slate-700 bg-white rounded-lg
                     border border-slate-200 hover:border-brand-300 hover:bg-brand-50
                     transition-colors active:scale-[0.98]"
        >
          {s}
        </button>
      ))}
    </div>
  );
};
