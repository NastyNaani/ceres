/**
 * Optional scan beep — never import expo-audio at module top-level from the
 * Scan screen, because a missing/mismatched native module can kill the app on launch.
 */

let player: { seekTo: (n: number) => void; play: () => void } | null = null;
let loadFailed = false;

export function playScanBeep() {
  if (loadFailed) return;

  try {
    if (!player) {
      // Lazy require so Scan can mount even if audio native code is unavailable.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const audio = require('expo-audio') as typeof import('expo-audio');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const source = require('../assets/scan-beep.wav');
      player = audio.createAudioPlayer(source);
    }
    player.seekTo(0);
    player.play();
  } catch {
    loadFailed = true;
    player = null;
  }
}
