/**
 * When to show the welcome / permissions panel.
 *
 * A fresh install starts hidden in the tray (Windows always, by design), so a
 * new user sees nothing and doesn't know the hotkeys. On a Mac, an unsigned
 * app also loses its Accessibility (paste) permission with every update, and a
 * blocked microphone records digital silence without any prompt (July 2026).
 */

export type MicAccess = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';

export type OnboardingReason = 'first-run' | 'mic-missing' | 'accessibility-missing' | 'after-update';

export interface OnboardingInput {
  isFirstRun: boolean;
  platform: string;
  mic: MicAccess;
  /** macOS Accessibility (needed to paste); true on other platforms. */
  accessibility: boolean;
  /** Accessibility as seen at the previous start (null: never checked). */
  previousAccessibility: boolean | null;
  versionChanged: boolean;
}

export function decideOnboarding(input: OnboardingInput): OnboardingReason | null {
  if (input.isFirstRun) {
    return 'first-run';
  }
  if (input.platform !== 'darwin') {
    return null;
  }
  if (input.mic === 'denied' || input.mic === 'restricted') {
    return 'mic-missing';
  }
  if (!input.accessibility) {
    // Granted before, gone now, right after an update: the unsigned-app case.
    return input.versionChanged && input.previousAccessibility === true ? 'after-update' : 'accessibility-missing';
  }
  return null;
}

export const MAC_SETTINGS = {
  microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
} as const;
