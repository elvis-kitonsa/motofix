// Centralised haptic + sound feedback for field events

const SOUNDS = {
  incoming: 'https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg',
  accepted: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg',
  statusUpdate: 'https://actions.google.com/sounds/v1/cartoon/clang_and_wobble.ogg',
  error: 'https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg',
};

const VIBRATIONS = {
  incoming: [200, 100, 200, 100, 200],
  accepted: [100, 50, 100],
  statusUpdate: [80],
  error: [300],
};

function vibrate(pattern: number | number[]) {
  try { window.navigator.vibrate?.(pattern); } catch {}
}

function playSound(url: string) {
  try { new Audio(url).play().catch(() => {}); } catch {}
}

export function useFeedback() {
  return {
    onIncomingJob() {
      vibrate(VIBRATIONS.incoming);
      playSound(SOUNDS.incoming);
    },
    onJobAccepted() {
      vibrate(VIBRATIONS.accepted);
      playSound(SOUNDS.accepted);
    },
    onStatusUpdated() {
      vibrate(VIBRATIONS.statusUpdate);
      playSound(SOUNDS.statusUpdate);
    },
    onError() {
      vibrate(VIBRATIONS.error);
      playSound(SOUNDS.error);
    },
  };
}
