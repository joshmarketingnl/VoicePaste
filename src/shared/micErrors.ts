/**
 * Turns a failed microphone start into something a user can act on.
 *
 * Field data (Apr–Oct 2026): 20 of 31 errors were the bare text
 * "Microphone access failed." — one cause was a USB microphone that Windows
 * had put in an error state after a RAM swap (fixed by replugging), others
 * unknown because the browser's reason was thrown away. The DOMException
 * name tells the causes apart; each gets its own explanation and, where it
 * helps, a button to the right settings page.
 */

export type MicProblem = 'permission' | 'no-device' | 'busy-or-broken' | 'no-signal' | 'lost' | 'unknown';
export type MicPlatform = 'win32' | 'darwin' | 'other';

export interface MicHelp {
  problem: MicProblem;
  message: string;
  /** Settings page that fixes it, opened by a button; absent when none helps. */
  settingsUrl?: string;
  settingsLabel?: string;
}

/** Map a getUserMedia/MediaRecorder error name to the problem behind it. */
export function classifyMicError(name: string | undefined | null): MicProblem {
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permission';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-device';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'busy-or-broken';
    default:
      return 'unknown';
  }
}

/** Worth one quiet retry: USB microphones can be briefly unreadable after wake. */
export function isRetryableMicError(name: string | undefined | null): boolean {
  return classifyMicError(name) === 'busy-or-broken';
}

const SETTINGS: Record<MicPlatform, string | undefined> = {
  win32: 'ms-settings:privacy-microphone',
  darwin: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  other: undefined,
};

type Lang = 'nl' | 'en';

const TEXT: Record<Lang, Record<MicProblem, Record<MicPlatform, string>>> = {
  nl: {
    permission: {
      win32: 'Windows blokkeert de microfoon. Zet onder Privacy › Microfoon "Bureaublad-apps toegang tot de microfoon geven" aan.',
      darwin: 'macOS blokkeert de microfoon. Zet VoicePaste aan onder Privacy en beveiliging › Microfoon.',
      other: 'De microfoon is geblokkeerd. Geef VoicePaste toegang in de systeeminstellingen.',
    },
    'no-device': {
      win32: 'Geen microfoon gevonden. Sluit hem aan, of kies in Windows een andere invoer onder Geluid.',
      darwin: 'Geen microfoon gevonden. Sluit hem aan, of kies een andere invoer onder Systeeminstellingen › Geluid.',
      other: 'Geen microfoon gevonden. Sluit er een aan en probeer het opnieuw.',
    },
    'busy-or-broken': {
      win32: 'De microfoon reageert niet. Gebruikt een ander programma hem? Bij een USB-microfoon: trek de kabel eruit en steek hem terug.',
      darwin: 'De microfoon reageert niet. Gebruikt een ander programma hem? Bij een USB-microfoon: trek de kabel eruit en steek hem terug.',
      other: 'De microfoon reageert niet. Sluit andere programma\'s die hem gebruiken, of sluit hem opnieuw aan.',
    },
    'no-signal': {
      win32: 'Er kwam geen geluid binnen. Staat de goede microfoon aan en is hij niet gedempt?',
      darwin: 'Er kwam geen geluid binnen. Staat VoicePaste aan onder Privacy en beveiliging › Microfoon, en is de goede microfoon gekozen?',
      other: 'Er kwam geen geluid binnen. Controleer of de goede microfoon aan staat.',
    },
    lost: {
      win32: 'De microfoon viel weg tijdens het opnemen. Wat je al had ingesproken wordt verwerkt.',
      darwin: 'De microfoon viel weg tijdens het opnemen. Wat je al had ingesproken wordt verwerkt.',
      other: 'De microfoon viel weg tijdens het opnemen. Wat je al had ingesproken wordt verwerkt.',
    },
    unknown: {
      win32: 'De microfoon kon niet starten. Probeer het nog eens; blijft het gebeuren, kijk dan of hij in Windows goed werkt.',
      darwin: 'De microfoon kon niet starten. Probeer het nog eens; blijft het gebeuren, kijk dan bij Privacy en beveiliging › Microfoon.',
      other: 'De microfoon kon niet starten. Probeer het nog eens.',
    },
  },
  en: {
    permission: {
      win32: 'Windows is blocking the microphone. Turn on "Let desktop apps access your microphone" under Privacy › Microphone.',
      darwin: 'macOS is blocking the microphone. Turn on VoicePaste under Privacy & Security › Microphone.',
      other: 'The microphone is blocked. Give VoicePaste access in your system settings.',
    },
    'no-device': {
      win32: 'No microphone found. Plug one in, or pick another input under Sound in Windows settings.',
      darwin: 'No microphone found. Plug one in, or pick another input under System Settings › Sound.',
      other: 'No microphone found. Plug one in and try again.',
    },
    'busy-or-broken': {
      win32: 'The microphone is not responding. Is another app using it? For a USB microphone: unplug it and plug it back in.',
      darwin: 'The microphone is not responding. Is another app using it? For a USB microphone: unplug it and plug it back in.',
      other: 'The microphone is not responding. Close other apps using it, or reconnect it.',
    },
    'no-signal': {
      win32: 'No sound came in. Is the right microphone on and not muted?',
      darwin: 'No sound came in. Is VoicePaste allowed under Privacy & Security › Microphone, and is the right microphone selected?',
      other: 'No sound came in. Check that the right microphone is on.',
    },
    lost: {
      win32: 'The microphone dropped out while recording. What you said so far is being processed.',
      darwin: 'The microphone dropped out while recording. What you said so far is being processed.',
      other: 'The microphone dropped out while recording. What you said so far is being processed.',
    },
    unknown: {
      win32: 'The microphone could not start. Try again; if it keeps happening, check that it works in Windows.',
      darwin: 'The microphone could not start. Try again; if it keeps happening, check Privacy & Security › Microphone.',
      other: 'The microphone could not start. Try again.',
    },
  },
};

const SETTINGS_LABEL: Record<Lang, string> = { nl: 'Instellingen openen', en: 'Open settings' };

export function micHelp(problem: MicProblem, platform: string, uiLanguage: string): MicHelp {
  const p: MicPlatform = platform === 'win32' || platform === 'darwin' ? platform : 'other';
  const lang: Lang = uiLanguage === 'nl' ? 'nl' : 'en';
  const settingsUrl = problem === 'permission' || (problem === 'no-signal' && p === 'darwin') ? SETTINGS[p] : undefined;
  return {
    problem,
    message: TEXT[lang][problem][p],
    settingsUrl,
    settingsLabel: settingsUrl ? SETTINGS_LABEL[lang] : undefined,
  };
}

/**
 * Peak level below which a recording carried no signal at all. A real
 * microphone in a quiet room measures around −60 dB; a recording blocked by
 * macOS privacy (July 2026) was digital silence at −91 dB. −70 dB only catches
 * "nothing at all", never a quiet speaker.
 */
export const NO_SIGNAL_PEAK_DB = -70;

export function isNoSignal(peakDb: number | null | undefined): boolean {
  return typeof peakDb === 'number' && Number.isFinite(peakDb) && peakDb < NO_SIGNAL_PEAK_DB;
}
