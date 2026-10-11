import { useState } from 'react';
import {
  BODY_READINGS,
  ffmi,
  FFMI_GOAL,
  HEIGHT_LABEL,
  LEAN_GOAL,
  phaseFor,
  type BodyReading,
  type Insight,
  type PhaseVerdict,
  type Segments,
} from '../body';
import { LineChart } from './LineChart';
import { useBackToClose } from '../lib/useBackToClose';
import { CloseButton } from './CloseButton';

type Metric =
  | 'weight'
  | 'leanBodyMass'
  | 'bodyFatMass'
  | 'bodyFatPct'
  | 'arms'
  | 'trunk'
  | 'legs';

interface MetricDef {
  id: Metric;
  label: string;
  unit: string;
  value: (r: BodyReading) => number | null;
  /**
   * Segmental series are only comparable within one machine. Different units
   * run different frequencies, which shifts the limb-by-limb figures far more
   * than the gross ones, so these plot only scans from the latest device.
   */
  segmental?: boolean;
}

/** Whole-body series. */
const METRICS: MetricDef[] = [
  { id: 'weight', label: 'Weight', unit: 'lb', value: (r) => r.weight },
  { id: 'leanBodyMass', label: 'Lean', unit: 'lb', value: (r) => r.leanBodyMass },
  { id: 'bodyFatMass', label: 'Fat', unit: 'lb', value: (r) => r.bodyFatMass },
  { id: 'bodyFatPct', label: 'Body Fat', unit: '%', value: (r) => r.bodyFatPct },
];

/**
 * Per-region series. Left and right are summed: they track within about 1% of
 * each other, so splitting them would draw two near-identical lines and halve
 * the scale of the movement being read.
 */
const REGION_METRICS: MetricDef[] = [
  {
    id: 'arms',
    label: 'Arms',
    unit: 'lb',
    segmental: true,
    value: (r) => (r.segmentalLean ? r.segmentalLean.rightArm + r.segmentalLean.leftArm : null),
  },
  {
    id: 'trunk',
    label: 'Trunk',
    unit: 'lb',
    segmental: true,
    value: (r) => r.segmentalLean?.trunk ?? null,
  },
  {
    id: 'legs',
    label: 'Legs',
    unit: 'lb',
    segmental: true,
    value: (r) => (r.segmentalLean ? r.segmentalLean.rightLeg + r.segmentalLean.leftLeg : null),
  },
];

const ALL_METRICS = [...METRICS, ...REGION_METRICS];

/** Which way is progress, so deltas can be colored honestly. */
type Dir = 'up' | 'down' | 'neutral';

const fmtDate = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const num = (n: number, dp = 1) =>
  n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

function Delta({ value, dir, unit }: { value: number | null; dir: Dir; unit: string }) {
  if (value == null) return <span className="body-delta muted">first scan</span>;
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return <span className="body-delta muted">no change</span>;
  const good = dir === 'neutral' ? null : (rounded > 0) === (dir === 'up');
  const cls = good == null ? 'body-delta' : good ? 'body-delta good' : 'body-delta bad';
  return (
    <span className={cls}>
      {rounded > 0 ? '+' : ''}
      {num(rounded)} {unit}
    </span>
  );
}

/** A headline stat, with a plain-language explanation shown on tap. */
interface StatDef {
  label: string;
  unit: string;
  dir: Dir;
  value: (r: BodyReading) => number;
  /** Decimal places for display. */
  dp?: number;
  explain: string[];
}

const STATS: StatDef[] = [
  {
    label: 'Weight',
    unit: 'lb',
    dir: 'neutral',
    value: (r) => r.weight,
    explain: [
      'Your total body weight.',
      'On its own it says nothing about what that weight is made of, which is why the change here is never marked good or bad. Two people at 177 lb can look completely different depending on how much of it is muscle and how much is fat.',
      'Its use is checking whether you are eating at maintenance. Steady weight while training hard means calories are roughly balanced. Rising weight means a surplus, whether or not you intended one.',
    ],
  },
  {
    label: 'Lean mass',
    unit: 'lb',
    dir: 'up',
    value: (r) => r.leanBodyMass,
    explain: [
      'Everything in your body that is not fat: muscle, organs, bone, and the water held in all of it. Also called fat-free mass.',
      'This is the number to watch for building size, because it is the tissue you are adding. Organs and bone barely change, so most of any movement here is muscle.',
      'It is also heavily affected by hydration. A single scan carries roughly 4 lb of error, so ignore any change smaller than that unless repeated scans point the same way.',
    ],
  },
  {
    label: 'Fat mass',
    unit: 'lb',
    dir: 'down',
    value: (r) => r.bodyFatMass,
    explain: [
      'The total weight of fat on your body, in pounds.',
      'This is better for tracking than body fat percentage, because only one thing moves it. If this number falls, you lost fat.',
    ],
  },
  {
    label: 'Body fat',
    unit: '%',
    dir: 'down',
    value: (r) => r.bodyFatPct,
    explain: [
      'Your fat mass as a share of your total weight.',
      'It determines whether the muscle you have is visible. Definition, abdominal separation and vascularity all depend on this number rather than on how much muscle you carry.',
      'It is a ratio, so it moves whenever either side changes. Gaining muscle lowers your body fat percentage without you losing any fat. Fat mass above is the cleaner number to track.',
    ],
  },
  {
    label: 'Muscle (SMM)',
    unit: 'lb',
    dir: 'up',
    value: (r) => r.skeletalMuscleMass,
    explain: [
      'Skeletal muscle mass: only the muscle attached to your skeleton, which is the tissue you train.',
      'It is narrower than lean mass, which also counts organs, bone and water. Skeletal muscle is normally a bit over half of lean mass.',
      'It should be the most relevant number in the panel. In practice it is calculated from the same impedance reading as lean mass, so it carries the same hydration error and moves with it.',
    ],
  },
  {
    label: `FFMI / ${FFMI_GOAL}`,
    unit: '',
    dir: 'up',
    value: ffmi,
    dp: 1,
    explain: [
      'Fat-free mass index: your lean mass divided by your height squared. It is BMI counting only lean tissue.',
      'BMI cannot tell muscle from fat. Your BMI of 24.8 reads as normal, but it counts 34 lb of fat the same as it would count muscle. FFMI leaves the fat out and measures how much lean tissue you carry for your height.',
      'For men the scale runs roughly 18 to 19 untrained, 20 to 21 for someone who trains and looks fit, 22 to 23 for clearly muscular, 24 to 25 near the natural limit, and 26 or above usually meaning drugs.',
      `The goal of ${FFMI_GOAL} shown here is where that look tends to appear, and it works out to ${LEAN_GOAL} lb of lean mass at your height. Unlike a lift, it cannot be reached through better technique.`,
    ],
  },
];

/** Everything the explainer sheet needs, whichever card opened it. */
interface Explainer {
  title: string;
  value: string;
  unit: string;
  points: string[];
  /** Extra classes on the value, so the phase sheet can carry the card's hue. */
  tone?: string;
}

/**
 * The verdict, above everything else on the tab. One word: it reads the latest
 * scan and the one before it, and every number and reason behind the call is a
 * tap away rather than on the card.
 */
function PhaseCard({ v, onOpen }: { v: PhaseVerdict; onOpen: () => void }) {
  return (
    <button className={`phase-card phase-${v.phase}`} onClick={onOpen}>
      <span className="phase-eyebrow">Phase</span>
      <strong className="phase-verdict">{v.label}</strong>
    </button>
  );
}

function StatCard({
  def,
  latest,
  delta,
  onOpen,
}: {
  def: StatDef;
  latest: BodyReading;
  delta: number | null;
  onOpen: () => void;
}) {
  return (
    <button className="body-stat" onClick={onOpen}>
      <span className="body-stat-label">{def.label}</span>
      <strong className="body-stat-value">
        {num(def.value(latest), def.dp ?? 1)}
        <small>{def.unit}</small>
      </strong>
      <Delta value={delta} dir={def.dir} unit={def.unit} />
    </button>
  );
}

function InsightBlock({ insight }: { insight: Insight }) {
  return (
    <div className="insight">
      <p className="insight-headline">{insight.headline}</p>
      {insight.points.map((p, i) => (
        <p key={i} className="insight-point">
          {p}
        </p>
      ))}
    </div>
  );
}

const SEG_KEYS: [keyof Segments, string][] = [
  ['rightArm', 'Right arm'],
  ['leftArm', 'Left arm'],
  ['trunk', 'Trunk'],
  ['rightLeg', 'Right leg'],
  ['leftLeg', 'Left leg'],
];

/**
 * Per-region breakdown, with the change since the previous scan.
 *
 * The change is shown as a percentage rather than in pounds because the bar
 * already carries absolute size. The trunk is 65 lb against an arm's 8, so it
 * gains the most pounds almost by definition; the percentage is what reveals
 * which regions actually grew fastest.
 *
 * Suppressed when the two scans came from different machines, since the
 * segmental figures aren't comparable across devices even when the gross ones
 * are.
 */
function SegmentTable({
  title,
  seg,
  prev,
  unit,
}: {
  title: string;
  seg: Segments;
  prev?: Segments;
  unit: string;
}) {
  const max = Math.max(...SEG_KEYS.map(([k]) => seg[k]));
  return (
    <div className="seg-block">
      <h2 className="section">{title}</h2>
      {SEG_KEYS.map(([key, name]) => {
        const v = seg[key];
        const was = prev?.[key];
        const pct = was ? ((v - was) / was) * 100 : null;
        return (
          <div key={name} className="seg-row">
            <span className="seg-name">{name}</span>
            <div className="seg-track">
              <div className="seg-fill" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <span className={pct == null ? 'seg-delta' : `seg-delta ${pct >= 0 ? 'up' : 'down'}`}>
              {pct == null ? '' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
            </span>
            <strong className="seg-val">
              {num(v)}
              <small>{unit}</small>
            </strong>
          </div>
        );
      })}
    </div>
  );
}

export function BodyView() {
  const [metric, setMetric] = useState<Metric>('leanBodyMass');
  const [showGoal, setShowGoal] = useState(false);
  const [explain, setExplain] = useState<Explainer | null>(null);
  useBackToClose(explain !== null, () => setExplain(null));
  const readings = BODY_READINGS;

  if (readings.length === 0) {
    return (
      <div className="view">
        <h1>Body</h1>
        <p className="muted subtitle">No scans recorded yet.</p>
      </div>
    );
  }

  const latest = readings[readings.length - 1];
  const prev = readings.length > 1 ? readings[readings.length - 2] : null;
  const d = (f: (r: BodyReading) => number) => (prev ? f(latest) - f(prev) : null);

  const phase = phaseFor(readings);
  const active = ALL_METRICS.find((m) => m.id === metric)!;
  // A segmental series drops scans from other machines rather than drawing a
  // step that only reflects a change of device.
  const plotted = (
    active.segmental ? readings.filter((r) => r.source === latest.source) : readings
  ).filter((r) => active.value(r) != null);
  const values = plotted.map((r) => active.value(r)!);
  const labels = plotted.map((r) => fmtDate(r.date));
  // Only lean mass gets a target. Fat mass and body fat depend on whether you're
  // cutting, and a bare weight target says nothing about what the weight is.
  const goal = metric === 'leanBodyMass' ? LEAN_GOAL : undefined;

  return (
    <div className="view">
      <h1>Body</h1>
      <p className="muted subtitle session-meta">
        <span className="range-chip">{fmtDate(latest.date)}</span>
        <span className="range-chip">{latest.source}</span>
      </p>

      {phase && (
        <PhaseCard
          v={phase}
          onOpen={() =>
            setExplain({
              title: 'Phase',
              value: phase.label,
              unit: '',
              tone: `phase-value phase-${phase.phase}`,
              points: phase.why,
            })
          }
        />
      )}

      <div className="body-stats">
        {STATS.map((s) => (
          <StatCard
            key={s.label}
            def={s}
            latest={latest}
            delta={d(s.value)}
            onOpen={() =>
              setExplain({
                title: s.label,
                value: num(s.value(latest), s.dp ?? 1),
                unit: s.unit,
                points: s.explain,
              })
            }
          />
        ))}
      </div>

      <div className="metric-toggle">
        {METRICS.map((m) => (
          <button
            key={m.id}
            className={m.id === metric ? 'active' : ''}
            onClick={() => setMetric(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="metric-toggle region-toggle">
        {REGION_METRICS.map((m) => (
          <button
            key={m.id}
            className={m.id === metric ? 'active' : ''}
            onClick={() => setMetric(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="chart-wrap">
        <LineChart values={values} labels={labels} goal={showGoal ? goal : undefined} />
        <div className="chart-legend">
          <span className="lg lg-data">{active.label}</span>
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
            <strong>
              {num(values[values.length - 1])} {active.unit}
            </strong>
          </span>
          {/* Counts what the chart is actually drawing, which for a segmental
              series excludes scans from other machines. */}
          <span className="cs-n">
            {plotted.length} scan{plotted.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {latest.segmentalLean && (
        <SegmentTable
          title="Segmental lean"
          seg={latest.segmentalLean}
          prev={prev?.source === latest.source ? prev.segmentalLean : undefined}
          unit="lb"
        />
      )}

      {latest.insight && (
        <>
          <h2 className="section">Analysis</h2>
          <InsightBlock insight={latest.insight} />
        </>
      )}

      <h2 className="section">Scans</h2>
      <div className="history-list">
        {[...readings].reverse().map((r) => (
          <details key={r.date} className="history-card">
            <summary>
              <div>
                <div className="history-name">{fmtDate(r.date)}</div>
                <div className="muted small">
                  {num(r.weight)} lb · {num(r.bodyFatPct)}% fat · {num(r.leanBodyMass)} lb lean
                </div>
              </div>
            </summary>
            <div className="history-body">
              <div className="body-detail">
                {(
                  [
                    ['Source', r.source],
                    ['Height', HEIGHT_LABEL],
                    ['Weight', `${num(r.weight)} lb`],
                    ['Lean body mass', `${num(r.leanBodyMass)} lb`],
                    ['Skeletal muscle', `${num(r.skeletalMuscleMass)} lb`],
                    ['Body fat mass', `${num(r.bodyFatMass)} lb`],
                    ['Body fat', `${num(r.bodyFatPct)}%`],
                    ['FFMI', num(ffmi(r), 2)],
                    ['BMI', num(r.bmi)],
                    ['BMR', `${r.bmr.toLocaleString()} kcal`],
                    r.totalBodyWater && ['Total body water', `${num(r.totalBodyWater)} lb`],
                    r.dryLeanMass && ['Dry lean mass', `${num(r.dryLeanMass)} lb`],
                    r.ecwTbw && ['ECW/TBW', num(r.ecwTbw, 3)],
                    r.visceralFat && ['Visceral fat', String(r.visceralFat)],
                    r.smi && ['SMI', `${num(r.smi)} kg/m²`],
                    r.waistHipRatio && ['Waist-hip ratio', num(r.waistHipRatio, 2)],
                    r.fitnessScore && ['Fitness score', String(r.fitnessScore)],
                  ].filter(Boolean) as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="body-detail-row">
                    <span className="muted small">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
              {r.insight && <InsightBlock insight={r.insight} />}
            </div>
          </details>
        ))}
      </div>

      {explain && (
        <div className="modal-overlay" onClick={() => setExplain(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">{explain.title}</span>
              <CloseButton onClick={() => setExplain(null)} label="Close" />
            </div>
            <p className={`stat-explain-value ${explain.tone ?? ''}`}>
              {explain.value}
              {explain.unit && <small>{explain.unit}</small>}
            </p>
            {explain.points.map((p, i) => (
              <p key={i} className="insight-point">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
