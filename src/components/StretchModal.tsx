import { useEffect, useState } from 'react';
import { CUES, FIGURES, FIGURE_FOR, VIEW_LABEL, VIEW_ORDER, mirrored, posesOf, sweeps } from '../lib/stretch';
import type { Pose, Joint, Track, View } from '../lib/stretch';
import { useBackToClose } from '../lib/useBackToClose';
import { CloseButton } from './CloseButton';
import { ImplementIcon } from './ImplementIcon';

/**
 * Where each view puts the body the limb hangs off.
 *
 * A figure can override headY, spineTop and hipY where it needs headroom, which
 * the overhead extension does: its hand finishes above the head, so the whole
 * body sits lower in the box.
 */
const SIDE = { headX: 118, headY: 42, headR: 11, spineTop: 53, hipY: 152, hipHalf: 14 };
const FRONT = { headX: 120, headY: 30, headR: 12, spineTop: 44, hipY: 120, hipHalf: 16 };

/** Scaffolding: drawn faint, because it is there to place the limb, not to be read. */
function Body({ view, f }: { view: View; f: Pose }) {
  const o = f.body;
  const dim = 'currentColor';

  if (view === 'front' || view === 'back') {
    const headY = o?.headY ?? FRONT.headY;
    const top = o?.spineTop ?? FRONT.spineTop;
    const hipY = o?.hipY ?? FRONT.hipY;
    return (
      <g opacity="0.5">
        <circle cx={FRONT.headX} cy={headY} r={FRONT.headR} fill="none" stroke={dim} strokeWidth="2.5" />
        {/*
          * 40 wide at the shoulders, x 100 to 140, tapering to 28 at the
          * waist, so it reads as a body rather than a box. Same shoulder width
          * as the top view, so the shoulders sit at the same x from every
          * angle. The arms pivot at the top corners, 5 below the top edge, so
          * they meet the body at the shoulder rather than the chest.
          */}
        <path
          d={`M108,${top} H132 Q140,${top} 140,${top + 9} L134,${hipY - 8} Q133,${hipY} 126,${hipY} H114 Q107,${hipY} 106,${hipY - 8} L100,${top + 9} Q100,${top} 108,${top} Z`}
          fill="none"
          stroke={dim}
          strokeWidth="2.5"
        />
        {view === 'back' && (
          /*
           * Two blades either side of the spine, which slide between the poses.
           * Drawn here rather than in the limb chain because they translate
           * instead of rotating, and because they are the only reason this
           * angle exists. 12 wide at x 124 and 104 and 24 tall, which keeps
           * them inside the taper all the way down, and 8 apart at rest, so a
           * retraction of 4 each brings them together at the spine without
           * overlapping.
           */
          <g
            className={f.blades ? 'blade-slide' : undefined}
            style={
              f.blades
                ? ({ ['--dx' as string]: `${f.blades.dx}px`, ['--dy' as string]: `${f.blades.dy}px` } as React.CSSProperties)
                : undefined
            }
          >
            <rect x="124" y={top + 14} width="12" height="24" rx="5" fill="none" stroke={dim} strokeWidth="2" />
            <rect x="104" y={top + 14} width="12" height="24" rx="5" fill="none" stroke={dim} strokeWidth="2" />
          </g>
        )}
      </g>
    );
  }

  if (view === 'side') {
    const headY = o?.headY ?? SIDE.headY;
    const spineTop = o?.spineTop ?? SIDE.spineTop;
    const hipY = o?.hipY ?? SIDE.hipY;
    return (
      <g opacity="0.5">
        <circle cx={SIDE.headX} cy={headY} r={SIDE.headR} fill="none" stroke={dim} strokeWidth="2.5" />
        <line x1={SIDE.headX} y1={spineTop} x2={SIDE.headX} y2={hipY} stroke={dim} strokeWidth="2.5" strokeLinecap="round" />
        <line x1={SIDE.headX - SIDE.hipHalf} y1={hipY} x2={SIDE.headX + SIDE.hipHalf} y2={hipY} stroke={dim} strokeWidth="2.5" strokeLinecap="round" />
      </g>
    );
  }

  if (view === 'top') {
    return (
      <g opacity="0.5">
        {/*
          * 40 wide, matching the front view's shoulders, so the arms pivot at
          * x 100 and 140 from every angle. Shoulders pivot at y 93, the
          * torso's mid depth, which is also the
          * middle of the only straight run of each side (y 90 to 96, inside
          * the 14 corner radius). Any further forward and the joint lands on
          * the corner curve and reads as the front of the body.
          */}
        <rect x="100" y="76" width="40" height="34" rx="14" fill="none" stroke={dim} strokeWidth="2.5" />
        {/*
          * Looking straight down, the head sits on the torso. Centered on the
          * same mid depth as the shoulder pivots, so head and shoulders read as
          * one line across the body. At r 11 it spans y 82 to 104, inside the
          * torso's 76 to 110, so no outline crosses it.
          */}
        <circle cx="120" cy="93" r="11" fill="none" stroke={dim} strokeWidth="2.5" opacity="0.75" />
      </g>
    );
  }

  // seated: back pad, seat, and the hip the leg turns about
  return (
    <g opacity="0.5">
      <line x1="40" y1="52" x2="40" y2="118" stroke={dim} strokeWidth="3" strokeLinecap="round" />
      <line x1="40" y1="116" x2="78" y2="116" stroke={dim} strokeWidth="3" strokeLinecap="round" />
      <circle cx="76" cy="112" r="4.8" fill={dim} opacity="0.8" />
    </g>
  );
}

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * The limb, drawn at the stretched pose and animated back toward the
 * contracted one.
 *
 * Each segment is its own group rotating about its own joint, nested so a
 * forearm inherits the upper arm's rotation. That keeps every segment exactly
 * its drawn length at every frame; animating the endpoints instead shortens a
 * segment as it sweeps, because the end travels the chord rather than the arc.
 * The rest pose is the stretched one, so the first frame is the position to
 * reach.
 */
function Limb({ chain, i, pts, sw }: { chain: Joint[]; i: number; pts: { x: number; y: number }[]; sw: number[] }) {
  const j = chain[i];
  const a = pts[i];
  const b = pts[i + 1];
  return (
    <g
      className="limb-seg"
      style={{ transformOrigin: `${a.x}px ${a.y}px`, ['--sweep' as string]: `${sw[i]}deg` }}
    >
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      {i + 1 < chain.length && <Limb chain={chain} i={i + 1} pts={pts} sw={sw} />}
      <circle cx={a.x} cy={a.y} r="4.4" fill="var(--accent)" />
      {j.hand && <circle cx={b.x} cy={b.y} r="4.8" fill="var(--accent)" />}
    </g>
  );
}

// Walked from the root rather than read off each joint, so a nested pivot can
// never disagree with the end of the segment it hangs from.
function pointsOf(chain: Joint[]): { x: number; y: number }[] {
  const pts = [{ x: chain[0].x, y: chain[0].y }];
  chain.forEach((j) => {
    const p = pts[pts.length - 1];
    pts.push({ x: p.x + j.len * Math.cos(rad(j.stretched)), y: p.y + j.len * Math.sin(rad(j.stretched)) });
  });
  return pts;
}

/**
 * A sampled track, animated point by point.
 *
 * SMIL rather than CSS because what moves here is coordinates, not a transform:
 * a foreshortening limb changes length on screen, which no rotation about a
 * pivot can draw. The samples already carry the hold and the easing, so linear
 * interpolation between them keeps the beat of the CSS keyframes. SMIL ignores
 * prefers-reduced-motion, so that is checked here and the first frame, the
 * stretch, is drawn still.
 */
function TrackLimbs({ track }: { track: Track }) {
  const still =
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const fr = track.frames;
  const vals = (li: number, pi: number, k: 'x' | 'y') => fr.map((f) => f[li][pi][k].toFixed(1)).join(';');
  const anim = (attr: string, v: string) =>
    still ? null : <animate attributeName={attr} values={v} dur="3.4s" repeatCount="indefinite" />;
  return (
    <>
      {fr[0].map((p0, li) => (
        <g key={li}>
          {p0.slice(0, -1).map((a, si) => (
            <line
              key={si}
              x1={a.x}
              y1={a.y}
              x2={p0[si + 1].x}
              y2={p0[si + 1].y}
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
            >
              {anim('x1', vals(li, si, 'x'))}
              {anim('y1', vals(li, si, 'y'))}
              {anim('x2', vals(li, si + 1, 'x'))}
              {anim('y2', vals(li, si + 1, 'y'))}
            </line>
          ))}
          {p0.map((pt, pi) => (
            <circle key={pi} cx={pt.x} cy={pt.y} r={pi === p0.length - 1 ? 4.8 : 4.4} fill="var(--accent)">
              {anim('cx', vals(li, pi, 'x'))}
              {anim('cy', vals(li, pi, 'y'))}
            </circle>
          ))}
        </g>
      ))}
    </>
  );
}

export function StretchFigure({ f }: { f: Pose }) {
  const chains = f.chain ? (f.mirror ? [f.chain, mirrored(f.chain)] : [f.chain]) : [];

  return (
    <svg className="stretch-svg" viewBox={`0 0 240 ${f.height}`} role="img" aria-hidden="true">
      <Body view={f.view} f={f} />
      {f.fixed && (
        <line
          x1={f.fixed.x1}
          y1={f.fixed.y1}
          x2={f.fixed.x2}
          y2={f.fixed.y2}
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.85"
        />
      )}
      {chains.map((c, k) => (
        <Limb key={k} chain={c} i={0} pts={pointsOf(c)} sw={sweeps(c)} />
      ))}
      {f.track && <TrackLimbs track={f.track} />}
      {f.marks?.map((m, k) => (
        <text key={k} className="stretch-mark" x={m.x} y={m.y} textAnchor={m.anchor ?? 'start'} fill="var(--accent)">
          {m.text}
        </text>
      ))}
    </svg>
  );
}

/**
 * The position an exercise has to reach, opened from its name.
 *
 * Every exercise in the routine has a cue. Most also have a figure; the two ab
 * movements do not, because the segment that moves there is the trunk itself
 * and there is no body left to draw behind it.
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
  const cue = key ? CUES[key] : null;
  const figure = key ? FIGURES[key] : undefined;
  // Buttons read in a fixed left-to-right order so the angles sit in the same
  // place for every exercise, but the angle that opens is the figure's primary
  // one, which is not always the leftmost button.
  const poses = figure
    ? posesOf(figure)
        .slice()
        .sort((a, b) => VIEW_ORDER.indexOf(a.view) - VIEW_ORDER.indexOf(b.view))
    : [];
  const [viewIdx, setViewIdx] = useState(() => Math.max(0, poses.indexOf(figure as Pose)));
  if (!cue) return null;
  const pose = poses[Math.min(viewIdx, poses.length - 1)];

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
        {pose && <StretchFigure f={pose} />}
        {poses.length > 0 && (
          <div className={poses.length > 1 ? 'metric-toggle view-toggle' : 'metric-toggle view-toggle one'}>
            {poses.map((p, i) => (
              <button
                key={p.view}
                className={i === viewIdx ? 'active' : ''}
                onClick={() => setViewIdx(i)}
              >
                {VIEW_LABEL[p.view]}
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
