/*
 * The rep's tempo, shared by every figure: a 4 second cycle starting at the
 * stretch. Hold there 1 second, contract over 1, then return into the stretch
 * over 2. Growth is about the same anywhere from half a second to 8 seconds per
 * rep when sets go near failure, so the slow return is for control: reaching
 * full length every rep and not bouncing out of it. 2 seconds does that; 3 cost
 * reps for nothing. The hold is there to stop the bounce. The figures and the
 * counter under them run this one curve.
 */
export const TEMPO = { hold: 1, contract: 1, stretch: 2 } as const;
export const CYCLE = TEMPO.hold + TEMPO.contract + TEMPO.stretch;

const EASE = (x: number): number => {
  // cubic-bezier(0.42, 0, 0.58, 1), which is what CSS ease-in-out means.
  let s = x;
  for (let i = 0; i < 8; i++) {
    const bx = 3 * (1 - s) * (1 - s) * s * 0.42 + 3 * (1 - s) * s * s * 0.58 + s * s * s;
    const dx = 3 * (1 - s) * (1 - s) * 0.42 + 6 * (1 - s) * s * (0.58 - 0.42) + 3 * s * s * (1 - 0.58);
    if (Math.abs(dx) < 1e-6) break;
    s -= (bx - x) / dx;
  }
  return 3 * s * s - 2 * s * s * s;
};

/** Fraction of the way to the contracted end at a point in the cycle. */
export function sweepAt(phase: number): number {
  const a = TEMPO.hold / CYCLE;
  const b = (TEMPO.hold + TEMPO.contract) / CYCLE;
  if (phase < a) return 0;
  if (phase < b) return EASE((phase - a) / (b - a));
  return 1 - EASE((phase - b) / (1 - b));
}
