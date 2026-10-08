import { tagsFor } from '../lib/tags';

/**
 * The chips for one exercise, or nothing when it has none. Rendered as bare
 * siblings so the caller owns the row they sit in.
 */
export function ExerciseTags({ exerciseId }: { exerciseId: string }) {
  const tags = tagsFor(exerciseId);
  if (tags.length === 0) return null;
  return (
    <>
      {tags.map((t) => (
        <span key={t.id} className="ex-tag" title={t.title} aria-label={t.title}>
          {t.label}
        </span>
      ))}
    </>
  );
}
