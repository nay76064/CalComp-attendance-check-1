
import { DEVELOPER_DEFAULT_SUCCESS_SOUND } from '../constants';

export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.error("This browser does not support desktop notification");
    return;
  }
  
  if (Notification.permission !== "granted") {
    await Notification.requestPermission();
  }
};

export const sendNotification = (title: string, body: string) => {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', // Generic fingerprint icon
    });
  }
};

export const playAlertSound = (type: 'success' | 'warning', customSoundData: string | null = null) => {
  // Logic: 
  // 1. Check if User has a Custom Sound -> Play it.
  // 2. Else, Check if Developer set a Default Sound -> Play it.
  // 3. Else, Use System Oscillator (Beep).

  if (type === 'success') {
    const soundSource = customSoundData || DEVELOPER_DEFAULT_SUCCESS_SOUND;

    if (soundSource) {
      try {
        const audio = new Audio(soundSource);
        audio.play().catch(e => console.error("Error playing sound source", e));
        return; // Return early if sound played successfully
      } catch (e) {
        console.warn("Invalid sound source, falling back to oscillator.");
      }
    }
  }

  // Fallback: Simple oscillator beeps since we don't have external assets
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  if (type === 'success') {
    // High pitched "Ding" (Default Beep)
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } else {
    // Low pitched "Buzz" (Warning/Error)
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }
};
