/**
 * Одно именованное окно на слот (сайт / расписание и т.д.).
 * Повторный вызов фокусирует то же окно вместо спама вкладками.
 */

const COOLDOWN_MS = 2500;

/** Не fullscreen: обычное окно с рамкой, можно закрыть */
const POPUP_FEATURES = [
  'width=1280',
  'height=860',
  'left=120',
  'top=80',
  'resizable=yes',
  'scrollbars=yes',
  'toolbar=no',
  'menubar=no',
  'location=yes',
  'status=no',
].join(',');

type SlotState = {
  win: Window | null;
  lastAttempt: number;
};

const slots = new Map<string, SlotState>();

export type OpenExternalResult = 'opened' | 'focused' | 'cooldown' | 'blocked';

function getSlot(slot: string): SlotState {
  let s = slots.get(slot);
  if (!s) {
    s = { win: null, lastAttempt: 0 };
    slots.set(slot, s);
  }
  return s;
}

/** Имя окна — стабильное для слота, чтобы браузер переиспользовал одно окно */
function windowName(slot: string): string {
  return `kiosk-external-${slot}`;
}

export function openExternalWindow(slot: string, url: string): OpenExternalResult {
  const now = Date.now();
  const state = getSlot(slot);

  const existing = state.win;
  if (existing && !existing.closed) {
    if (now - state.lastAttempt < COOLDOWN_MS) {
      try {
        existing.focus();
      } catch {
        /* cross-origin */
      }
      return 'cooldown';
    }

    try {
      existing.focus();
      if (existing.location.href !== url) {
        existing.location.href = url;
      }
    } catch {
      state.win = window.open(url, windowName(slot), POPUP_FEATURES);
    }
    state.lastAttempt = now;
    return 'focused';
  }

  if (now - state.lastAttempt < COOLDOWN_MS) {
    return 'cooldown';
  }

  const win = window.open(url, windowName(slot), POPUP_FEATURES);
  state.lastAttempt = now;

  if (!win) {
    return 'blocked';
  }

  state.win = win;
  return 'opened';
}

export function focusExternalWindow(slot: string): boolean {
  const state = slots.get(slot);
  if (!state?.win || state.win.closed) return false;
  try {
    state.win.focus();
    return true;
  } catch {
    return false;
  }
}
