/**
 * Estimated-1RM formulas, switchable from the Routine tab.
 *
 * None of these is definitive. They're regressions fit mostly to bench press in
 * young subjects, they broadly agree from 1 to 10 reps, and above 12 they
 * diverge hard: at 14 reps Brzycki pays 1.565x the working weight where
 * Lombardi pays 1.302x. Which one you pick therefore decides how a high-rep
 * session compares to a heavy one, and so which sessions count as a PR.
 *
 * Switching re-derives the whole history through the new lens. No logged data
 * changes, so nothing is lost and switching back restores the old numbers
 * exactly.
 */
export type OneRMFormulaId =
  | 'epley'
  | 'brzycki'
  | 'lander'
  | 'mayhew'
  | 'wathen'
  | 'oconner'
  | 'lombardi';

export interface OneRMFormula {
  id: OneRMFormulaId;
  name: string;
  /** Multiplier on the working weight for a given rep count. */
  factor: (reps: number) => number;
}

/**
 * Brzycki and Lander are ratios whose denominators reach zero around 37 reps,
 * so reps are clamped. Nothing near that is trainable; the clamp just keeps a
 * mis-typed set from producing an infinity.
 */
const MAX_REPS = 36;

export const FORMULAS: OneRMFormula[] = [
  {
    id: 'epley',
    name: 'Epley',
    factor: (r) => 1 + r / 30,
  },
  {
    id: 'brzycki',
    name: 'Brzycki',
    factor: (r) => 36 / (37 - Math.min(r, MAX_REPS)),
  },
  {
    id: 'lander',
    name: 'Lander',
    factor: (r) => 100 / (101.3 - 2.67123 * Math.min(r, MAX_REPS)),
  },
  {
    id: 'mayhew',
    name: 'Mayhew',
    factor: (r) => 100 / (52.2 + 41.9 * Math.exp(-0.055 * r)),
  },
  {
    id: 'wathen',
    name: 'Wathen',
    factor: (r) => 100 / (48.8 + 53.8 * Math.exp(-0.075 * r)),
  },
  {
    id: 'oconner',
    name: "O'Conner",
    factor: (r) => 1 + 0.025 * r,
  },
  {
    id: 'lombardi',
    name: 'Lombardi',
    factor: (r) => Math.pow(r, 0.1),
  },
];

export const DEFAULT_FORMULA: OneRMFormulaId = 'epley';

export function isFormulaId(v: unknown): v is OneRMFormulaId {
  return typeof v === 'string' && FORMULAS.some((f) => f.id === v);
}

export function formulaFor(id: OneRMFormulaId): OneRMFormula {
  return FORMULAS.find((f) => f.id === id) ?? FORMULAS[0];
}

/*
 * The active formula is module state rather than a parameter threaded through
 * every stats call, because it's one app-wide setting read in dozens of places
 * and never varies within a render. The store writes it from AppData before any
 * consumer renders, and writing the same value twice is harmless.
 */
let active: OneRMFormula = formulaFor(DEFAULT_FORMULA);

export function setActiveFormula(id: OneRMFormulaId): void {
  active = formulaFor(id);
}

export function activeFormulaId(): OneRMFormulaId {
  return active.id;
}

/**
 * Estimated 1RM under the active formula.
 *
 * A single rep returns the weight itself for every formula. Several of them
 * don't land exactly on 1.0 at one rep (Mayhew is 9% over), and a set of one is
 * a measured max rather than an estimate, so there's nothing to estimate.
 */
export function oneRM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * active.factor(reps);
}

/** Inverse: the weight to expect for a rep count at a given 1RM. */
export function weightAtReps(oneRepMax: number, reps: number): number {
  if (reps <= 1) return oneRepMax;
  return oneRepMax / active.factor(reps);
}
