import { implementFor, IMPLEMENT_LABELS, type Implement } from '../lib/implements';

/*
 * Drawn as strokes in currentColor so one set works at any size and in any
 * colour. Kept to two or three marks each: at 16px on a phone, anything finer
 * turns to mush.
 */
const PATHS: Record<Implement, JSX.Element> = {
  // sleeve with two plates a side
  barbell: (
    <>
      <path d="M2 12h20" />
      <path d="M6 8v8M9 9.5v5M15 9.5v5M18 8v8" />
    </>
  ),
  // wide bar under its yoke, ends angled down
  latbar: (
    <>
      <path d="M3 20l3.5-3h11l3.5 3" />
      <path d="M8.5 17l3.5-6 3.5 6" />
      <circle cx="12" cy="9" r="2" />
    </>
  ),
  // short straight bar under its yoke
  bar: (
    <>
      <path d="M5 18h14" />
      <path d="M8.5 18l3.5-7 3.5 7" />
      <circle cx="12" cy="8" r="2" />
    </>
  ),
  // two strands off a ring, knotted ends
  rope: (
    <>
      <circle cx="12" cy="5" r="2" />
      <path d="M11 7c-2 4-4 7-5 11M13 7c2 4 4 7 5 11" />
      <path d="M5 19h2M17 19h2" />
    </>
  ),
  // the D: straight grip, looped back
  handle: (
    <>
      <circle cx="12" cy="4" r="1.5" />
      <path d="M12 5.5V8" />
      <path d="M8 8v12M8 8h3a6 6 0 0 1 0 12H8" />
    </>
  ),
  // snap hook: pear body, narrow at the nose and wide at the foot, with the
  // gate running up the open side to a notch just short of the nose
  clip: (
    <>
      <path d="M15.1 8.3Q14.4 3 11 3 7 3 5.6 7.6L4.6 13.4Q3.6 21.8 10.8 21.8 17 21.8 16.6 15.4L16.3 12.2" />
    </>
  ),
  // weight stack
  machine: (
    <>
      <rect x="6" y="5" width="12" height="15" rx="1.5" />
      <path d="M6 10h12M6 14h12" />
    </>
  ),
};

/** The icon for one exercise, or nothing when it has no implement recorded. */
export function ImplementIcon({ exerciseId }: { exerciseId: string }) {
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
      {PATHS[kind]}
    </svg>
    </span>
  );
}
