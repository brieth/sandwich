/**
 * What you pick up for an exercise, shown as a small icon beside its name.
 *
 * It's the part of a lift that isn't in the name and that you have to walk
 * across the gym for, so the Routine tab doubles as a "what do I need" list and
 * a workout card says it without spelling it out.
 *
 * Machines and barbells carry one too, so every row has an icon and the column
 * stays aligned rather than gapping where an exercise has no attachment.
 */
export type Implement =
  | 'barbell'
  | 'latbar' // wide pulldown bar, ends angled down
  | 'bar' // short cambered cable bar, the EZ curl bend
  | 'rope'
  | 'handle' // single D-handle / stirrup
  | 'clip' // bare carabiner, no attachment
  | 'machine'; // fixed grips, nothing to attach

const IMPLEMENT: Record<string, Implement> = {
  // Barbell
  'barbell-incline-bench-press': 'barbell',
  'barbell-bench-press': 'barbell',
  'barbell-decline-bench-press': 'barbell',
  // Pulldown bars
  'close-grip-lat-pulldown': 'latbar',
  'lat-pulldown': 'latbar',
  'wide-grip-lat-pulldown': 'latbar',
  // Single D-handle
  'cable-single-arm-high-row': 'handle',
  'cable-single-arm-mid-row': 'handle',
  'cable-single-arm-low-row': 'handle',
  'cable-high-crossover-fly': 'handle',
  'cable-mid-crossover-fly': 'handle',
  'cable-low-crossover-fly': 'handle',
  'cable-behind-the-back-bicep-curl': 'handle',
  'cable-behind-the-back-lateral-raise': 'handle',
  'cable-single-arm-low-overhead-tricep-extension': 'handle',
  'cable-single-arm-reverse-curl': 'handle',
  'cable-high-woodchopper': 'handle',
  'cable-low-woodchopper': 'handle',
  'cable-oblique-crunch': 'handle',
  // Bare clip, nothing attached
  'cable-single-arm-underhand-tricep-pushdown': 'clip', // the cross-body extension
  'cable-single-arm-rear-delt-fly': 'clip',
  // Rope
  'cable-face-pull': 'rope',
  'cable-high-overhead-tricep-extension': 'rope',
  'cable-tricep-pushdown': 'rope',
  'cable-crunch': 'rope',
  'cable-hammer-curl': 'rope',
  // Cable bar
  'cable-bicep-curl': 'bar',
  'cable-upright-row': 'bar',
  // Machines: fixed grips
  'machine-leg-press': 'machine',
  'machine-leg-curl': 'machine',
  'machine-leg-extension': 'machine',
  'machine-hip-abductor': 'machine',
  'machine-hip-adductor': 'machine',
  // Retired, so History still shows an icon
  'cable-underhand-tricep-pushdown': 'bar',
  'cable-low-overhead-tricep-extension': 'bar',
  'cable-reverse-curl': 'bar',
  'cable-overhead-bicep-curl': 'handle',
  'cable-rear-delt-fly': 'handle',
  'cable-front-raise': 'handle',
  'cable-row': 'bar',
  'v-bar-pulldown': 'latbar',
  'reverse-grip-pull-down': 'latbar',
  'shotgun-row': 'handle',
  'machine-glute-bridge': 'machine',
  'machine-lying-hamstring-curl': 'machine',
};

export const IMPLEMENT_LABELS: Record<Implement, string> = {
  barbell: 'Barbell',
  latbar: 'Pulldown bar',
  bar: 'Cambered',
  rope: 'Rope',
  handle: 'Handle',
  clip: 'No attachment',
  machine: 'Machine',
};

export function implementFor(exerciseId: string): Implement | null {
  return IMPLEMENT[exerciseId] ?? null;
}
