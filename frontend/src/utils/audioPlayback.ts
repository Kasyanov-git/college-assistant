import { useStore } from '../store/assistantStore';

let audioElement: HTMLAudioElement | null = null;

export function stopAssistantAudio() {
  if (!audioElement) return;
  try {
    audioElement.pause();
    audioElement.currentTime = 0;
  } catch {}
  audioElement = null;
  useStore.getState().setAudioPlaying(false);
}

export function playAssistantAudio(url: string) {
  stopAssistantAudio();
  if (!url) return;

  const audio = new Audio(url);
  audioElement = audio;

  audio.onplay = () => {
    useStore.getState().setAudioPlaying(true);
  };
  audio.onended = () => {
    useStore.getState().setAudioPlaying(false);
    audioElement = null;
  };
  audio.onpause = () => {
    if (audioElement === audio) {
      useStore.getState().setAudioPlaying(false);
    }
  };
  audio.onerror = () => {
    useStore.getState().setAudioPlaying(false);
    audioElement = null;
  };

  audio.play().catch(() => {
    useStore.getState().setAudioPlaying(false);
    audioElement = null;
  });
}
