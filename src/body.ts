/**
 * InBody scan history.
 *
 * Unlike workout data (user-owned, in localStorage), this lives in source and
 * is maintained by hand from the scan printouts. Readings are infrequent, so a
 * rebuild per entry is fine, and keeping it here means the numbers are always
 * available for analysis alongside the training data.
 *
 * ALL VALUES ARE NORMALIZED TO POUNDS. Scans taken on kg machines are converted
 * on entry (x 2.20462) and the original figures are noted in a comment on the
 * reading, so nothing from the printout is lost.
 *
 * Fields are optional where a machine doesn't report them: the older unit gives
 * WHR and a fitness score, the InBody 570 gives visceral fat, SMI and the
 * water split instead.
 */

export interface Segments {
  rightArm: number;
  leftArm: number;
  trunk: number;
  rightLeg: number;
  leftLeg: number;
}

/**
 * Written evaluation of a scan, kept alongside the numbers so the reasoning
 * is readable in the app rather than living in a chat log. Each one judges the
 * scan against the readings before it where there are any.
 */
export interface Insight {
  /** One-line verdict. */
  headline: string;
  /** Supporting analysis, one paragraph per entry. */
  points: string[];
}

export interface BodyReading {
  /** ISO date of the scan (local calendar day). */
  date: string;
  /** Where it was taken / which machine. */
  source: string;
  weight: number;
  /** Fat-free mass (the 570 calls this Lean Body Mass). */
  leanBodyMass: number;
  bodyFatMass: number;
  skeletalMuscleMass: number;
  bodyFatPct: number;
  bmi: number;
  /** Basal metabolic rate, kcal. Tracks lean mass closely. */
  bmr: number;
  totalBodyWater?: number;
  dryLeanMass?: number;
  intracellularWater?: number;
  extracellularWater?: number;
  ecwTbw?: number;
  visceralFat?: number;
  /** Skeletal muscle index, kg/m^2. */
  smi?: number;
  waistHipRatio?: number;
  fitnessScore?: number;
  segmentalLean?: Segments;
  segmentalFat?: Segments;
  insight?: Insight;
}

/**
 * Height, used for FFMI (the only stat derived here that needs it). Confirmed
 * by both printouts: the 2024 sheet records 180 cm, the 2026 sheet 5 ft 11.0 in.
 */
export const HEIGHT_M = 1.8034;
export const HEIGHT_LABEL = `5'11" (180 cm)`;

/** Fat-free mass index: lean mass (kg) / height (m)^2. */
export function ffmi(r: BodyReading): number {
  const leanKg = r.leanBodyMass / 2.20462;
  return leanKg / (HEIGHT_M * HEIGHT_M);
}

/**
 * FFMI at which development generally reads as clearly muscular. Untrained men
 * sit near 18-19, trained lifters 21-23, and the natural ceiling is around 25.
 *
 * This is the sturdier of the two targets in the app. The bench goal has to
 * translate muscle into a lift, and limb leverage swings that by roughly 15%
 * either way. FFMI skips that step and measures lean tissue directly.
 */
export const FFMI_GOAL = 23;

/** Lean mass (lb) corresponding to FFMI_GOAL at this height. */
export const LEAN_GOAL = Math.round(FFMI_GOAL * HEIGHT_M * HEIGHT_M * 2.20462);

/** Oldest first. */
export const BODY_READINGS: BodyReading[] = [
  {
    // Original printout in kg: weight 72.3, SMM 36.5, body fat 8.1, TBW 47.1,
    // FFM 64.2, protein 12.8, mineral 4.25. Segmental lean kg: RA 3.8, LA 4.0,
    // trunk 29.5, RL 10.0, LL 10.0. Segmental fat kg: RA 0.2, LA 0.2,
    // trunk 3.9, RL 1.3, LL 1.3.
    date: '2024-11-26',
    source: 'Fitness First @ DCC',
    weight: 159.4,
    leanBodyMass: 141.5,
    bodyFatMass: 17.9,
    skeletalMuscleMass: 80.5,
    bodyFatPct: 11.2,
    bmi: 22.3,
    bmr: 1756,
    totalBodyWater: 103.8,
    dryLeanMass: 37.7,
    waistHipRatio: 0.85,
    fitnessScore: 84,
    segmentalLean: { rightArm: 8.4, leftArm: 8.8, trunk: 65.0, rightLeg: 22.0, leftLeg: 22.0 },
    segmentalFat: { rightArm: 0.4, leftArm: 0.4, trunk: 8.6, rightLeg: 2.9, leftLeg: 2.9 },
    insight: {
      headline: 'Lean and light. Needed mass, not fat loss.',
      points: [
        'Genuinely lean at 11.2% body fat. Fat mass of 17.9 lb sat below the machine\'s own normal floor, so the reading flagged it as under rather than healthy-low. Skeletal muscle of 80.5 lb landed near the top of the general-population band, meaning reasonably developed for a non-lifter but not for someone training seriously.',
        'FFMI of 19.8 places this above an untrained average of roughly 18 to 19, and below the 21 to 23 range typical of a consistently trained lifter. Combined with the low fat, this is the classic starting point where the constraint is total mass rather than composition.',
        'Arms were already the thinnest link. Both arms together carried 17.2 lb of lean tissue against 65.0 lb in the trunk. The 8.8 versus 8.4 left-side edge is within ordinary variation and not worth acting on.',
        'The correct read at this point was to eat in a surplus and add size. Nothing here justified a cut. What follows shows that the direction was right and the rate was not.',
      ],
    },
  },
  {
    date: '2026-06-18',
    source: 'InBody 570',
    weight: 177.5,
    leanBodyMass: 143.1,
    bodyFatMass: 34.4,
    skeletalMuscleMass: 82.0,
    bodyFatPct: 19.4,
    bmi: 24.8,
    bmr: 1772,
    totalBodyWater: 104.7,
    dryLeanMass: 38.4,
    intracellularWater: 66.1,
    extracellularWater: 38.6,
    ecwTbw: 0.368,
    visceralFat: 6,
    smi: 8.5,
    segmentalLean: { rightArm: 8.14, leftArm: 8.05, trunk: 63.1, rightLeg: 22.31, leftLeg: 22.18 },
    segmentalFat: { rightArm: 1.8, leftArm: 1.8, trunk: 18.5, rightLeg: 4.9, leftLeg: 4.9 },
    insight: {
      headline: '18 lb gained since 2024, 16.5 of it fat, and almost all of it in the last six months.',
      points: [
        'The split is the headline. Weight rose 18.1 lb, fat mass rose 16.5 lb, and lean body mass moved 1.6 lb. Roughly 91% of the gain was fat. Skeletal muscle moved 1.5 lb over the same window, which agrees.',
        'A second number corroborates it independently. BMR rose only 16 kcal, from 1756 to 1772. Basal rate tracks lean tissue closely, so a near-flat BMR is what you would expect if very little muscle was added. Two separately derived figures pointing the same way is stronger evidence than either alone.',
        'The timing is sharper than the 19-month gap suggests. A separate series of 18 bioimpedance scans running October 2024 to December 2025 shows body fat sitting near 12% across that entire stretch, including a genuine cut down to 144 lb in March 2025. So the fat measured here was added in roughly the six months between December and June, not accumulated steadily. That window contains May, the month training nearly stopped, when a continued surplus would have gone almost entirely to fat.',
        'That same series pins down how much precision these scans actually have. Four readings taken within fifteen days of each other produced fat-free mass values spanning 7 lb, tracking hydration almost exactly. So treat any lean mass change smaller than about 4 lb from a single scan as noise rather than progress. The 1.6 lb recorded here sits inside that band, which is another reason to read it as flat rather than as slight growth.',
        'The fat went central. The trunk holds 18.5 lb of the 34.4 lb total, and the machine rates trunk fat at 185% of ideal against 118 to 121% for the arms and legs. That distribution is typical, and it is also the one that works hardest against a visible taper, since it thickens the waist and buries the abdominal wall.',
        'Nothing here is a health concern. Visceral fat of 6 sits under the threshold of 10, ECW/TBW of 0.368 indicates normal fluid balance, and SMI of 8.5 is far clear of any muscle-loss flag. This is a composition problem, not a medical one.',
        'Treat the segmental comparison with caution. This scan came from an InBody 570 running 5, 50 and 500 kHz, while the 2024 scan used a different unit at 20 and 100 kHz. Gross composition shifts of this size are far too large to be device error, but the limb-by-limb numbers should not be read as trends across the two sheets.',
        'Most importantly, this is not a verdict on the current program. The window covers the fragmented on-and-off period plus the fast bulk, and it closes two days before the first logged Sandwich session. It measures what came before the consistent phase, not the consistent phase itself.',
      ],
    },
  },
  {
    date: '2026-08-19',
    source: 'InBody 570',
    weight: 178.3,
    leanBodyMass: 146.8,
    bodyFatMass: 31.5,
    skeletalMuscleMass: 84.0,
    bodyFatPct: 17.7,
    bmi: 24.9,
    bmr: 1808,
    totalBodyWater: 107.6,
    dryLeanMass: 39.2,
    intracellularWater: 67.7,
    extracellularWater: 39.9,
    ecwTbw: 0.370,
    visceralFat: 6,
    smi: 8.7,
    segmentalLean: { rightArm: 8.47, leftArm: 8.55, trunk: 65.2, rightLeg: 22.53, leftLeg: 22.53 },
    segmentalFat: { rightArm: 1.31, leftArm: 1.31, trunk: 17.21, rightLeg: 4.41, leftLeg: 4.41 },
    insight: {
      headline: 'Muscle up, fat down, weight flat. The first scan that measures the program.',
      points: [
        'This one covers the training, not the run-up to it. All 58 logged sessions fall between these two scans, 62 days apart, which is a session every 1.07 days. The June reading closed two days before the first of them and measured the fragmented period that came before. This one measures the consistent phase from end to end.',
        'The gross numbers are the result you want. Lean body mass rose 3.7 lb, fat mass fell 2.9 lb, and scale weight moved 0.8 lb. Body fat went 19.4% to 17.7%, and skeletal muscle 82.0 to 84.0 lb. Recomposition at a flat weight, with no deliberate cut.',
        'The June entry set a rule that a lean change under about 4 lb from a single scan should be read as noise, and 3.7 sits just inside that. So the number needs a check rather than a celebration. The check is dry lean mass, which is lean tissue with the water stripped out: protein and mineral only. A hydration swing moves total body water and leaves dry lean mass alone. Dry lean mass rose 0.8 lb. Muscle is roughly 27% dry, so 0.8 lb of dry tissue implies about 3 lb of actual muscle, which would carry about 2.2 lb of water with it. Total body water rose 2.9 lb. The arithmetic is consistent with real tissue plus a modest amount of extra fluid.',
        'One caution on the other side. Of the new water, 55% went intracellular against a baseline intracellular share of 63%. Muscle holds its water inside cells, so growth should push that share up, not down. The shortfall says part of the gain is fluid rather than tissue. Taking both readings together, the honest estimate is 2 to 3 lb of real muscle in 62 days, not the full 3.7.',
        'Two things here look like independent confirmation and are not. Fat mass is computed as weight minus lean mass, so any error in lean flows straight into fat with the sign reversed. Lean up, fat down, weight flat is exactly the pattern a hydration difference produces, which makes it the confound rather than the corroboration. BMR is derived from lean mass as well, so its 36 kcal rise restates the same figure a third time. The June entry leaned on a flat BMR as separate evidence, and that was too generous. Dry lean mass is the one number in this panel that hydration cannot fake.',
        'The limb breakdown matches what the program actually trains. Arms gained 5.1% of their lean mass, the trunk 3.3%, and the legs 1.3%. Legs are an accessory menu of one exercise per session and they grew the least, in proportion. Left and right sit within 1% of each other everywhere, so there is no asymmetry to correct.',
        'FFMI moved 19.96 to 20.47, which leaves 18.1 lb of lean mass to reach the target of 23. At this scan\'s pace that would be a bit over a year, but this is the fastest stretch: returning after a fragmented period regains tissue faster than building genuinely new tissue, and the rate falls once that is spent. The earlier estimate of roughly two to three years still stands, with this data point at the optimistic end of it.',
        'One thing worth noting rather than changing. Across those 60 days the longest gap between sessions was 1.9 days, so this was training essentially every day with no planned rest. That is what produced the result, and it is also a cadence with no deload built into it. Connective tissue and central fatigue recover more slowly than muscle does, so an enforced break is not a setback here.',
        'Otherwise nothing to change. Visceral fat held at 6, ECW/TBW at 0.370 is normal fluid balance, and SMI rose 8.5 to 8.7. The program is doing what it was built to do, on a cadence you are actually keeping. Take the next scan no sooner than two months out, since anything closer will not clear the noise floor.',
      ],
    },
  },
];

/* -------------------------------------------------------------------------
 * Phase recommendation
 * ---------------------------------------------------------------------- */

/**
 * The body fat band worth running a bulk inside.
 *
 * A surplus does not split evenly between muscle and fat, and the split gets
 * worse the more fat you already carry. So there is a floor you bulk up from
 * and a ceiling you stop at. Below the floor you are spending time and
 * performance on leanness that buys no extra muscle; above the ceiling an
 * increasing share of every surplus pound is fat, and that fat has to come
 * back off before the next run.
 */
export const BULK_FLOOR = 12;
export const BULK_CEILING = 18;

/**
 * Body fat to cut to once the lean target is met.
 *
 * Lower than the bulk floor, because at that point the job changes. There is
 * no next surplus to leave runway for, so the only question left is what shows
 * the muscle, and that happens a few points below where you would start a bulk.
 */
export const REVEAL = 10;

/** Smallest change in a mass figure read as movement rather than as steady. */
const MOVED = 1;

export type Phase = 'cut' | 'bulk' | 'hold';

export interface PhaseVerdict {
  phase: Phase;
  /** The verdict word. */
  label: string;
  /** The single line under it. */
  line: string;
  /** Full reasoning, shown on tap. */
  why: string[];
}

/** Scale weight at which `lean` lb of lean mass sits at `pct`% body fat. */
function weightAt(lean: number, pct: number): number {
  return lean / (1 - pct / 100);
}

const lb = (n: number) => `${Math.round(n * 10) / 10} lb`;
const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

/**
 * Which phase the latest scan calls for.
 *
 * The band sets it at the edges and the direction of travel settles it in the
 * middle, which is how a bulk/cut cycle actually runs: you do not reverse at
 * 15% on the way up, you carry on to the ceiling. Inside the band with fat
 * holding steady and lean climbing, nothing is forced and the recomposition is
 * already delivering both halves, so it is left alone.
 */
function decide(latest: BodyReading, prev: BodyReading | null): Phase {
  if (latest.leanBodyMass >= LEAN_GOAL) return latest.bodyFatPct > REVEAL ? 'cut' : 'hold';
  if (latest.bodyFatPct >= BULK_CEILING) return 'cut';
  if (latest.bodyFatPct <= BULK_FLOOR) return 'bulk';
  if (!prev) return latest.bodyFatPct > (BULK_FLOOR + BULK_CEILING) / 2 ? 'cut' : 'bulk';
  const dFat = latest.bodyFatMass - prev.bodyFatMass;
  const dLean = latest.leanBodyMass - prev.leanBodyMass;
  if (dFat <= -MOVED) return 'cut';
  if (dFat >= MOVED) return 'bulk';
  return dLean >= MOVED ? 'hold' : 'bulk';
}

export function phaseFor(readings: BodyReading[]): PhaseVerdict | null {
  if (readings.length === 0) return null;
  const latest = readings[readings.length - 1];
  const prev = readings.length > 1 ? readings[readings.length - 2] : null;
  const phase = decide(latest, prev);

  const bf = latest.bodyFatPct;
  const lean = latest.leanBodyMass;
  const fat = latest.bodyFatMass;
  const leanGap = LEAN_GOAL - lean;
  const done = leanGap <= 0;
  const dFat = prev ? fat - prev.bodyFatMass : 0;
  const dLean = prev ? lean - prev.leanBodyMass : 0;
  const days = prev ? daysBetween(prev.date, latest.date) : 0;

  if (phase === 'cut') {
    // With the lean target met there is no next bulk to leave room for, so the
    // cut runs past the bulk floor to where the muscle actually shows.
    const floor = done ? REVEAL : BULK_FLOOR;
    // Solved from lean rather than from the rounded weight, so the pounds of
    // fat stay exact and the scale number is the rounded consequence of it.
    const targetFat = (lean * floor) / (100 - floor);
    const toLose = fat - targetFat;
    const target = Math.round(lean + targetFat);
    // Half to one percent of bodyweight a week is the rate that holds onto
    // lean tissue; past that the deficit starts taking muscle with the fat.
    const wk = (r: number) => Math.round(toLose / (latest.weight * r));
    const span = wk(0.01) === wk(0.005) ? `about ${wk(0.01)}` : `${wk(0.01)} to ${wk(0.005)}`;
    const why: string[] = [];

    why.push(
      done
        ? `Lean is at ${lb(lean)} against the ${lb(LEAN_GOAL)} target, so the mass goal is met. What is left is showing it, which is why this runs to ${REVEAL}% rather than the ${BULK_FLOOR}% you would start a bulk from.`
        : `At ${pct(bf)} you are at the top of the ${BULK_FLOOR} to ${BULK_CEILING}% window worth bulking inside. A surplus splits worse the more fat you carry, so starting one here puts you past ${BULK_CEILING + 4}% before it is worth stopping.`,
    );

    if (dFat <= -MOVED && dLean >= MOVED) {
      const rate = (-dFat / days) * 30;
      why.push(
        `Fat is already falling: ${lb(-dFat)} down, lean ${lb(dLean)} up, over ${days} days with no deficit. But ${lb(rate)} a month is ${Math.round(toLose / rate)} months to ${floor}%, against ${span} weeks for a real cut. Recomposition also slows as the return to training is spent, so that rate is the best it gets.`,
      );
    }

    why.push(
      `Drop ${lb(toLose)} of fat, ${lb(fat)} down to ${lb(targetFat)}. That is ${target} lb on the scale if lean holds, a few either side if it does not. ${span} weeks at half to one percent of bodyweight. Protein and training stay as they are.`,
    );

    if (!done) {
      why.push(
        `Then bulk. ${lb(leanGap)} of lean short of FFMI ${FFMI_GOAL} is several surpluses, and each one starts better from ${BULK_FLOOR}% than from ${pct(bf)}.`,
      );
    }

    return {
      phase,
      label: 'Cut',
      line: done ? `Cut to ${target} lb.` : `Cut to ${target} lb, then bulk.`,
      why,
    };
  }

  if (phase === 'bulk') {
    const target = Math.round(weightAt(lean, BULK_CEILING));
    const toGain = target - latest.weight;
    return {
      phase,
      label: 'Bulk',
      line: `Bulk to ${target} lb, then cut.`,
      why: [
        `At ${pct(bf)} you are inside the ${BULK_FLOOR} to ${BULK_CEILING}% window where a surplus mostly buys tissue rather than fat. This is the half of the cycle that adds mass.`,
        `${lb(leanGap)} of lean short of FFMI ${FFMI_GOAL}. Maintenance will not cover that. A surplus will, and the leaner you start it the more of it lands as muscle.`,
        `Run it to ${target} lb, which is ${BULK_CEILING}% at today's lean mass, then cut back to ${BULK_FLOOR}. Roughly ${lb(toGain)} of scale weight, at a quarter to a half pound a week. Faster does not add muscle faster, only fat.`,
      ],
    };
  }

  if (done) {
    return {
      phase,
      label: 'Hold',
      line: `The target is met at ${lb(lean)} of lean and ${pct(bf)}.`,
      why: [
        `Lean is past the ${lb(LEAN_GOAL)} that FFMI ${FFMI_GOAL} asks for, and at ${pct(bf)} it shows. Neither half of the goal has anything left to run.`,
        `Stay near maintenance and keep training and protein where they are. If fat climbs back above ${REVEAL}%, cut. Wanting more size is a new target rather than a continuation of this one.`,
      ],
    };
  }

  const rate = days ? (dLean / days) * 30 : 0;
  return {
    phase,
    label: 'Hold',
    line: 'Recomposition is doing both jobs.',
    why: [
      `Lean up ${lb(dLean)}, fat down ${lb(-dFat)}, over ${days} days. A surplus or a deficit would each hand you only one of those.`,
      `At ${pct(bf)} you are inside the ${BULK_FLOOR} to ${BULK_CEILING}% window, so neither direction is being forced.`,
      `You are gaining ${lb(rate)} of lean a month, and recomposition slows as the return to training is spent. When lean stops moving, go to a surplus. When fat starts climbing, cut.`,
    ],
  };
}

/** Whole days between two YYYY-MM-DD scan dates. */
function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime();
  return Math.round(ms / 86400000);
}
