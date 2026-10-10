/**
 * The X that dismisses a modal, and the one that abandons a session.
 *
 * The word is gone from the face but not from the button: `label` still names
 * what it does for a screen reader and for the tooltip, and the two uses say
 * different things, since one closes a view and the other throws work away.
 */
export function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="btn ghost icon-only" onClick={onClick} aria-label={label} title={label}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden="true"
      >
        <path d="M5 5l14 14M19 5L5 19" />
      </svg>
    </button>
  );
}
