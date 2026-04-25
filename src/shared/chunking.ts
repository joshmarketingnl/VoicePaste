export interface RotationPolicy {
  maxBytes: number;
  maxMs: number;
}

export function shouldRotateSegment(currentBytes: number, elapsedMs: number, policy: RotationPolicy): boolean {
  return currentBytes >= policy.maxBytes || elapsedMs >= policy.maxMs;
}
