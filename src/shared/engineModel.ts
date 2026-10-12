/**
 * Which speech model the local engine runs.
 *
 * On a PC without an NVIDIA card the processor does all the work: the large
 * model then takes ~28 s for a 10 s dictation (i7-12700, Oct 2026). The small
 * model takes 7 s; plain Dutch is as good, Dutch full of English jargon is
 * worse (21% vs 9% word errors). So 'auto' runs small only where large is slow.
 */

export type LocalModelChoice = 'auto' | 'accurate' | 'fast';
export type ModelSize = 'large' | 'small';

export function isLocalModelChoice(value: unknown): value is LocalModelChoice {
  return value === 'auto' || value === 'accurate' || value === 'fast';
}

/**
 * @param gpuCheck 'gpu' (NVIDIA found), 'no-driver', or 'unavailable' (driver
 *   didn't answer yet; treated as GPU so a slow cold boot doesn't trigger a
 *   download of the small model on an NVIDIA machine).
 */
export function chooseModelSize(choice: LocalModelChoice, platform: string, gpuCheck: string): ModelSize {
  if (choice === 'accurate') return 'large';
  if (choice === 'fast') return 'small';
  if (platform === 'darwin') return 'large'; // Metal on every Mac
  return gpuCheck === 'no-driver' ? 'small' : 'large';
}
