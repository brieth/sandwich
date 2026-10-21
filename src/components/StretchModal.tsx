import { useEffect, useMemo, useState } from 'react';
import type { Prepared } from '../lib/figure3d/figure';
import { prepare } from '../lib/figure3d/figure';
import { CUES, FIGS, FIGURE_FOR } from '../lib/figures';
import { CYCLE, TEMPO } from '../lib/tempo';
import { useBackToClose } from '../lib/useBackToClose';
import { CloseButton } from './CloseButton';
import { FigureCanvas } from './FigureCanvas';
import { ImplementIcon } from './ImplementIcon';

/** Prepared once per figure: working out what moves and how big to draw it samples the whole rep. */
const prepared = new Map<string, Prepared>();
function preparedFor(key: string): Prepared | undefined {
  const def = FIGS[key];
  if (!def) return undefined;
  let p = prepared.get(key);
  if (!p) {
    p = prepare(def);
    prepared.set(key, p);
  }
  return p;
}

/**
 * The rep's tempo under the figure, in step with it.
 *
 * One row per phase, shown for that whole phase. The dial fills once over the
 * phase and the number on top counts its seconds, so the 2 s stretch reads as
 * one long fill ticking 1, 2. Words name what the muscle is doing rather
 * than which way the weight goes, because lowering the weight is arms up on a
 * pulldown and arms down on a curl. The order follows the figure from its
 * first frame: paused at the stretch, contracting, then the slow return.
 *
 * Start times come from TEMPO, as negative delays: a window that starts s
 * seconds in uses s - CYCLE, so at time zero it is already the right distance
 * through its cycle. Phase lengths pick a 1 s or 2 s window in the CSS.
 */
function TempoCount() {
  const phases = [
    { word: 'Hold', secs: TEMPO.hold },
    { word: 'Contract', secs: TEMPO.contract },
    { word: 'Stretch', secs: TEMPO.stretch },
  ].map((ph, i, all) => ({ ...ph, start: all.slice(0, i).reduce((t, q) => t + q.secs, 0) }));
  const delay = (t: number) => ({ animationDelay: `${t - CYCLE}s` });
  return (
    <div
      className="tempo"
      aria-label={`Tempo: ${TEMPO.stretch} seconds into the stretch, hold ${TEMPO.hold}, contract ${TEMPO.contract}`}
    >
      {phases.map(({ word, secs, start }) => (
        <div className={`tempo-step w${secs}`} key={word} style={delay(start)} aria-hidden="true">
          <span className="tempo-word">{word}</span>
          <span className="tempo-dial">
            <svg viewBox="0 0 28 28">
              <circle className="tempo-ring" cx="14" cy="14" r="12.5" />
              {/* Rotated so the fill starts at twelve o'clock; a circle's
                  stroke runs clockwise from three o'clock. */}
              <circle
                className={`tempo-fill w${secs}`}
                style={delay(start)}
                cx="14"
                cy="14"
                r="5.75"
                transform="rotate(-90 14 14)"
              />
            </svg>
            {Array.from({ length: secs }, (_, k) => (
              <span className="tempo-n" key={k} style={delay(start + k)}>
                {k + 1}
              </span>
            ))}
          </span>
        </div>
      ))}
      <div className="tempo-still">
        Stretch {TEMPO.stretch} s, hold {TEMPO.hold} s, contract {TEMPO.contract} s
      </div>
    </div>
  );
}

/**
 * The position an exercise has to reach, opened from its name: an animated
 * figure, the angles it can be seen from, the tempo, and the cue.
 */
export default function StretchModal({
  exerciseId,
  name,
  onClose,
}: {
  exerciseId: string;
  name: string;
  onClose: () => void;
}) {
  useBackToClose(true, onClose);
  const key = FIGURE_FOR[exerciseId];
  const cue = key ? CUES[key] : undefined;
  const prep = useMemo(() => (key ? preparedFor(key) : undefined), [key]);
  const views = prep?.def.views ?? [];
  // The modal opens on the first angle a figure lists.
  const [viewIdx, setViewIdx] = useState(0);
  if (!cue) return null;
  const view = Math.min(viewIdx, Math.max(0, views.length - 1));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="ex-title-row">
            <ImplementIcon exerciseId={exerciseId} />
            <span className="modal-title">{name}</span>
          </span>
          <CloseButton onClick={onClose} label="Close" />
        </div>
        {/* Everything under the title scrolls. As direct children of the
            modal's capped flex column, the drawing was the one item that could
            shrink, and long cues squeezed it: measured at 81px tall on the mid
            fly and 52 on the low fly, against 256 at full size. */}
        <div className="stretch-body">
          {/* Keyed by angle, so switching angles restarts the figure and the
              counter together and they stay on the same second. */}
          {prep && <FigureCanvas key={view} prep={prep} view={view} />}
          {prep && <TempoCount key={`t${view}`} />}
          {views.length > 0 && (
            <div className={views.length > 1 ? 'metric-toggle view-toggle' : 'metric-toggle view-toggle one'}>
              {views.map((v, i) => (
                <button key={i} className={i === view ? 'active' : ''} onClick={() => setViewIdx(i)}>
                  {v.label}
                </button>
              ))}
            </div>
          )}
          <p className="stretch-reach">{cue.reach}</p>
          {cue.points.map((p, i) => (
            <p key={i} className="muted small stretch-point">
              {p}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Opens the stretch modal for whichever exercise was tapped.
 *
 * One instance per view, so the name only has to say which exercise it is. The
 * name is a button wherever it renders as text; where it renders inside a
 * select, the icon beside it carries the tap instead.
 */
export function useStretchModal() {
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);
  // A name can be tapped in a list that re-renders under it; closing on id
  // change avoids a modal left open against an exercise that moved.
  useEffect(() => {
    if (open && !FIGURE_FOR[open.id]) setOpen(null);
  }, [open]);
  return {
    show: (id: string, name: string) => {
      if (FIGURE_FOR[id]) setOpen({ id, name });
    },
    has: (id: string | undefined) => !!id && !!FIGURE_FOR[id],
    node: open ? (
      <StretchModal exerciseId={open.id} name={open.name} onClose={() => setOpen(null)} />
    ) : null,
  };
}
