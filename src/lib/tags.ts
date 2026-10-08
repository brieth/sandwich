/**
 * Short badges shown beside an exercise's name, for the things the name would
 * otherwise have to spell out.
 *
 * "Cable Single Arm Underhand Tricep Pushdown" wraps onto two lines on a phone;
 * "Cable Underhand Tricep Pushdown" with a chip beside it doesn't. Tags are a
 * list per exercise so more kinds can be added later (tempo variants and the
 * like) without touching any of the places that render them.
 */
export interface ExerciseTag {
  id: string;
  /** What the chip reads. A couple of characters at most. */
  label: string;
  /** Spelled out, for the tooltip and screen readers. */
  title: string;
}

export const ONE_ARM: ExerciseTag = {
  id: 'one-arm',
  label: '1\u{1F4AA}',
  title: 'One arm at a time',
};

/**
 * Worked one arm at a time.
 *
 * NOT the same as per-limb (see laterality.ts), which is about how a logged
 * weight scales into the aggregates. The crossover flys have each hand on its
 * own stack but work both arms at once, and the woodchoppers and oblique crunch
 * are one side of the trunk rather than one arm. All of those are per-limb;
 * none of them are tagged here.
 */
const ONE_ARM_IDS = [
  'cable-single-arm-high-row',
  'cable-single-arm-mid-row',
  'cable-single-arm-low-row',
  'cable-behind-the-back-bicep-curl',
  'cable-behind-the-back-lateral-raise',
  'cable-single-arm-rear-delt-fly',
  'cable-single-arm-underhand-tricep-pushdown',
  // retired, tagged so History still reads right
  'shotgun-row',
];

const TAGS: Record<string, ExerciseTag[]> = {};
for (const id of ONE_ARM_IDS) TAGS[id] = [ONE_ARM];

export function tagsFor(exerciseId: string): ExerciseTag[] {
  return TAGS[exerciseId] ?? [];
}
