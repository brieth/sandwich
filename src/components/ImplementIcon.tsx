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
  // straight bar under its yoke
  bar: (
    <>
      <path d="M3 18h18" />
      <path d="M8 18l4-7 4 7" />
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
  // carabiner, gate on the right
  clip: (
    <>
      <path d="M9 3h2a4 4 0 0 1 4 4v10a4 4 0 0 1-8 0V7a4 4 0 0 1 2-3.5" />
      <path d="M15 7v7" />
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
