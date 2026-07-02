import { QUEUE_PASS_SOUND_PATH } from "@ext/domains/walmart/lib/constants.ts";
import { sleep } from "@ext/core/lib/sleep.ts";

const FALLBACK_BEEP_MS = 200;
const FALLBACK_BEEP_HZ = 880;
const FALLBACK_STAGGER_MS = 300;

let audioWarned = false;
let customSoundAvailable: boolean | null = null;

function playFallbackBeep(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = FALLBACK_BEEP_HZ;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      void context.close();
    }, FALLBACK_BEEP_MS);
  } catch (error) {
    if (!audioWarned) {
      audioWarned = true;
      console.warn("CookieScripts: queue pass beep failed", error);
    }
  }
}

function getSoundUrl(): string {
  return chrome.runtime.getURL(QUEUE_PASS_SOUND_PATH);
}

async function probeCustomSound(): Promise<boolean> {
  if (customSoundAvailable != null) {
    return customSoundAvailable;
  }
  try {
    const response = await fetch(getSoundUrl(), { method: "HEAD" });
    customSoundAvailable = response.ok;
  } catch {
    customSoundAvailable = false;
  }
  return customSoundAvailable;
}

async function playCustomSoundOnce(): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(getSoundUrl());
    audio.preload = "auto";

    const finish = (played: boolean): void => {
      resolve(played);
    };

    audio.addEventListener(
      "ended",
      () => {
        finish(true);
      },
      { once: true },
    );

    audio.addEventListener(
      "error",
      () => {
        customSoundAvailable = false;
        finish(false);
      },
      { once: true },
    );

    void audio.play().then(
      () => {
        // ended handler resolves.
      },
      () => {
        finish(false);
      },
    );
  });
}

/**
 * Plays the bundled queue-pass clip once, or short synthetic beeps when repeats > 1
 * and no custom file is available.
 */
export async function playQueuePassAlert(repeats: number): Promise<void> {
  const count = Math.max(1, repeats);
  const hasCustom = await probeCustomSound();

  if (hasCustom) {
    await playCustomSoundOnce();
    return;
  }

  for (let i = 0; i < count; i += 1) {
    playFallbackBeep();
    if (i < count - 1) {
      await sleep(FALLBACK_STAGGER_MS);
    }
  }
}

/** @internal Test helper */
export function resetQueuePassSoundCacheForTests(): void {
  customSoundAvailable = null;
  audioWarned = false;
}
