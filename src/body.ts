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
  /**
   * Clock time of the scan, HH:MM on a 24-hour clock. Omitted where the
   * printout is no longer to hand.
   *
   * It matters because fluid redistributes over a day. A night lying down
   * moves it toward the trunk and a day upright pools it in the legs, and
   * segmental impedance reads that as limb tissue. Two scans taken at
   * different hours are not comparable limb by limb even on the same machine.
   */
  time?: string;
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

/**
 * Largest gap in clock time between two scans whose limb figures are still
 * worth comparing. Four hours is short enough to keep a morning scan from
 * being read against an afternoon one, and long enough that two scans taken
 * in the same part of the day still compare.
 */
export const COMPARABLE_HOURS = 4;

/** Hours between two HH:MM clock times, ignoring which day each fell on. */
function clockGap(a: string, b: string): number {
  const mins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  return Math.abs(mins(a) - mins(b)) / 60;
}

/**
 * Whether two scans' limb-by-limb figures can be read against each other.
 *
 * Different machines run different frequencies, which moves the segmental
 * numbers far more than the gross ones. Different times of day move them too,
 * through fluid redistribution. Either difference rules the comparison out.
 */
export function segmentsComparable(a: BodyReading, b: BodyReading): boolean {
  if (a.source !== b.source) return false;
  if (!a.time || !b.time) return false;
  return clockGap(a.time, b.time) <= COMPARABLE_HOURS;
}

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
      headline: 'Lean and light. The limit was total muscle, not body fat.',
      points: [
        'Body fat was 11.2%. Fat mass of 17.9 lb was below the machine\'s own normal range, so it was flagged as under rather than as healthy-low. Skeletal muscle of 80.5 lb was near the top of the general-population range, which is well developed for someone who does not lift and unremarkable for someone who does.',
        'FFMI was 19.8. That is above the untrained average of roughly 18 to 19 and below the 21 to 23 typical of a trained lifter. With body fat already low, the limit was total muscle rather than composition.',
        'Arms were the weakest area. Both arms together held 17.2 lb of lean tissue against 65.0 lb in the trunk. The left arm read 8.8 lb against the right at 8.4 lb, which is within normal variation and not worth correcting.',
        'The right call was to eat in a surplus and add size. Nothing here called for a cut. The next scan shows the direction was right and the rate was too fast.',
      ],
    },
  },
  {
    date: '2026-06-18',
    time: '13:58',
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
      headline: '18.1 lb gained since 2024. 16.5 lb of it was fat, almost all added in the last six months.',
      points: [
        'Weight rose 18.1 lb. Fat mass rose 16.5 lb and lean mass rose 1.6 lb, so about 91% of the gain was fat. Skeletal muscle rose 1.5 lb over the same period, which agrees.',
        'BMR rose only 16 kcal, from 1756 to 1772. Basal rate tracks lean tissue closely, so a flat BMR is what you would expect if little muscle was added.',
        'The 19-month gap between scans overstates how long this took. A separate series of 18 bioimpedance scans from October 2024 to December 2025 shows body fat near 12% throughout, including a cut down to 144 lb in March 2025. The fat measured here was added in roughly the six months from December to June, not gradually. That period includes May, when training nearly stopped and a continued surplus would have gone almost entirely to fat.',
        'That series also shows how precise these scans are. Four readings taken within fifteen days of each other gave fat-free mass values spanning 7 lb, tracking hydration. Treat any lean mass change under about 4 lb from a single scan as noise. The 1.6 lb here is inside that range, so read it as flat rather than as slight growth.',
        'The fat is concentrated in the trunk, which holds 18.5 lb of the 34.4 lb total. The machine rates trunk fat at 185% of ideal against 118 to 121% for the arms and legs. This distribution is typical, and it is the one that most affects appearance, because it thickens the waist and covers the abdominal muscles.',
        'Nothing here is a health concern. Visceral fat of 6 is under the threshold of 10, ECW/TBW of 0.368 is normal fluid balance, and SMI of 8.5 is well clear of any muscle-loss flag.',
        'The limb-by-limb numbers are not comparable to the 2024 scan. This one came from an InBody 570 running 5, 50 and 500 kHz; the 2024 scan used a different machine at 20 and 100 kHz. The whole-body changes are far too large to be device error, but the segmental figures should not be read as trends across the two.',
        'This is not a result for the current program. The period covered is the fragmented on-and-off stretch plus the fast bulk, and it ends two days before the first session logged in this app.',
      ],
    },
  },
  {
    date: '2026-08-19',
    time: '04:17',
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
      headline: 'Lean mass up, fat down, weight flat. The first scan covering the current program.',
      points: [
        'All 58 logged sessions fall between these two scans, 62 days apart, which is a session every 1.07 days. The June scan ended two days before the first of them. This one covers the consistent training period from start to finish.',
        'Lean mass rose 3.7 lb, fat mass fell 2.9 lb, and weight moved 0.8 lb. Body fat went from 19.4% to 17.7% and skeletal muscle from 82.0 to 84.0 lb. That is recomposition at a flat weight, with no deliberate cut.',
        'The June entry set a rule that a lean change under about 4 lb from one scan is noise, and 3.7 lb is inside that, so it needs checking. The check is dry lean mass: lean tissue with the water removed, protein and mineral only. Hydration moves total body water and leaves dry lean mass alone. Dry lean mass rose 0.8 lb. Muscle is roughly 27% dry, so 0.8 lb of dry tissue implies about 3 lb of muscle, which would carry about 2.2 lb of water with it. Total body water rose 2.9 lb. Those numbers are consistent with real tissue plus some extra fluid.',
        'Against that, 55% of the new water went inside cells, where the existing split is 63%. Muscle holds its water inside cells, so growth should raise that share rather than lower it. The shortfall means part of the gain is fluid. Taking both together, the estimate is 2 to 3 lb of real muscle in 62 days rather than the full 3.7.',
        'Two numbers here look like separate confirmation and are not. Fat mass is calculated as weight minus lean mass, so any error in lean mass passes into fat mass with the sign reversed. Lean up, fat down and weight flat is exactly what a hydration difference produces. BMR is also calculated from lean mass, so its 36 kcal rise is the same figure a third time. The June entry treated a flat BMR as separate evidence, which was wrong. Dry lean mass is the only number in this panel that hydration cannot fake.',
        'The limb breakdown appeared to match the program, with arms up 5.1% of their lean mass, the trunk up 3.3% and the legs up 1.3%. That reading does not hold. This scan was taken at 04:17 and the June scan at 13:58. A night lying down moves fluid toward the trunk and a day upright pools it in the legs, and segmental impedance reads that as limb tissue, so the two are not comparable limb by limb. The October scan confirms it: at 15:22 the same machine put the legs up and the arms down while total lean mass held. Left and right are within 1% of each other in every scan, which is the one segmental reading that does hold.',
        'FFMI went from 19.96 to 20.47, leaving 18.1 lb of lean mass to reach the target of 23. At this scan\'s rate that is a bit over a year, but this is the fastest stretch. Returning after a break regains tissue faster than building new tissue, and the rate falls once that is used up. The earlier estimate of two to three years still stands, with this scan at the optimistic end of it.',
        'Across those 60 days the longest gap between sessions was 1.9 days, so this was training nearly every day with no planned rest. That produced the result, and it also means there is no deload in the schedule. Connective tissue and central fatigue recover more slowly than muscle, so a forced break is not a setback.',
        'Nothing else needs changing. Visceral fat held at 6, ECW/TBW at 0.370 is normal fluid balance, and SMI rose from 8.5 to 8.7. Take the next scan no sooner than two months out; anything closer will not clear the noise floor.',
      ],
    },
  },
  {
    date: '2026-10-14',
    time: '15:22',
    source: 'InBody 570',
    weight: 175.2,
    leanBodyMass: 147.1,
    bodyFatMass: 28.2,
    skeletalMuscleMass: 84.2,
    bodyFatPct: 16.1,
    bmi: 24.4,
    bmr: 1811,
    totalBodyWater: 107.6,
    dryLeanMass: 39.5,
    intracellularWater: 67.9,
    extracellularWater: 39.7,
    ecwTbw: 0.369,
    visceralFat: 5,
    smi: 8.7,
    segmentalLean: { rightArm: 8.0, leftArm: 8.16, trunk: 63.0, rightLeg: 23.33, leftLeg: 23.08 },
    segmentalFat: { rightArm: 1.3, leftArm: 1.3, trunk: 14.8, rightLeg: 4.4, leftLeg: 4.2 },
    insight: {
      headline: 'Fat down 3.3 lb, lean mass flat. The recomposition has stopped.',
      points: [
        'Over the 56 days since the August scan, fat mass fell 3.3 lb and lean mass rose 0.3 lb. Weight fell 3.1 lb, from 178.3 lb to 175.2 lb. Body fat went from 17.7% to 16.1%.',
        'Lean mass is flat. The 0.3 lb rise is well inside the 4 lb noise floor for a single scan. Dry lean mass rose 0.3 lb and total body water was unchanged at 107.6 lb, so there is no hydration difference pushing the figure either way. This interval was fat loss with lean mass held.',
        'The August scan predicted this. It said the return-to-training regain would run out and the rate would fall. Lean mass rose 3.7 lb in the 62 days to August and 0.3 lb in the 56 days since.',
        'Across the full 118 days since June the numbers resolve better than either interval does alone. Dry lean mass rose 1.1 lb, from 38.4 lb to 39.5 lb. Muscle is roughly 27% dry, so that implies about 4.1 lb of muscle, which would carry about 3.0 lb of water with it. Total body water rose 2.9 lb and lean mass rose 4.0 lb. Four figures agree on about 4 lb of real muscle since June, which is roughly 1 lb per month.',
        'Weight fell 0.39 lb per week over the 56 days, which is a deficit of about 194 kcal per day. Whether or not it was intentional, you have already been cutting slowly.',
        'The fat came off the trunk. Trunk fat fell 2.4 lb, from 17.2 lb to 14.8 lb, which is most of the 3.3 lb total. Arms and legs moved 0.2 lb or less. The machine rates trunk fat at 147% of ideal, down from 185% in June. The June scan recorded that the fat had gone central and that this is the distribution that most affects appearance.',
        'The segmental figures are a clock artifact, not tissue. Arms fell 5.5% and 4.6%, the trunk fell 3.4%, and the legs rose 3.6% and 2.4%, while total lean mass held. This scan was at 15:22 and the August scan at 04:17. A day upright pools fluid in the legs and a night lying down moves it to the trunk, which is exactly the pattern here, and it runs opposite to the training: legs were barely worked over this period and arms were worked every day. Compare June at 13:58 against this scan at 15:22 instead. Both are mid-afternoon, and across those 118 days the trunk moved 0.1 lb and the arms 0.03 lb.',
        'Visceral fat fell from level 6 to level 5. ECW/TBW is 0.369, which is normal fluid balance. SMI held at 8.7. BMR rose 3 kcal, from 1808 to 1811, which matches flat lean mass.',
        'FFMI is 20.52, up from 20.47. The target is 23, which is 165 lb of lean mass, so 17.9 lb of lean mass remains. The rate of about 1 lb per month came from a stretch that included the regain, so the earlier estimate of two to three years still stands.',
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
    // Solved from lean, then every figure printed at the one decimal the scans
    // use, so the arithmetic closes whichever way it is checked.
    const targetFat = (lean * floor) / (100 - floor);
    const toLose = fat - targetFat;
    const target = latest.weight - toLose;
    // Half to one percent of bodyweight a week is the rate that holds onto
    // lean tissue; past that the deficit starts taking muscle with the fat.
    const wk = (r: number) => Math.round(toLose / (latest.weight * r));
    const span = wk(0.01) === wk(0.005) ? `about ${wk(0.01)}` : `${wk(0.01)} to ${wk(0.005)}`;
    // Where the whole programme ends, as opposed to where this phase ends.
    const goalWeight = weightAt(LEAN_GOAL, BULK_FLOOR);
    const why: string[] = [];

    if (done) {
      why.push(
        `Lean mass is ${lb(lean)}. The target is ${lb(LEAN_GOAL)}, so the muscle goal is met. What remains is lowering body fat enough to see it. This cut runs to ${REVEAL}% body fat rather than the ${BULK_FLOOR}% used to start a surplus.`,
      );
    } else if (bf >= BULK_CEILING) {
      why.push(
        `Your body fat is ${pct(bf)}, above the ${BULK_FLOOR}% to ${BULK_CEILING}% range a surplus runs in. The more fat you carry when a surplus starts, the more of the gain is fat rather than muscle.`,
      );
    } else {
      why.push(
        `Your body fat is ${pct(bf)}. A surplus runs from ${BULK_FLOOR}% body fat up to ${BULK_CEILING}%. Starting one now would leave ${pct(BULK_CEILING - bf)} of that range to use, against ${BULK_CEILING - BULK_FLOOR}% if you finish the cut to ${BULK_FLOOR}% first. The more fat you carry when a surplus starts, the more of the gain is fat rather than muscle.`,
      );
    }

    if (dFat <= -MOVED) {
      const rate = (-dFat / days) * 30;
      why.push(
        `Fat is already coming off. Over the ${days} days between the last two scans, fat mass fell ${lb(-dFat)} and lean mass ${dLean >= MOVED ? `rose ${lb(dLean)}` : `held at ${lb(lean)}`}. That rate is ${lb(rate)} of fat per month, which would reach ${floor}% body fat in about ${Math.round(toLose / rate)} months. A deliberate deficit would do it in ${span} weeks.`,
      );
    }

    why.push(
      `During the cut, fat mass goes from ${lb(fat)} to ${lb(targetFat)}, a loss of ${lb(toLose)}. Lean mass stays at ${lb(lean)}. Body weight goes from ${lb(latest.weight)} to ${lb(target)}. At half to one percent of body weight per week, that takes ${span} weeks. Protein and training stay the same.`,
    );

    if (!done) {
      why.push(
        `${lb(target)} is the end of the cut. It is not the final target. The final target is ${lb(LEAN_GOAL)} of lean mass, which is FFMI ${FFMI_GOAL}. At ${BULK_FLOOR}% body fat that is ${lb(goalWeight)} of body weight with ${lb(goalWeight - LEAN_GOAL)} of fat, ${lb(goalWeight - latest.weight)} heavier than you are now. Reaching it means adding ${lb(leanGap)} of lean mass, which takes more than one surplus. A surplus adds more muscle when it starts at ${BULK_FLOOR}% body fat than at ${pct(bf)}.`,
      );
    }

    return { phase, label: 'Cut', why };
  }

  if (phase === 'bulk') {
    const targetWeight = weightAt(lean, BULK_CEILING);
    const toGain = targetWeight - latest.weight;
    return {
      phase,
      label: 'Bulk',
      why: [
        `Your body fat is ${pct(bf)}. A surplus works best started between ${BULK_FLOOR}% and ${BULK_CEILING}% body fat, so you are in that range.`,
        `Lean mass is ${lb(lean)}. The target is ${lb(LEAN_GOAL)}, so you are ${lb(leanGap)} short. Eating at maintenance will not close that. A surplus will, and more of it becomes muscle the leaner you are when it starts.`,
        `Run the surplus until body fat reaches ${BULK_CEILING}%. At your current lean mass of ${lb(lean)}, that is ${lb(targetWeight)} of body weight, ${lb(toGain)} above where you are now. Then cut back to ${BULK_FLOOR}% body fat. Gain at a quarter to a half pound per week. Gaining faster adds fat rather than muscle, and makes the next cut longer.`,
      ],
    };
  }

  if (done) {
    return {
      phase,
      label: 'Hold',
      why: [
        `Lean mass is ${lb(lean)}, above the ${lb(LEAN_GOAL)} target for FFMI ${FFMI_GOAL}. Body fat is ${pct(bf)}, which is low enough to show it. Both parts of the goal are met.`,
        `Stay at maintenance. Keep training and protein the same. Cut if body fat goes above ${REVEAL}%. A larger size target would be a new goal with a new number.`,
      ],
    };
  }

  const rate = days ? (dLean / days) * 30 : 0;
  return {
    phase,
    label: 'Hold',
    why: [
      `Between the last two scans, ${days} days apart, lean mass rose ${lb(dLean)} and fat mass fell ${lb(-dFat)}. Both are moving the right way at once. A surplus would raise lean mass but also raise fat mass. A deficit would lower fat mass but not raise lean mass.`,
      `Your body fat is ${pct(bf)}, inside the ${BULK_FLOOR}% to ${BULK_CEILING}% range, so neither a surplus nor a deficit is required.`,
      `Lean mass is rising at ${lb(rate)} per month. That rate drops once the return-to-training regain is used up. Switch to a surplus when lean mass stops rising. Switch to a cut when fat mass starts rising.`,
    ],
  };
}

/** Whole days between two YYYY-MM-DD scan dates. */
function daysBetween(a: string, b: string): number {
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime();
  return Math.round(ms / 86400000);
}
