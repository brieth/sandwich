import { useId } from 'react';
import { implementFor, IMPLEMENT_LABELS, type Implement } from '../lib/implements';

/** How much of its frame every icon's artwork fills. */
const ART = 0.75;

const CARABINER =
  'M7.25 15.44C7.86 12.88 8.95 10.08 9.17 7.47C9.31 5.79 8.16 4.53 9.67 3.1' +
  'C11.24 1.63 14.15 2 15.18 3.92C15.89 5.24 14.8 6.23 14.99 7.53' +
  'C15.39 10.35 17.53 15.52 17.04 18.1C16.14 22.9 7.57 23.06 6.98 18.01';

/*
 * The gate hinge: a domed kerf and a rivet hole subtracted from the outline
 * just below the waist, rather than drawn on top of it, so both cut faces
 * follow the same arc instead of the round caps a broken path leaves.
 *
 * Off. Below roughly 24px it reads as a nick rather than a hinge. Kept wired
 * up because the hole's centre is solved against the rendered pixels and not
 * the path data, which the curve fit moves by up to 0.2, so it is not quick to
 * reconstruct. Flip this to bring it back.
 */
const HINGE: boolean = false;

/*
 * Drawn as strokes in currentColor so one set works at any size and in any
 * colour. Kept to two or three marks each: at 16px on a phone, anything finer
 * turns to mush.
 *
 * Each takes a mask id, since one of them needs a mask and the id has to be
 * unique per rendered instance.
 */
const PATHS: Record<Implement, (maskId: string) => JSX.Element> = {
  // sleeve with two plates a side, loaded the way you actually load a bar:
  // the big plate inboard against the collar, the small one outside it
  barbell: () => (
    <>
      <path d="M2 12h20" />
      <path d="M6 9.5v5M9 8v8M15 8v8M18 9.5v5" />
    </>
  ),
  // wide bar under its yoke, ends angled down
  latbar: () => (
    <>
      <path d="M3 18.5l3.5-3h11l3.5 3" />
      <path d="M8.5 15.5l3.5-6 3.5 6" />
      <circle cx="12" cy="7.5" r="2" />
    </>
  ),
  // short straight bar on a single stem
  straight: () => (
    <>
      <path d="M5 18h14" />
      <path d="M12 10V18" />
      <circle cx="12" cy="8" r="2" />
    </>
  ),
  // the EZ curl bend, on a single stem. Ends and centre run level at 17.25
  // with the two grip sections dipping to 18.75 between them. Sat 0.75 above
  // the straight bar so those dips do not drag the ink off centre.
  cambered: () => (
    <>
      <path d="M5 17.25h2l2 1.5l1.5-1.5h3l1.5 1.5l2-1.5h2" />
      <path d="M12 9.25V17.25" />
      <circle cx="12" cy="7.25" r="2" />
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
  // the D, turned a quarter anticlockwise so the straight grip lies flat at
  // the bottom and the loop arches over it, which is how it hangs. Same
  // geometry as before, 12 of grip and a radius 6 loop, rotated and recentred.
  handle: () => (
    <>
      <circle cx="12" cy="6.5" r="2" />
      <path d="M12 8.5V10.5" />
      <path d="M6 19.5h12" />
      <path d="M6 19.5v-3a6 6 0 0 1 12 0v3" />
    </>
  ),
  /*
   * Carabiner, traced from a reference photo and refitted to six curves. Both
   * flanks run straight between the waist and the gate, which is the gap on
   * the left.
   */
  clip: (maskId) => (
    <>
      {HINGE ? (
        <>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect x="0" y="0" width="24" height="24" fill="#fff" stroke="none" />
            <path d="M7.41 9A1.42 1.42 0 0 1 10.21 9" stroke="#000" strokeWidth="0.6" />
            <circle cx="8.94" cy="8.92" r="0.44" fill="#000" stroke="none" />
          </mask>
          <path d={CARABINER} mask={`url(#${maskId})`} />
        </>
      ) : (
        <path d={CARABINER} />
      )}
    </>
  ),
  // weight stack: three equal plates, so the dividers sit on the thirds of the
  // box rather than at 10 and 14, which cut it 5, 4, 6
  machine: () => (
    <>
      <rect x="6" y="5" width="12" height="15" rx="1.5" />
      <path d="M6 10h12M6 15h12" />
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
      {/*
        * Every icon sits back off its frame by the same amount. Applied here
        * rather than per icon, because the transform scales the stroke along
        * with the geometry: an icon scaled on its own would also be the only
        * one drawn in a lighter line than the rest of the set.
        */}
      <g transform={`translate(12 12) scale(${ART}) translate(-12 -12)`}>
        {PATHS[kind](maskId)}
      </g>
    </svg>
    </span>
  );
}
