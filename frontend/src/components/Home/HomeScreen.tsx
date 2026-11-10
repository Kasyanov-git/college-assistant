import React, { useEffect, useState } from 'react';
import { KIOSK_CONFIG } from '../../config/kiosk';
import type { AppScreen } from '../../config/kiosk';
import { useStore } from '../../store/assistantStore';
import { useClock } from '../../hooks/useClock';
import { HomeWeather } from './HomeWeather';
import { stopAssistantAudio } from '../../utils/audioPlayback';
import {
  IconCalendar,
  IconInfo,
  IconMic,
  IconRoute,
} from '../icons/KioskIcons';

interface NavCard {
  screen: AppScreen;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const NAV_CARDS: NavCard[] = [
  {
    screen: 'assistant',
    title: 'Открыть чат',
    description: 'Перейти к чат-боту',
    icon: <IconMic className="w-10 h-10 text-brand-600" />,
  },
  {
    screen: 'navigation',
    title: 'Маршрут по колледжу',
    description: 'Постройте оптимальный маршрут',
    icon: <IconRoute className="w-10 h-10 text-brand-600" />,
  },
  {
    screen: 'about',
    title: 'О колледже',
    description: 'Структурированные статьи и материалы',
    icon: <IconInfo className="w-10 h-10 text-brand-600" />,
  },
  {
    screen: 'schedule',
    title: 'Расписание',
    description: 'Занятия, мероприятия и события',
    icon: <IconCalendar className="w-10 h-10 text-brand-600" />,
  },
];

export const HomeScreen: React.FC = () => {
  const setAppScreen = useStore(s => s.setAppScreen);
  const setPendingVoiceMode = useStore(s => s.setPendingVoiceMode);
  const [heroFailed, setHeroFailed] = useState(false);
  const { time, dateLine } = useClock();

  useEffect(() => {
    stopAssistantAudio();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-800">
      {!heroFailed && (
        <img
          src={KIOSK_CONFIG.heroImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          onError={() => setHeroFailed(true)}
        />
      )}
      <div
        className={`absolute inset-0 ${
          heroFailed
            ? 'bg-gradient-to-br from-slate-600 via-brand-800 to-brand-900'
            : 'bg-gradient-to-r from-black/60 via-black/40 to-black/25'
        }`}
      />

      <div className="relative z-10 h-full flex flex-col px-8 lg:px-12">
        <header className="flex items-start justify-between py-6 shrink-0 gap-4 lg:gap-6">
          <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-white/22 border border-white/35 backdrop-blur-sm">
            <img
              src={KIOSK_CONFIG.collegeLogoImage}
              alt="Логотип колледжа"
              className="w-12 h-12 object-contain rounded-xl bg-white/80 p-1"
            />
            <div className="text-white leading-tight">
              <div className="text-sm lg:text-base font-semibold">{KIOSK_CONFIG.collegeShortName}</div>
              <div className="text-xs text-white/85">Интерактивный помощник</div>
            </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-6">
            <HomeWeather variant="light" />
            <div className="text-right text-white">
              <div className="text-4xl lg:text-5xl font-light tabular-nums tracking-tight">
                {time}
              </div>
              <div className="text-base lg:text-lg capitalize text-white mt-0.5">
                {dateLine}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-between gap-8 min-h-0 py-4">
          <div className="flex-1 min-w-0 max-w-3xl pr-4">
            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-bold text-white leading-[1.08] drop-shadow-md">
              <span className="block">{KIOSK_CONFIG.welcomeGreeting}</span>
              <span className="block mt-2 lg:mt-3">{KIOSK_CONFIG.welcomeCollegeLine}</span>
            </h1>
            <p className="mt-5 text-xl lg:text-2xl text-white max-w-3xl leading-relaxed">
              {KIOSK_CONFIG.welcomeSubtitle}
            </p>
          </div>

          <div className="shrink-0 self-center mr-12 lg:mr-20">
            <button
              type="button"
              onClick={() => {
                setPendingVoiceMode(true);
                setAppScreen('assistant');
              }}
              className="hero-mic-button hero-mic-blob relative w-[380px] h-[330px] text-white flex flex-col items-center justify-center gap-4"
            >
              <span className="hero-mic-wave hero-mic-wave-1" />
              <span className="hero-mic-wave hero-mic-wave-2" />
              <IconMic className="w-24 h-24 relative z-[2] text-brand-700" />
              <span className="text-3xl font-semibold relative z-[2] text-brand-800">Задать вопрос</span>
            </button>
          </div>
        </div>

        <div className="pb-10 lg:pb-12 shrink-0 pr-4 lg:pr-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 lg:gap-6">
            {NAV_CARDS.map((card, index) => (
              <div
                key={card.screen}
                className="kiosk-card-border"
                style={{ animationDelay: `${index * 0.55}s` }}
              >
                <button
                  type="button"
                  onClick={() => setAppScreen(card.screen)}
                  className="kiosk-nav-card relative z-[2] w-full h-full text-left p-4 lg:p-5 rounded-2xl
                             bg-white/28 border border-white/55 backdrop-blur-sm shadow-lg
                             active:scale-[0.98] touch-manipulation flex flex-col"
                >
                  <div className="mb-3 p-2.5 rounded-xl bg-white/85 w-fit">
                    {card.icon}
                  </div>
                  <h3 className="text-lg lg:text-xl font-bold text-white leading-tight min-h-[2.8rem] drop-shadow-sm">
                    {card.title}
                  </h3>
                  <p className="text-sm lg:text-base text-white/95 mt-1.5 leading-snug min-h-[2.8rem]">
                    {card.description}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
