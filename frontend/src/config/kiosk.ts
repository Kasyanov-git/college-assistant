// frontend/src/config/kiosk.ts
//
// Настройки инфокиоска. Замените URL ниже на реальные публичные страницы колледжа.

export type AppScreen = 'home' | 'assistant' | 'navigation' | 'about' | 'schedule';

/**
 * iframe — всегда iframe;
 * external — сразу отдельное окно (для сайтов с X-Frame-Options);
 * auto — проверка через /api/embed/can-frame
 */
export type EmbedDisplayMode = 'iframe' | 'external' | 'auto';

export const KIOSK_CONFIG = {
  collegeName: 'Хекслет колледж',
  collegeShortName: 'Хекслет колледж',
  /** Первая строка приветствия на стартовом экране */
  welcomeGreeting: 'Добро пожаловать',
  /** Вторая строка — название колледжа */
  welcomeCollegeLine: 'в Хекслет колледж!',
  welcomeSubtitle:
    'Интерактивный помощник для студентов, преподавателей и гостей колледжа',

  /**
   * Фон стартового экрана.
   * Положите своё фото здания в: frontend/public/images/college-hero.jpg
   * (или .png — тогда поменяйте путь ниже).
   */
  heroImage: '/images/Hexlet.png',

  /**
   * Логотип колледжа на стартовом экране (PNG/SVG с прозрачностью).
   * Файл: frontend/public/images/college-logo.png
   */
  collegeLogoImage: '/images/icon.jpg',

  /**
   * Публичный URL расписания для iframe.
   * Пример: 'https://example-college.ru/schedule'
   * Пустая строка — показывается заглушка вместо iframe.
   */
  scheduleUrl: 'https://site.mstimetables.ru/01a00f53d32773b5b396bf3eb6f57ce2',

  scheduleEmbedMode: 'iframe' as EmbedDisplayMode,

  /** Координаты для виджета погоды (Open-Meteo, без API-ключа) */
  weather: {
    latitude: 59.958551,
    longitude: 30.312791,
    label: 'Санкт-Петербург',
  },

} as const;
