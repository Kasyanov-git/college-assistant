import React, { useEffect } from 'react';
import { useStore } from './store/assistantStore';
import { KIOSK_CONFIG } from './config/kiosk';
import { HomeScreen } from './components/Home/HomeScreen';
import { IframeScreen } from './components/Embed/IframeScreen';
import { AssistantScreen } from './screens/AssistantScreen';
import { NavigationScreen } from './screens/NavigationScreen';
import { AboutCollegeScreen } from './screens/AboutCollegeScreen';

function App() {
  const appScreen = useStore(s => s.appScreen);
  const setAppScreen = useStore(s => s.setAppScreen);
  const clearMessages = useStore(s => s.clearMessages);
  const notification = useStore(s => s.notification);

  useEffect(() => {
    let timer: number | undefined;
    const resetTimer = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        clearMessages();
        setAppScreen('home');
      }, 180000);
    };
    const requestKioskFullscreen = () => {
      if (!document.fullscreenElement) {
        const request = document.documentElement.requestFullscreen;
        if (request) {
          void request.call(document.documentElement).catch(() => undefined);
        }
      }
    };
    const events = ['pointerdown', 'touchstart', 'keydown', 'input'];
    events.forEach(event => document.addEventListener(event, resetTimer, { passive: true }));
    document.addEventListener('pointerdown', requestKioskFullscreen, { once: true, passive: true });
    document.addEventListener('contextmenu', event => event.preventDefault());
    resetTimer();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [clearMessages, setAppScreen]);

  const screen = (() => {
    switch (appScreen) {
    case 'home':
      return <HomeScreen />;
    case 'assistant':
      return <AssistantScreen />;
    case 'navigation':
      return <NavigationScreen />;
    case 'about':
      return <AboutCollegeScreen />;
    case 'schedule':
      return (
        <IframeScreen
          title="Расписание"
          url={KIOSK_CONFIG.scheduleUrl}
          configKey="scheduleUrl"
          embedMode={KIOSK_CONFIG.scheduleEmbedMode}
        />
      );
    default:
      return <HomeScreen />;
    }
  })();

  return (
    <>
      {screen}
      {notification && (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm font-medium text-amber-900 shadow-xl animate-slide-up">
          {notification}
        </div>
      )}
    </>
  );
}

export default App;
