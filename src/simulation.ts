export type SimulationEventKind = 'world' | 'activity' | 'memory' | 'spend' | 'relationship';

/** Stable event IDs make retries idempotent instead of creating duplicate world events. */
export function simulationEventId(scope:string, sequence:number, kind:SimulationEventKind, subject = ''): string {
  const input = `${scope}:${sequence}:${kind}:${subject}`;
  let h1 = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  const hex = (h1 >>> 0).toString(16).padStart(8, '0');
  return `sim-${hex}-${sequence}-${kind}`;
}

export function choose<T>(items:T[], seed:number): T {
  return items[Math.abs(seed) % items.length];
}

export function bounded(n:number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}
