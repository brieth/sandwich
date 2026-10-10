import { useId } from 'react';
import { implementFor, IMPLEMENT_LABELS, type Implement } from '../lib/implements';

/*
 * Drawn as strokes in currentColor so one set works at any size and in any
 * colour. Kept to two or three marks each: at 16px on a phone, anything finer
 * turns to mush.
 *
 * Each takes a mask id, since one of them needs a mask and the id has to be
 * unique per rendered instance.
 */
const PATHS: Record<Implement, (maskId: string) => JSX.Element> = {
  // sleeve with two plates a side
  barbell: () => (
    <>
      <path d="M2 12h20" />
      <path d="M6 8v8M9 9.5v5M15 9.5v5M18 8v8" />
    </>
  ),
  // wide bar under its yoke, ends angled down
  latbar: () => (
    <>
      <path d="M3 20l3.5-3h11l3.5 3" />
      <path d="M8.5 17l3.5-6 3.5 6" />
      <circle cx="12" cy="9" r="2" />
    </>
  ),
  // short straight bar under its yoke
  bar: () => (
    <>
      <path d="M5 18h14" />
      <path d="M8.5 18l3.5-7 3.5 7" />
      <circle cx="12" cy="8" r="2" />
    </>
  ),
  // two strands off a ring, knotted ends
  rope: () => (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M11 7c-2 4-4 7-5 11M13 7c2 4 4 7 5 11" />
      <path d="M5 19h2M17 19h2" />
    </>
  ),
  // the D: straight grip, looped back
  handle: () => (
    <>
      <circle cx="12" cy="4" r="1.5" />
      <path d="M12 5.5V8" />
      <path d="M8 8v12M8 8h3a6 6 0 0 1 0 12H8" />
    </>
  ),
  /*
   * Carabiner, traced from a reference photo and refitted to six curves. Both
   * flanks run straight between the waist and the gate, which is the plain gap
   * on the left. The hinge above it is subtracted rather than drawn: a domed
   * kerf, so both cut faces follow the same arc instead of ending in the round
   * caps a broken path would give, and a rivet hole masked out of the crux.
   * The hole sits where it does because the centre was solved off the rendered
   * pixels, not off the path data, which the curve fit moves by up to 0.2.
   */
  clip: (maskId) => (
    <>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect x="0" y="0" width="24" height="24" fill="#fff" stroke="none" />
        <path d="M7.41 9A1.42 1.42 0 0 1 10.21 9" stroke="#000" strokeWidth="0.6" />
        <circle cx="8.94" cy="8.92" r="0.44" fill="#000" stroke="none" />
      </mask>
      {/* Scaled as a whole rather than redrawn smaller, so the gate gap, the
          kerf and the rivet keep their proportions against the stroke. */}
      <g transform="translate(12 12) scale(0.82) translate(-12 -12)">
        <path
          d="M7.25 15.44C7.86 12.88 8.95 10.08 9.17 7.47C9.31 5.79 8.16 4.53 9.67 3.1C11.24 1.63 14.15 2 15.18 3.92C15.89 5.24 14.8 6.23 14.99 7.53C15.39 10.35 17.53 15.52 17.04 18.1C16.14 22.9 7.57 23.06 6.98 18.01"
          mask={`url(#${maskId})`}
        />
      </g>
    </>
  ),
  // weight stack
  machine: () => (
    <>
      <rect x="6" y="5" width="12" height="15" rx="1.5" />
      <path d="M6 10h12M6 14h12" />
    </>
  ),
};

/** The icon for one exercise, or nothing when it has no implement recorded. */
export function ImplementIcon({ exerciseId }: { exerciseId: string }) {
  // colons are legal in an id but awkward in a url() reference, so drop them
  const maskId = `impl-${useId().replace(/:/g, '')}`;
  const kind = implementFor(exerciseId);
  if (!kind) return null;
  const label = IMPLEMENT_LABELS[kind];
  return (
    <span className="ex-icon" title={label}>
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {PATHS[kind](maskId)}
    </svg>
    </span>
  );
}
