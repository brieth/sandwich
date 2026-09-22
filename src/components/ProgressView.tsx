import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { exerciseHistory, overallSeries, rollingMean } from '../lib/stats';
import { CURRENT_EXERCISE_IDS, isCurrentExercise, UPPER_BODY_EXERCISE_IDS } from '../seed';
import { exercisesForMuscle, MUSCLE_GROUPS, type MuscleGroup } from '../lib/muscles';
import { LineChart } from './LineChart';
import { WeeklyMuscles } from './WeeklyMuscles';

export type Metric = 'best1RM' | 'volume';

// Sentinel id for the aggregate series: one strength/volume index summed across
// every chest, back, delt, bicep, and tricep lift.
const UPPER_BODY = '__upper_body__';

/**
 * Everything currently in the routine, legs and abs included, and the default
 * view. Upper Body sits below it for reading progress without the leg machines,
 * whose stack numbers can't be force-calibrated.
 */
const FULL_BODY = '__full_body__';

/**
 * Per-muscle-group indexes, selectable like any other series. Prefixed so a
 * group can't collide with an exercise id.
 *
 * Same aggregate as Upper Body, narrowed to one group's exercises. The groups
 * match the weekly set panel below, including Legs and Abs: those are menu
 * slots, so only one option is performed per session and the rest hold their
 * last value between appearances, which makes those two lines coarser than the
 * others rather than wrong.
 */
const GROUP_PREFIX = 'group:';
const groupKey = (g: MuscleGroup) => `${GROUP_PREFIX}${g}`;
const groupOf = (key: string): MuscleGroup | null =>
  key.startsWith(GROUP_PREFIX) ? (key.slice(GROUP_PREFIX.length) as MuscleGroup) : null;

/**
 * Estimated 1RM at which a lift correlates with visibly muscular development.
 * Anchored to FFMI ~23 (about 165 lb of lean mass at 5'11"), which lands around
 * 1.4x bodyweight on bench at roughly 200 lb.
 *
 * Only defined for the flat barbell bench press: it's a standardized movement
 * with real population data behind it. Cable and machine loads vary too much
 * between gyms for a threshold to mean anything, and volume isn't a physique
 * correlate at all, so no other exercise or metric gets a line.
 */
const STRENGTH_GOALS: Record<string, number> = {
  'barbell-bench-press': 285,
};

const METRIC_LABELS: Record<Metric, string> = {
  best1RM: 'Strength',
  volume: 'Volume',
};

// View state (selected exercise + metric) is owned by the parent Shell so it
// survives tab switches, which unmount/remount this component.
export function ProgressView({
  metric,
  setMetric,
  selected,
  setSelected,
}: {
  metric: Metric;
  setMetric: (m: Metric) => void;
  selected: string | null;
  setSelected: (s: string | null) => void;
}) {
  const { data, forceSessions, exerciseName } = useStore();
  const [showGoal, setShowGoal] = useState(false);

  // exercises that both have logged data and still exist in the routine, alphabetical
  const tracked = useMemo(() => {
    const ids = new Set<string>();
    for (const s of data.sessions)
      for (const e of s.exercises) if (isCurrentExercise(e.exerciseId)) ids.add(e.exerciseId);
    return [...ids].sort((a, b) => exerciseName(a).localeCompare(exerciseName(b)));
  }, [data.sessions, exerciseName]);

  // Full Body, then Upper Body, then the muscle groups, then the exercises.
  const options = [FULL_BODY, UPPER_BODY, ...MUSCLE_GROUPS.map(groupKey), ...tracked];
  const current = selected ?? FULL_BODY;
  // The chart needs finished-session history; the weekly muscle panel below
  // works off the active session too, so it always renders (even mid-first-workout).
  const hasHistory = tracked.length > 0;

  // Everything below runs on force-normalized sessions, so a lift tracks as one
  // continuous series no matter which machine it was performed on. See
  // UPPER_BODY_EXERCISE_IDS for why legs and abs sit out of the aggregate.
  const group = groupOf(current);
  const history =
    current === FULL_BODY
      ? overallSeries(forceSessions, [...CURRENT_EXERCISE_IDS])
      : current === UPPER_BODY
        ? overallSeries(forceSessions, [...UPPER_BODY_EXERCISE_IDS])
        : group
          ? overallSeries(forceSessions, exercisesForMuscle(group))
          : exerciseHistory(forceSessions, current);
  const values = history.map((p) => p[metric]);
  const labels = history.map((p) => new Date(p.date).toLocaleDateString());
  // Rolling mean over the trailing window: a gettable "floor" reference that
  // sits below Best, so it stays a beatable target on off days.
  const meanValues = rollingMean(values);
  // Goal line is strength-only, and only for lifts with a defensible threshold.
  const goal = metric === 'best1RM' ? STRENGTH_GOALS[current] : undefined;

  return (
    <div className="view">
      <h1>Progress</h1>

      {hasHistory ? (
        <>
          <select className="select" value={current} onChange={(e) => setSelected(e.target.value)}>
            {options.map((id) => (
              <option key={id} value={id}>
                {id === FULL_BODY
                  ? 'Full Body'
                  : id === UPPER_BODY
                    ? 'Upper Body'
                    : (groupOf(id) ?? exerciseName(id))}
              </option>
            ))}
          </select>

          <div className="metric-toggle">
            {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
              <button key={m} className={m === metric ? 'active' : ''} onClick={() => setMetric(m)}>
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          <div className="chart-wrap">
            <LineChart
              values={values}
              reference={meanValues}
              labels={labels}
              goal={showGoal ? goal : undefined}
            />
            {values.length > 0 && (
              <>
                <div className="chart-legend">
                  <span className="lg lg-data">{METRIC_LABELS[metric]}</span>
                  <span className="lg lg-mean">Mean</span>
                  {goal != null && (
                    <button
                      className={showGoal ? 'goal-toggle active' : 'goal-toggle'}
                      onClick={() => setShowGoal((s) => !s)}
                    >
                      Goal {goal.toLocaleString()}
                    </button>
                  )}
                </div>
                <div className="chart-stats">
                  <span>
                    <span className="cs-k">Last</span>{' '}
                    <strong>{values[values.length - 1].toLocaleString()}</strong>
                  </span>
                  <span>
                    <span className="cs-k">Best</span>{' '}
                    <strong>{Math.max(...values).toLocaleString()}</strong>
                  </span>
                  <span className="cs-n">{history.length} sessions</span>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <p className="muted subtitle">Finish a workout to see your volume and strength curves.</p>
      )}

      <WeeklyMuscles />
    </div>
  );
}
