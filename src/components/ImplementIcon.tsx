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
      <path d="M6 7v10M9.5 9v6M14.5 9v6M18 7v10" />
    </>
  ),
  // wide bar hanging from its yoke
  bar: (
    <>
      <path d="M2 18h20" />
      <path d="M8 18l4-9 4 9" />
    </>
  ),
  // one stem splitting into two strands
  rope: (
    <>
      <path d="M12 3v5" />
      <path d="M12 8c-3 4-5 7-6 13M12 8c3 4 5 7 6 13" />
    </>
  ),
  // the D: straight grip, looped back
  handle: (
    <>
      <path d="M8 4v16" />
      <path d="M8 4h3a8 8 0 0 1 0 16H8" />
    </>
  ),
  // carabiner with its gate
  clip: (
    <>
      <ellipse cx="12" cy="12" rx="5.5" ry="9" />
      <path d="M16 6.5l-3.5 4.5" />
    </>
  ),
  // weight stack
  machine: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M5 9.5h14M5 14.5h14" />
    </>
  ),
};

/** The icon for one exercise, or nothing when it has no implement recorded. */
export function ImplementIcon({ exerciseId }: { exerciseId: string }) {
  const kind = implementFor(exerciseId);
  if (!kind) return null;
  const label = IMPLEMENT_LABELS[kind];
  return (
    <svg
      className="ex-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {PATHS[kind]}
    </svg>
  );
}
