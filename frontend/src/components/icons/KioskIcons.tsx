import React from 'react';

type IconProps = { className?: string };

export const IconSearch: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
  </svg>
);

export const IconRoute: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z" />
    <circle cx="12" cy="11" r="2.5" />
  </svg>
);

export const IconMic: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
  </svg>
);

export const IconInfo: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10v6M12 8h.01" strokeLinecap="round" />
  </svg>
);

export const IconCalendar: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
  </svg>
);

export const IconGlobe: React.FC<IconProps> = ({ className = 'w-7 h-7' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
  </svg>
);

export const IconBack: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSend: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconWave: React.FC<IconProps> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M4 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" strokeLinecap="round" />
  </svg>
);

export const CollegeLogo: React.FC<IconProps> = ({ className = 'w-9 h-9' }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none">
    <rect width="40" height="40" rx="10" fill="#6B4EAA" />
    <path
      d="M12 28V14l8-5 8 5v14h-5v-8h-6v8h-5z"
      fill="white"
      fillOpacity="0.95"
    />
  </svg>
);

export function weatherIcon(condition: string | null): string {
  if (!condition) return '—';
  if (condition === 'clear') return '☀';
  if (condition.includes('thunderstorm')) return '⛈';
  if (condition.includes('snow')) return '❄';
  if (condition === 'fog') return '🌫';
  if (condition.includes('rain') || condition === 'drizzle' || condition === 'showers') return '🌧';
  if (condition === 'partly cloudy') return '⛅';
  return '☁';
}
