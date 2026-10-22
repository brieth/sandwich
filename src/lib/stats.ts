import type { Session, ID } from '../types';
import { limbFactor } from './laterality';
import { isCurrentExercise } from '../seed';
import { oneRM, weightAtReps } from './onerm';

/**
 * Estimated 1-rep max under whichever formula is selected (see onerm.ts).
 * Re-exported from here so every caller keeps using one entry point.
 */
export function estimated1RM(weight: number, reps: number): number {
  return oneRM(weight, reps);
}

export interface ExercisePoint {
  date: string;
  topSet: number;     // heaviest weight lifted that day
  best1RM: number;    // best estimated 1RM that day
  volume: number;     // total weight x reps for the exercise that day
}

/** Per-session history for one exercise, oldest first. */
export function exerciseHistory(sessions: Session[], exerciseId: ID): ExercisePoint[] {
  const points: ExercisePoint[] = [];
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  for (const session of ordered) {
    const logged = session.exercises.find((e) => e.exerciseId === exerciseId);
    if (!logged) continue;
    const doneSets = logged.sets.filter((s) => s.done && s.weight > 0 && s.reps > 0);
    if (doneSets.length === 0) continue;

    let topSet = 0;
    let best1RM = 0;
    let volume = 0;
    for (const s of doneSets) {
      topSet = Math.max(topSet, s.weight);
      best1RM = Math.max(best1RM, estimated1RM(s.weight, s.reps));
      volume += s.weight * s.reps;
    }
    points.push({ date: session.date, topSet, best1RM: Math.round(best1RM), volume: Math.round(volume) });
  }
  return points;
}

/** A session's calendar day in local time, YYYY-MM-DD, the form a form change is stored in. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Sessions on or after an exercise's form change, for its targets. All of them
 * when there's no change. Sessions before it were a shorter or different
 * movement, so their weights would point the targets at the old form.
 */
export function fromFormChange(sessions: Session[], day: string | undefined): Session[] {
  return day ? sessions.filter((s) => localDay(s.date) >= day) : sessions;
}

/** Index of the first point on or after the form change, or -1 if none is. */
export function formChangeIndex(history: ExercisePoint[], day: string | undefined): number {
  return day ? history.findIndex((p) => localDay(p.date) >= day) : -1;
}

/**
 * Chain-links an exercise's history across its form change, for the indexes.
 * Points from the change on are scaled by last old value / first new value, so
 * the first new session reads at the old level and later ones move it by the
 * same proportion the new form improves. Without this, marking a dozen
 * exercises at once would read in the index as a large loss of strength.
 */
function linkAtFormChange(history: ExercisePoint[], day: string | undefined): ExercisePoint[] {
  const cut = formChangeIndex(history, day);
  // Nothing after the change yet, or nothing before it to link to.
  if (cut <= 0) return history;
  const before = history[cut - 1];
  const start = history[cut];
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 1);
  const kS = ratio(before.best1RM, start.best1RM);
  const kV = ratio(before.volume, start.volume);
  const kT = ratio(before.topSet, start.topSet);
  return history.map((p, i) =>
    i < cut ? p : { ...p, best1RM: p.best1RM * kS, volume: p.volume * kV, topSet: p.topSet * kT },
  );
}

/** Most recent session's best estimated 1RM for an exercise, or null. */
export function recentEstimated1RM(sessions: Session[], exerciseId: ID): number | null {
  const history = exerciseHistory(sessions, exerciseId);
  return history.length ? history[history.length - 1].best1RM : null;
}

/** Inverse: the weight you'd expect to hit for a given rep count at a 1RM. */
export function weightForReps(oneRepMax: number, reps: number): number {
  return weightAtReps(oneRepMax, reps);
}

/** Most recent prior session's logged volume and est. 1RM for an exercise, or null. */
export function lastExercisePoint(
  sessions: Session[],
  exerciseId: ID,
): { volume: number; best1RM: number } | null {
  const history = exerciseHistory(sessions, exerciseId);
  if (!history.length) return null;
  const p = history[history.length - 1];
  return { volume: p.volume, best1RM: p.best1RM };
}

/** Linear-interpolated quantile (q in [0,1]) of a numeric sample. 0 if empty. */
function quantile(sample: number[], q: number): number {
  if (sample.length === 0) return 0;
  const s = [...sample].sort((a, b) => a - b);
  const rank = q * (s.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return s[lo];
  return s[lo] + (rank - lo) * (s[hi] - s[lo]);
}

/** Trailing window (sessions) for the rolling reference line. */
export const ROLL_WINDOW = 9;

/**
 * Rolling mean: each point is the average of the trailing `window` values up to
 * and including it. A gettable "floor" reference that sits below Best, so it
 * stays a beatable consolation target on off days.
 */
export function rollingMean(values: number[], window = ROLL_WINDOW): number[] {
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round(w.reduce((a, b) => a + b, 0) / w.length);
  });
}

/** Rolling-mean (last ROLL_WINDOW sessions) volume and est. 1RM for an exercise. */
export function meanExercisePoint(
  sessions: Session[],
  exerciseId: ID,
): { volume: number; best1RM: number } | null {
  const history = exerciseHistory(sessions, exerciseId);
  if (!history.length) return null;
  const w = history.slice(-ROLL_WINDOW);
  const n = w.length;
  return {
    volume: Math.round(w.reduce((a, p) => a + p.volume, 0) / n),
    best1RM: Math.round(w.reduce((a, p) => a + p.best1RM, 0) / n),
  };
}

/*
 * Q3 helpers, kept available in case we switch the reference line back to a
 * rolling third-quartile. Not currently wired into the UI.
 */

/**
 * Rolling third-quartile (75th percentile): each point is the Q3 of the trailing
 * `window` values up to and including it. A competitive, outlier-resistant
 * reference that keeps pace as you improve.
 */
export function rollingQ3(values: number[], window = ROLL_WINDOW): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    return Math.round(quantile(values.slice(start, i + 1), 0.75));
  });
}

/** Rolling-Q3 (last ROLL_WINDOW sessions) volume and est. 1RM for an exercise. */
export function q3ExercisePoint(
  sessions: Session[],
  exerciseId: ID,
): { volume: number; best1RM: number } | null {
  const history = exerciseHistory(sessions, exerciseId);
  if (!history.length) return null;
  const w = history.slice(-ROLL_WINDOW);
  return {
    volume: Math.round(quantile(w.map((p) => p.volume), 0.75)),
    best1RM: Math.round(quantile(w.map((p) => p.best1RM), 0.75)),
  };
}

/**
 * Best logged volume and best estimated 1RM over the trailing ROLL_WINDOW
 * sessions, the same window the mean uses.
 *
 * Rolling rather than all-time, so a record can expire. A volume best is as
 * much a decision as a performance, since another set always raises it, and a
 * single high-set session shouldn't stand as a target forever. A strength best
 * falling out of a nine-session window is itself the signal that progress has
 * stalled or training stopped, which is when the targets should ease rather
 * than keep pointing at a number set under different circumstances.
 *
 * The all-time figures aren't lost; History still shows every session.
 */
export function bestExercisePoint(
  sessions: Session[],
  exerciseId: ID,
): { volume: number; best1RM: number } | null {
  const history = exerciseHistory(sessions, exerciseId);
  if (!history.length) return null;
  const w = history.slice(-ROLL_WINDOW);
  return {
    volume: Math.max(...w.map((p) => p.volume)),
    best1RM: Math.max(...w.map((p) => p.best1RM)),
  };
}

/** Best estimated 1RM across a set list (rounded). 0 if none qualify. */
export function bestEstimated1RM(
  sets: { weight: number; reps: number; done?: boolean }[],
  onlyDone: boolean,
): number {
  let best = 0;
  for (const s of sets) {
    if (onlyDone && !s.done) continue;
    if (s.weight <= 0 || s.reps <= 0) continue;
    best = Math.max(best, estimated1RM(s.weight, s.reps));
  }
  return Math.round(best);
}

/**
 * Whole-body index. At each workout date, sum across `exerciseIds` of each
 * exercise's most-recent best-1RM and most-recent session volume as of that
 * date. Expects force-normalized sessions, so machines don't need scoping.
 *
 * An exercise's value is back-filled to dates BEFORE its first performance,
 * using that first value. This keeps the basket constant over time, so adding
 * an exercise shifts the whole line up by a constant rather than creating a
 * step. The only thing that moves the line is a real change in some exercise's
 * most-recent number, i.e. actual progress. A form change is linked the same
 * way (see linkAtFormChange).
 */
export function overallSeries(
  sessions: Session[],
  exerciseIds: ID[],
  formChanges: Record<ID, string> = {},
): ExercisePoint[] {
  const perEx = exerciseIds
    .map((id) => ({
      factor: limbFactor(id), // per-limb movements count double in the aggregate
      history: linkAtFormChange(exerciseHistory(sessions, id), formChanges[id]),
    }))
    .filter((e) => e.history.length > 0);

  const dates = [...new Set(perEx.flatMap((e) => e.history.map((p) => p.date)))].sort((a, b) =>
    a.localeCompare(b),
  );

  return dates.map((date) => {
    let best1RM = 0;
    let volume = 0;
    let topSet = 0;
    for (const { factor, history } of perEx) {
      // latest performance at or before this date (history is oldest-first)
      let latest: ExercisePoint | null = null;
      for (const p of history) {
        if (p.date <= date) latest = p;
        else break;
      }
      // Before this exercise's first performance, back-fill its first value.
      const point = latest ?? history[0];
      best1RM += point.best1RM * factor;
      volume += point.volume * factor;
      topSet += point.topSet * factor;
    }
    return { date, topSet, best1RM: Math.round(best1RM), volume: Math.round(volume) };
  });
}

/**
 * Total work for a session. Per-limb exercises (single-arm rows, crossover flys,
 * etc.) log one limb's load, so they're doubled here to reflect the real work
 * both limbs did. This is an aggregate, so it follows the same true-work rule as
 * the Upper Body index; per-set entry and per-exercise charts stay in raw numbers.
 */
export function sessionVolume(session: Session): number {
  let total = 0;
  for (const logged of session.exercises) {
    // Retired exercises are excluded from every derived number.
    if (!isCurrentExercise(logged.exerciseId)) continue;
    const factor = limbFactor(logged.exerciseId);
    for (const s of logged.sets) {
      if (s.done) total += s.weight * s.reps * factor;
    }
  }
  return Math.round(total);
}
