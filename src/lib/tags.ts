import { limbFactor } from './laterality';

/**
 * Short badges shown beside an exercise's name, for the things the name would
 * otherwise have to spell out.
 *
 * "Cable Single Arm Underhand Tricep Pushdown" wraps onto two lines on a phone;
 * "Cable Underhand Tricep Pushdown" with a chip beside it doesn't. tagsFor()
 * returns a list so more kinds can be added later (tempo variants and the like)
 * without touching any of the places that render them.
 *
 * Labels are plain text, not emoji: an emoji renders in the system's own colour
 * font, which is a different weight and palette on every device.
 */
export interface ExerciseTag {
  id: string;
  /** What the chip reads. A couple of characters at most. */
  label: string;
  /** Spelled out, for the tooltip and screen readers. */
  title: string;
}

/**
 * The logged weight and reps cover one side of the body: one arm or one side of
 * the trunk at a time, or each hand on its own stack.
 *
 * Half, because that's what the number is a half of. The aggregates double it
 * (see laterality.ts) so a per-side movement and a two-limb one get equal say,
 * which makes the chip a reminder that the figure isn't comparable to the
 * unchipped lift above it.
 */
export const PER_SIDE: ExerciseTag = {
  id: 'per-side',
  label: '½',
  title: 'Weight and reps are per side',
};

/**
 * Read straight off limbFactor() rather than kept as a second list, so the chip
 * and the doubling it stands for can't drift apart: anything the aggregates
 * double is chipped, and nothing else is.
 *
 * A future tag of a different kind adds its own lookup here.
 */
export function tagsFor(exerciseId: string): ExerciseTag[] {
  return limbFactor(exerciseId) > 1 ? [PER_SIDE] : [];
}
