import { useEffect, useState } from 'react';
import { KIOSK_CONFIG } from '../config/kiosk';
import { withApiBase } from '../config/runtime';

interface WeatherState {
  temp: number | null;
  code: string | null;
  loading: boolean;
}

const CONDITION_LABELS: Record<string, string> = {
  clear: 'Ясно',
  'partly-cloudy': 'Переменная облачность',
  cloudy: 'Облачно',
  overcast: 'Пасмурно',
  drizzle: 'Морось',
  'light-rain': 'Небольшой дождь',
  rain: 'Дождь',
  'heavy-rain': 'Сильный дождь',
  showers: 'Ливень',
  'wet-snow': 'Мокрый снег',
  'light-snow': 'Небольшой снег',
  snow: 'Снег',
  hail: 'Град',
  thunderstorm: 'Гроза',
  'thunderstorm-with-rain': 'Гроза с дождём',
  'thunderstorm-with-hail': 'Гроза с градом',
};

export function weatherLabel(condition: string | null): string {
  if (!condition) return '—';
  return CONDITION_LABELS[condition] ?? condition;
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    temp: null,
    code: null,
    loading: true,
  });

  useEffect(() => {
    const { latitude, longitude } = KIOSK_CONFIG.weather;
    const url = withApiBase(`/api/weather/current?lat=${latitude}&lon=${longitude}`);
    let cancelled = false;

    const load = () => fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('weather request failed');
        return response.json();
      })
      .then(data => {
        if (cancelled) return;
        setState({
          temp: typeof data?.temp === 'number' ? data.temp : null,
          code: typeof data?.condition === 'string' ? data.condition : null,
          loading: false,
        });
      });

    void load().catch(() => {
      if (!cancelled) setState(current => ({ ...current, loading: false }));
    });

    const refresh = window.setInterval(() => {
      void load().catch(() => {});
    }, 30 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, []);

  return {
    ...state,
    label: weatherLabel(state.code),
    place: KIOSK_CONFIG.weather.label,
  };
}
