import React, { useMemo, useState } from 'react';

interface Props {
  onKey: (value: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onClose: () => void;
}

const LETTER_ROWS = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю'],
];

export const VirtualKeyboard: React.FC<Props> = ({
  onKey,
  onBackspace,
  onEnter,
  onClose,
}) => {
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);
  const rows = useMemo(
    () =>
      symbols
        ? [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['-', '_', '+', '=', '/', '\\', '@', '#', '%', '&'],
            ['.', ',', '!', '?', ':', ';', '(', ')', '[', ']', '*'],
          ]
        : LETTER_ROWS,
    [symbols],
  );

  return (
    <div className="mt-3 w-full min-w-0 rounded-2xl border border-slate-300 bg-slate-800 p-2 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
          Экранная клавиатура
        </span>
        <button type="button" onClick={onClose} className="keyboard-key rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-slate-700">
          Закрыть
        </button>
      </div>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="mb-1.5 grid grid-cols-12 gap-1">
          {row.map(key => (
            <button
              type="button"
              key={key}
              onClick={() => onKey(shift && !symbols ? key.toUpperCase() : key)}
              className="keyboard-key col-span-1 min-w-0 rounded-lg bg-slate-700 px-0.5 py-2.5 text-sm font-medium text-white shadow-sm active:bg-brand-600"
            >
              {shift && !symbols ? key.toUpperCase() : key}
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-12 gap-1">
        <button type="button" onClick={() => setShift(value => !value)} className={`keyboard-key col-span-2 rounded-lg px-1 py-2.5 text-xs font-medium text-white ${shift ? 'bg-brand-600' : 'bg-slate-700'}`}>
          Shift
        </button>
        <button type="button" onClick={() => setSymbols(value => !value)} className="keyboard-key col-span-2 rounded-lg bg-slate-700 px-1 py-2.5 text-xs font-medium text-white">
          {symbols ? 'АБВ' : '123'}
        </button>
        <button type="button" onClick={() => onKey(' ')} className="keyboard-key col-span-4 rounded-lg bg-slate-700 px-1 py-2.5 text-xs font-medium text-white">
          Пробел
        </button>
        <button type="button" onClick={onBackspace} className="keyboard-key col-span-1 rounded-lg bg-slate-700 px-1 py-2.5 text-base font-medium text-white">
          ←
        </button>
        <button type="button" onClick={onEnter} className="keyboard-key col-span-3 rounded-lg bg-brand-600 px-1 py-2.5 text-xs font-medium text-white">
          Ввод
        </button>
      </div>
    </div>
  );
};
