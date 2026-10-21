/**
 * The position each exercise has to reach for the muscle to be at full length,
 * as a drawable figure plus the cue for getting there.
 *
 * A muscle grows more when it is trained long. Maeo and colleagues measured the
 * seated leg curl, which holds the hamstring longer because the hip is flexed,
 * at about 1.8 times the growth of the lying version, and overhead triceps
 * extensions at 1.5 to 2 times a pushdown. Most of the range lost on upper body
 * work is a shoulder blade held still so the muscle did not have to lengthen.
 *
 * Figures are shared by movement, not by exercise, because the three pulldowns
 * or the three crossover flys reach the same position. FIGURE_FOR maps each
 * exercise id onto one.
 */

/** Body drawn behind the limb, which also fixes what the angles mean. */
export type View = 'front' | 'back' | 'side' | 'top' | 'bottom' | 'seated';

/** Button order, so the angles read left to right the same way every time. */
export const VIEW_ORDER: View[] = ['front', 'back', 'side', 'top', 'bottom', 'seated'];

export const VIEW_LABEL: Record<View, string> = {
  front: 'Front',
  back: 'Back',
  side: 'Side',
  top: 'Top',
  bottom: 'Bottom',
  seated: 'Side',
};

/**
 * One moving joint: where it pivots, how long the segment is, and the angle at
 * each end of the movement.
 *
 * Angles are degrees, 0 pointing right and growing clockwise, which is the
 * direction y grows in an SVG. `stretched` is where the figure rests.
 */
export interface Joint {
  /** Root only. A nested joint pivots at the end of the segment before it, so
   *  the renderer walks the chain and these values are ignored past the root. */
  x: number;
  y: number;
  len: number;
  stretched: number;
  contracted: number;
  /** Drawn at the far end of the segment. Off for a segment that carries another. */
  hand?: boolean;
}

export interface Pt {
  x: number;
  y: number;
}

/**
 * A movement sampled frame by frame: frame, then limb, then the points along it
 * from shoulder to hand.
 *
 * For a movement whose projection changes length, which a chain of rotating
 * fixed-length segments cannot draw. A fly seen from the front is the case that
 * needs it: as the hands come together the arms point at the camera and get
 * shorter on screen.
 */
export interface Track {
  frames: Pt[][][];
  /** Cables, frame then cable, each running from its pulley to a hand. */
  cables?: Pt[][][];
  /**
   * Limbs, by index, that sit farther from the camera than the body and are
   * drawn before it, so the torso and head hide them where they cross. From
   * the side, the far arm of a fly passes behind the head; drawn on top, it
   * would look like it went through it.
   */
  behind?: number[];
  /**
   * Point indices on the limbs drawn behind the body that sit on its surface and
   * stay visible anyway. From behind, a fly's shoulders are on the torso's edge;
   * drawn with the hidden arms, the torso cut each one in half. Indices rather
   * than fixed points, because the shoulders move with the blades.
   */
  onTop?: number[];
  /** Shoulder blades that move, frame then blade, each an arc of points. */
  blades?: Pt[][][];
}

/**
 * A whole static body, already projected, for a figure built from a 3D model.
 * Replaces the view's 2D template, which has no lean, legs or equipment.
 */
export interface Scaffold {
  head: { x: number; y: number; r: number };
  /** Outline of the torso as drawn from this angle. */
  torso: string;
  /** Legs and the floor, which hold still through the movement. */
  lines: Pt[][];
  /** Knees and feet, drawn small so the stance reads. */
  dots: Pt[];
  pulleys: Pt[];
}

export interface Pose {
  view: View;
  /** Root first. A second joint hangs off the end of the first. */
  chain?: Joint[];
  /** Used instead of chain where the limb foreshortens. Includes every limb. */
  track?: Track;
  /** Used instead of the view's body template, for a figure modeled in 3D. */
  scaffold?: Scaffold;
  /** A body segment that holds still, e.g. an upper arm on a curl. Drawn in the body color. */
  fixed?: { x1: number; y1: number; x2: number; y2: number };
  /** Short words placed in the drawing, at most two. */
  marks?: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }[];
  /** Overrides the view's default body placement where a figure needs headroom. */
  body?: { headY: number; spineTop: number; hipY: number };
  /**
   * How far the shoulder blades travel between the two poses, in the back view.
   *
   * The blade is what the pulldown and row cues are actually about, and no
   * other angle shows it: from the front or the side it is behind the ribcage.
   */
  blades?: { dx: number; dy: number };
  /**
   * Draw the other limb as well, mirrored about the body's center line.
   *
   * Set only where both limbs move together and the view is front, back or top.
   * In a side view the far limb would sit exactly behind the near one, and the
   * single-arm exercises draw one arm because that is what they are.
   */
  mirror?: boolean;
  height: number;
}

export interface Figure extends Pose {
  /** Other angles on the same movement, each a complete pose of its own. */
  alts?: Pose[];
}

/** Every angle a figure can be read from, primary first. */
export function posesOf(f: Figure): Pose[] {
  return [f, ...(f.alts ?? [])];
}

export interface Cue {
  /** The position to reach, in one line. */
  reach: string;
  /** Why that is the long position, and what shortens it. */
  points: string[];
}

export type FigureKey =
  | 'pulldown'
  | 'row'
  | 'flyHigh'
  | 'flyMid'
  | 'flyLow'
  | 'bench'
  | 'overheadExt'
  | 'pushdown'
  | 'curl'
  | 'behindCurl'
  | 'lateralRaise'
  | 'rearDelt'
  | 'facePull'
  | 'uprightRow'
  | 'legPress'
  | 'legCurl'
  | 'legExtension'
  | 'hipAbduction'
  | 'hipAdduction'
  | 'crunch'
  | 'woodchopper';

/*
 * Geometry note: every angle below was solved so the drawn endpoint lands where
 * it should on the body behind it, and so the stretched pose clears the head.
 * The renderer animates by rotating about each pivot, so segment lengths hold
 * exactly at every frame rather than drifting the way interpolated endpoints do.
 */
/*
 * The rep's tempo, shared by every figure: a 4 second cycle starting at the
 * stretch. Hold there 1 second, contract over 1, then return into the stretch
 * over 2. Growth is about the same anywhere from half a second to 8 seconds per
 * rep when sets go near failure, so the slow return is for control: reaching
 * full length every rep and not bouncing out of it. 2 seconds does that; 3 cost
 * reps for nothing. The hold is there to stop the bounce. Tracks sample this
 * curve; the CSS limb-sweep and blade-slide keyframes and the counter under the
 * figure run the same one.
 */
export const TEMPO = { hold: 1, contract: 1, stretch: 2 } as const;
export const CYCLE = TEMPO.hold + TEMPO.contract + TEMPO.stretch;
const EASE = (x: number): number => {
  // cubic-bezier(0.42, 0, 0.58, 1), which is what CSS ease-in-out means.
  let s = x;
  for (let i = 0; i < 8; i++) {
    const bx = 3 * (1 - s) * (1 - s) * s * 0.42 + 3 * (1 - s) * s * s * 0.58 + s * s * s;
    const dx = 3 * (1 - s) * (1 - s) * 0.42 + 6 * (1 - s) * s * (0.58 - 0.42) + 3 * s * s * (1 - 0.58);
    if (Math.abs(dx) < 1e-6) break;
    s -= (bx - x) / dx;
  }
  return 3 * s * s - 2 * s * s * s;
};

/** Fraction of the way to the contracted end at a point in the cycle. */
export function sweepAt(phase: number): number {
  const a = TEMPO.hold / CYCLE;
  const b = (TEMPO.hold + TEMPO.contract) / CYCLE;
  if (phase < a) return 0;
  if (phase < b) return EASE((phase - a) / (b - a));
  return 1 - EASE((phase - b) / (1 - b));
}

type V3 = [number, number, number];
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Spherical interpolation; t past 1 carries on around the same great circle. */
function slerp(a: V3, b: V3, t: number): V3 {
  const om = Math.acos(Math.max(-1, Math.min(1, dot3(a, b))));
  const so = Math.sin(om);
  const ka = Math.sin((1 - t) * om) / so;
  const kb = Math.sin(t * om) / so;
  return [ka * a[0] + kb * b[0], ka * a[1] + kb * b[1], ka * a[2] + kb * b[2]];
}

/**
 * Arm direction in 3D from a top-view heading and an elevation.
 *
 * x is right, y is down, z is toward the viewer of a front view. The heading is
 * the angle the top view draws, where down the page is backward, so it maps to
 * -z. Elevation is degrees above horizontal.
 */
function dir(heading: number, elevation: number): V3 {
  const h = (heading * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  return [Math.cos(h) * Math.cos(e), -Math.sin(e), -Math.sin(h) * Math.cos(e)];
}

const FRAMES = 61;

/*
 * The whole body for a fly, in a body frame: origin at the center of the hips,
 * x to the right, y down, z forward. Proportions follow the usual figure rule of
 * about three head heights from chin to crotch, and are shorter in the torso than
 * the 2D figures, whose 76 tall torso read as too long once legs were wanted.
 */
const HIP_HALF = 10;
const TORSO = { height: 58, shoulderHalf: 20, waistHalf: 14, chestDepth: 15, waistDepth: 13 };
/** Shoulder pivot: at the torso's top corner, 5 below its top edge. */
const SHOULDER: V3 = [20, -53, 0];
const HEAD: { c: V3; r: number } = { c: [0, -76, 3], r: 11 };
const THIGH = 40;
const SHIN = 38;
/** Hip to floor. Shorter than the 78 of thigh and shin, so the knees soften. */
const FLOOR = 74;
/** Staggered stance: left foot forward, right foot back. */
const STAGGER = 20;
/*
 * Equipment, at the figure's scale of roughly a centimeter per unit, which the
 * 40 unit shoulder width sets. A real crossover station puts each pulley about
 * 130 out from center, which does not fit the 240 box, so they sit at 100, the
 * most the front view allows.
 *
 * The person stands about two steps, an arm's length, in front of the pulley
 * line. At one step the cable at the stretch ran nearly along the arm, so it
 * loaded the shoulder joint and barely turned the arm. Measured as the share of
 * the cable's full leverage on the arm, stretch then finish:
 *
 *   40 in front:  high 43 / 37, mid 20 / 45, low 54 / 71
 *   100 in front: high 79 / 34, mid 76 / 27, low 59 / 55
 *
 * At 100 all three load the stretch at least as hard as the finish. A wider real
 * station lines the cable up with the arm even more, so standing forward matters
 * more there, not less.
 */
const PULLEY_BEHIND = 100;
const PULLEY_OUT = 100;

const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

/**
 * Tip a body-frame vector forward about the hips. Up, (0, -1, 0), becomes
 * (0, -cos t, sin t), so everything above the hips moves forward as it rises.
 */
function leanBy(v: V3, deg: number): V3 {
  const t = (deg * Math.PI) / 180;
  return [v[0], v[1] * Math.cos(t) + v[2] * Math.sin(t), -v[1] * Math.sin(t) + v[2] * Math.cos(t)];
}

/**
 * Inner border of the right shoulder blade, as a quadratic arc on the back
 * surface: top, control, bottom. The border bows toward the spine, which is the
 * shape it has. Set retracted, so it sits 4 to 9 from the spine; mirrored for
 * the left blade.
 */
const BLADE: [V3, V3, V3] = [
  [9, -50, -15],
  [4, -41, -15],
  [9, -31, -14],
];

/**
 * How far the right blade, and the shoulder joint that sits on it, shifts from
 * its set position through the rep, at about a centimeter per unit. At the
 * stretch, opening the arms draws it 2 further toward the spine and 3 back. At
 * the finish, reaching across lets it drift 3 out and 2 forward, which holding
 * the blades back keeps small. The left side mirrors in x.
 */
const SCAP_STRETCH: V3 = [-2, 0, -3];
const SCAP_FINISH: V3 = [3, 0, 2];
const scapAt = (t: number, side: number): V3 => [
  side * (SCAP_STRETCH[0] + t * (SCAP_FINISH[0] - SCAP_STRETCH[0])),
  0,
  SCAP_STRETCH[2] + t * (SCAP_FINISH[2] - SCAP_STRETCH[2]),
];

/**
 * Upper-back extension, in degrees, between the torso's lower and upper halves.
 *
 * The lean comes from the hips, and the upper back stays extended rather than
 * rounding, which is what chest up means. A single rigid torso tipped forward
 * pointed the chest at the floor, which is the slouch the cue prevents. Split at
 * mid-back, the upper half tips back this much against the lower half, never
 * past upright, so the chest faces forward while the hips stay hinged.
 */
const THORACIC_EXT = 12;

/** Knee for a leg from hip to foot, bent forward, by the law of cosines. */
function knee(hip: V3, foot: V3): V3 {
  const dy = foot[1] - hip[1];
  const dz = foot[2] - hip[2];
  const d = Math.hypot(dy, dz);
  const a = Math.acos(Math.max(-1, Math.min(1, (THIGH * THIGH + d * d - SHIN * SHIN) / (2 * THIGH * d))));
  const phi = Math.atan2(dz, dy);
  return [hip[0], hip[1] + THIGH * Math.cos(phi + a), hip[2] + THIGH * Math.sin(phi + a)];
}

/** Convex hull by monotone chain, counterclockwise. */
function hull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Polygon with each corner cut back along its edges and rounded through it. */
function rounded(poly: Pt[], r: number): string {
  const n = poly.length;
  const cut = (a: Pt, b: Pt) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const k = Math.min(r, len * 0.4) / len;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  };
  const f = (q: Pt) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const v = poly[i];
    const a = cut(v, poly[(i - 1 + n) % n]);
    const b = cut(v, poly[(i + 1) % n]);
    d += `${i === 0 ? 'M' : 'L'}${f(a)} Q${f(v)} ${f(b)} `;
  }
  return d + 'Z';
}

type FlyView = 'front' | 'back' | 'side' | 'top';

/**
 * Where each view puts a body-frame point on screen.
 *
 * Front looks at the chest. Side looks at the left side, so forward runs left,
 * matching every other side view. Top looks straight down with forward up the
 * page. Hips sit at a fixed screen point per view, chosen so the head, the
 * feet and a high pulley all fit.
 */
const PROJECT: Record<FlyView, (v: V3) => Pt> = {
  front: (v) => ({ x: 120 + v[0], y: 120 + v[1] }),
  // From behind, the person's right is on the viewer's right.
  back: (v) => ({ x: 120 + v[0], y: 120 + v[1] }),
  // Hips at 115 so a pulley a meter behind still fits at x 215.
  side: (v) => ({ x: 115 - v[2], y: 120 + v[1] }),
  top: (v) => ({ x: 120 + v[0], y: 92 - v[2] }),
};
const FLY_HEIGHT: Record<FlyView, number> = { front: 205, back: 205, side: 205, top: 205 };

/**
 * A crossover fly as one whole body in 3D, projected into the front, side and
 * top views.
 *
 * The arms sweep along a great circle between a start and a finish direction,
 * tilted by the pulley height, with the forearm 20 degrees further along the same
 * arc to hold the elbow bend. Headings are the ones the top view always used:
 * upper arm from 34 at the stretch to -92.5 with the hands together in front.
 * The arm path is defined against the upper torso. The lean is a hinge at the
 * hips; the upper back extends against it by THORACIC_EXT, so the chest and the
 * arm path tip forward less than the hips do. Legs stay upright
 * in a staggered stance. Pulleys are fixed in the room, so the cable from each
 * to its hand shows the angle the lean makes with it.
 */
function flyFigure(startElev: number, endElev: number, lean: number, pulleyY: number): Figure {
  const d0 = dir(34, startElev);
  const d1 = dir(-92.5, endElev);
  const total = (Math.acos(dot3(d0, d1)) * 180) / Math.PI;
  const lead = 20 / total;

  // Two-part torso: below mid-back tips with the hips by the full lean, above
  // it tips by the lean less the upper back's extension. Everything that rides
  // on the upper back, shoulders, blades, head and the arm path, uses the upper
  // part, so the chest comes up with it.
  const midY = -TORSO.height / 2;
  const upperLean = Math.max(0, lean - THORACIC_EXT);
  const mid = leanBy([0, midY, 0], lean);
  const place = (v: V3): V3 =>
    v[1] >= midY ? leanBy(v, lean) : add3(mid, leanBy([v[0], v[1] - midY, v[2]], upperLean));
  const turn = (v: V3): V3 => leanBy(v, upperLean);

  // Static body, in the room. The mid-back section goes in twice, once with
  // each half, so the outline covers the bend.
  const midW = (TORSO.waistHalf + TORSO.shoulderHalf) / 2;
  const midD = (TORSO.waistDepth + TORSO.chestDepth) / 2;
  const torsoCorners: V3[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      torsoCorners.push(leanBy([sx * TORSO.waistHalf, 0, sz * TORSO.waistDepth], lean));
      torsoCorners.push(leanBy([sx * midW, midY, sz * midD], lean));
      torsoCorners.push(add3(mid, leanBy([sx * midW, 0, sz * midD], upperLean)));
      torsoCorners.push(place([sx * TORSO.shoulderHalf, -TORSO.height, sz * TORSO.chestDepth]));
    }
  const head = place(HEAD.c);
  const legs = [
    { hip: [-HIP_HALF, 0, 0] as V3, foot: [-HIP_HALF, FLOOR, STAGGER] as V3 },
    { hip: [HIP_HALF, 0, 0] as V3, foot: [HIP_HALF, FLOOR, -STAGGER] as V3 },
  ].map((l) => ({ ...l, knee: knee(l.hip, l.foot) }));
  const pulleys: V3[] = [
    [PULLEY_OUT, pulleyY, -PULLEY_BEHIND],
    [-PULLEY_OUT, pulleyY, -PULLEY_BEHIND],
  ];

  // Arms, right then left, the left mirrored across x in the body frame.
  const armsAt = (t: number) => {
    const u = slerp(d0, d1, t);
    const f = slerp(d0, d1, t + lead);
    return [1, -1].map((side) => {
      const m = (v: V3): V3 => [side * v[0], v[1], v[2]];
      const sh = place(add3(m(SHOULDER), scapAt(t, side)));
      const el = add3(sh, mul3(turn(m(u)), 34));
      const ha = add3(el, mul3(turn(m(f)), 32));
      return [sh, el, ha];
    });
  };

  const pose = (view: FlyView): Pose => {
    const P = PROJECT[view];
    const frames: Pt[][][] = [];
    const cables: Pt[][][] = [];
    const blades: Pt[][][] = [];
    for (let i = 0; i < FRAMES; i++) {
      const t = sweepAt(i / (FRAMES - 1));
      const arms = armsAt(t);
      frames.push(arms.map((a) => a.map(P)));
      cables.push(arms.map((a, k) => [P(pulleys[k]), P(a[2])]));
      // Blades only show from behind. They move a few units with the
      // shoulders, so they are drawn in the moving color.
      if (view === 'back')
        blades.push(
          [1, -1].map((side) => {
            const q = BLADE.map((b) => add3([side * b[0], b[1], b[2]], scapAt(t, side)));
            const arc: Pt[] = [];
            for (let k = 0; k <= 8; k++) {
              const u = k / 8;
              const v = [0, 1, 2].map((j) => (1 - u) * (1 - u) * q[0][j] + 2 * (1 - u) * u * q[1][j] + u * u * q[2][j]) as V3;
              arc.push(P(place(v)));
            }
            return arc;
          }),
        );
    }
    const lines: Pt[][] = [];
    const dots: Pt[] = [];
    // From above the torso hides the legs, so the top view draws none.
    if (view !== 'top') {
      for (const l of legs) {
        lines.push([P(l.hip), P(l.knee), P(l.foot)]);
        dots.push(P(l.knee), P(l.foot));
      }
      const fy = P([0, FLOOR, 0]).y + 2;
      lines.push([{ x: 40, y: fy }, { x: 200, y: fy }]);
    }
    const hp = P(head);
    return {
      view,
      height: FLY_HEIGHT[view],
      track: {
        frames,
        cables,
        behind: view === 'side' ? [0] : view === 'back' ? [0, 1] : [],
        onTop: view === 'back' ? [0] : undefined,
        blades: view === 'back' ? blades : undefined,
      },
      scaffold: {
        head: { x: hp.x, y: hp.y, r: HEAD.r },
        torso: rounded(hull(torsoCorners.map(P)), 7),
        lines,
        dots,
        pulleys: pulleys.map(P),
      },
    };
  };

  return { ...pose('top'), alts: [pose('front'), pose('back'), pose('side')] };
}

/**
 * Every limb's points at evenly spaced moments through the cycle.
 *
 * One function for both kinds of pose, so the geometry checks walk exactly what
 * the renderer draws. A chain's world angles are linear in the sweep fraction,
 * because the nested sweeps telescope.
 */
export function limbFrames(pose: Pose, n = FRAMES): Pt[][][] {
  if (pose.track) return pose.track.frames;
  const chains = pose.chain ? (pose.mirror ? [pose.chain, mirrored(pose.chain)] : [pose.chain]) : [];
  const out: Pt[][][] = [];
  for (let i = 0; i < n; i++) {
    const t = sweepAt(i / (n - 1));
    out.push(
      chains.map((c) => {
        const pts: Pt[] = [{ x: c[0].x, y: c[0].y }];
        for (const j of c) {
          const a = ((j.stretched + t * (j.contracted - j.stretched)) * Math.PI) / 180;
          const q = pts[pts.length - 1];
          pts.push({ x: q.x + j.len * Math.cos(a), y: q.y + j.len * Math.sin(a) });
        }
        return pts;
      }),
    );
  }
  return out;
}

export const FIGURES: Partial<Record<FigureKey, Figure>> = {
  // Lat pulldown. The lat crosses the shoulder, so its length comes from the
  // shoulder blade rising, which the arm angle alone cannot show.
  pulldown: {
    view: 'front',
    height: 180,
    body: { headY: 76, spineTop: 90, hipY: 166 },
    chain: [
      { x: 140, y: 95, len: 34, stretched: -74, contracted: 45 },
      { x: 149.4, y: 62.3, len: 32, stretched: -74, contracted: 198, hand: true },
    ],
    marks: [{ x: 14, y: 176, text: 'blade rises' }],
    mirror: true,
    alts: [
      {
        view: 'back',
        height: 180,
        body: { headY: 76, spineTop: 90, hipY: 166 },
        chain: [
          { x: 140, y: 95, len: 34, stretched: -74, contracted: 45 },
          { x: 149.4, y: 62.3, len: 32, stretched: -74, contracted: 198, hand: true },
        ],
        blades: { dx: 0, dy: 9 },
        marks: [{ x: 14, y: 176, text: 'blades ride up' }],
        mirror: true,
      },
    ],
  },

  // Cable row. Same joint as the pulldown at the other end of the movement.
  row: {
    view: 'top',
    height: 158,
    chain: [
      { x: 140, y: 93, len: 30, stretched: -90, contracted: 78 },
      { x: 140, y: 63, len: 28, stretched: -90, contracted: -86, hand: true },
    ],
    alts: [
      {
        view: 'back',
        height: 172,
        // The forearm points mostly away from the camera here, so it is drawn
        // short. The blades are the whole reason for this angle.
        chain: [
          { x: 140, y: 49, len: 30, stretched: -20, contracted: 35 },
          { x: 168.2, y: 38.7, len: 10, stretched: -20, contracted: 35, hand: true },
        ],
        blades: { dx: -4, dy: 0 },
        marks: [{ x: 14, y: 150, text: 'blades spread at the front' }],
      },
    ],
  },

  // Crossover flys. The top view shows the stretch, which is the same for all
  // three: hands behind the line of the torso. The front view shows the plane
  // the arm sweeps in, which the pulley height sets, and the side view shows
  // the lean and the angle it makes with the cable. Leans are the usual
  // coaching ranges: more for a high pulley, close to upright for a low one.
  // Pulley heights are body-frame y: above the head, shoulder height, and just
  // off the floor.
  flyHigh: flyFigure(30, -35, 20, -100),
  flyMid: flyFigure(0, 0, 12, -53),
  flyLow: flyFigure(-30, -2, 5, 64),

  // Overhead extension. The long head crosses the shoulder, so it only reaches
  // length with the upper arm up. The upper arm is drawn fixed because holding
  // it there is the whole cue.
  overheadExt: {
    view: 'side',
    height: 180,
    body: { headY: 70, spineTop: 81, hipY: 162 },
    fixed: { x1: 128, y1: 90, x2: 134, y2: 48 },
    chain: [{ x: 134, y: 48, len: 34.4, stretched: 35.5, contracted: -81.9, hand: true }],
    marks: [{ x: 14, y: 36, text: 'upper arm stays up' }],
    alts: [
      {
        view: 'back',
        height: 180,
        body: { headY: 70, spineTop: 81, hipY: 162 },
        chain: [
          // Forearm ends at 280 rather than -80, the same direction, so it
          // sweeps +155 up over the top; -80 sent it -220 outward and down
          // around the elbow. From behind, the folded forearm points partly
          // toward the viewer and projects short, so it is drawn 18 long. At 28
          // the correct path crossed the head, 8.3 from its center.
          { x: 140, y: 86, len: 42, stretched: -80, contracted: -80 },
          { x: 147.3, y: 44.6, len: 18, stretched: 125, contracted: 280, hand: true },
        ],
        marks: [{ x: 14, y: 176, text: 'elbows stay in' }],
        mirror: true,
      },
    ],
  },

  // Pushdown. Shoulder is down, so the long head is short whatever you do and
  // the range worth having is at the top.
  pushdown: {
    view: 'side',
    height: 180,
    fixed: { x1: 128, y1: 62, x2: 128, y2: 106 },
    // Ends at -270 rather than 90, the same direction, so the forearm sweeps
    // -140 forward and down in front. 90 made it sweep +220, up and backward
    // behind the body and down, which no check caught because that path never
    // touches the head or a label.
    chain: [{ x: 128, y: 106, len: 44, stretched: -130, contracted: -270, hand: true }],
    marks: [{ x: 232, y: 172, text: 'forearm all the way up', anchor: 'end' }],
  },

  curl: {
    view: 'side',
    height: 180,
    fixed: { x1: 128, y1: 62, x2: 128, y2: 106 },
    chain: [{ x: 128, y: 106, len: 44, stretched: 90, contracted: 230, hand: true }],
    marks: [{ x: 232, y: 172, text: 'finish straight', anchor: 'end' }],
  },

  // Behind the back curl. The elbow sits behind the torso, which lengthens the
  // biceps long head at the shoulder as well as at the elbow.
  behindCurl: {
    view: 'side',
    height: 180,
    fixed: { x1: 128, y1: 62, x2: 138, y2: 106 },
    chain: [{ x: 138, y: 106, len: 44, stretched: 94, contracted: 232, hand: true }],
    marks: [{ x: 232, y: 172, text: 'elbow stays behind you', anchor: 'end' }],
  },

  // Behind the back lateral raise. The cable comes from the far side, so the
  // bottom of the rep has the arm across the body where a dumbbell would be slack.
  lateralRaise: {
    view: 'front',
    height: 172,
    chain: [
      { x: 140, y: 49, len: 32, stretched: 108, contracted: 0 },
      { x: 130.1, y: 79.4, len: 30, stretched: 108, contracted: 0, hand: true },
    ],
    marks: [{ x: 18, y: 150, text: 'past the midline' }],
    alts: [
      {
        view: 'top',
        // 165 rather than 158: partway through, the arm points straight back
        // and the hand reaches y 153, past the old box's 152 margin.
        height: 165,
        chain: [
          // Behind the back: the arm crosses behind the torso at the bottom.
          // From a shoulder 20 from the head center, the upper arm passes
          // 20 sin(180 - a) from it, so 135 keeps it 14.1 clear against a
          // limit of 12.5, the radius of 11 plus half the stroke.
          { x: 140, y: 93, len: 31, stretched: 135, contracted: 0 },
          { x: 118.1, y: 114.9, len: 29, stretched: 135, contracted: 0, hand: true },
        ],
      },
    ],
  },

  rearDelt: {
    view: 'top',
    height: 158,
    chain: [
      // Across the front of the body, so forward of the shoulder line. 220
      // keeps the upper arm 15.4 from the head center. Ends at 375 rather than
      // 15, the same direction, so the sweep runs +155 forward through
      // straight ahead; 15 made it run -205 backward around the shoulder and
      // through the head.
      { x: 140, y: 93, len: 31, stretched: 220, contracted: 375 },
      { x: 116.3, y: 73.1, len: 29, stretched: 220, contracted: 375, hand: true },
    ],
    alts: [
      {
        view: 'back',
        height: 172,
        chain: [
          { x: 140, y: 49, len: 29, stretched: 170, contracted: 0 },
          { x: 111.4, y: 54, len: 27, stretched: 170, contracted: 0, hand: true },
        ],
        blades: { dx: -4, dy: 0 },
        marks: [{ x: 14, y: 150, text: 'blades squeeze at the end' }],
      },
    ],
  },

  facePull: {
    view: 'top',
    mirror: true,
    height: 158,
    chain: [
      { x: 140, y: 93, len: 30, stretched: -90, contracted: -10 },
      { x: 140, y: 63, len: 28, stretched: -90, contracted: 150, hand: true },
    ],
    alts: [
      {
        view: 'back',
        height: 172,
        chain: [
          { x: 140, y: 49, len: 30, stretched: -25, contracted: -55 },
          { x: 167.2, y: 36.3, len: 16, stretched: -25, contracted: -95, hand: true },
        ],
        blades: { dx: -4, dy: 0 },
        marks: [{ x: 14, y: 150, text: 'elbows finish high' }],
        mirror: true,
      },
    ],
  },

  uprightRow: {
    view: 'front',
    height: 172,
    chain: [
      // 84 rather than 90: from a shoulder on the torso's edge, hanging
      // straight down laid the arm along the torso's side. At 84 the hand
      // hangs 7 outside it.
      { x: 140, y: 49, len: 34, stretched: 84, contracted: 10 },
      { x: 143.6, y: 82.8, len: 32, stretched: 84, contracted: 160, hand: true },
    ],
    marks: [{ x: 18, y: 150, text: 'arms fully down' }],
    mirror: true,
    alts: [
      {
        view: 'side',
        height: 180,
        chain: [
          { x: 128, y: 62, len: 34, stretched: 90, contracted: -10 },
          { x: 128, y: 96, len: 32, stretched: 90, contracted: 170, hand: true },
        ],
        marks: [{ x: 14, y: 36, text: 'elbow leads' }],
      },
    ],
  },

  legPress: {
    view: 'seated',
    height: 150,
    chain: [
      { x: 76, y: 112, len: 70, stretched: -49.6, contracted: -12 },
      { x: 121.3, y: 58.7, len: 66, stretched: 14, contracted: -12, hand: true },
    ],
    marks: [{ x: 30, y: 140, text: 'stop where the pelvis tucks' }],
  },

  // Seated over lying: the hip is flexed, which holds the hamstring longer.
  legCurl: {
    view: 'seated',
    height: 190,
    // Thigh fixed on the pad, shin turning at the knee.
    fixed: { x1: 76, y1: 112, x2: 122, y2: 112 },
    chain: [{ x: 122, y: 112, len: 44, stretched: -4, contracted: 110, hand: true }],
    marks: [{ x: 14, y: 24, text: 'knee fully straight at the top' }],
  },

  // Rectus femoris crosses the hip and the knee, so reclining the seat puts the
  // hip in more extension and lengthens it.
  legExtension: {
    view: 'seated',
    height: 190,
    // Thigh fixed on the pad, shin turning at the knee.
    fixed: { x1: 76, y1: 112, x2: 122, y2: 112 },
    chain: [{ x: 122, y: 112, len: 44, stretched: 100, contracted: -4, hand: true }],
    marks: [{ x: 14, y: 24, text: 'recline the seat' }],
  },

  hipAbduction: {
    view: 'front',
    height: 200,
    chain: [
      { x: 128, y: 120, len: 27, stretched: 80, contracted: 42 },
      { x: 132.7, y: 146.6, len: 25, stretched: 80, contracted: 42, hand: true },
    ],
    marks: [{ x: 14, y: 194, text: 'let the knees come together' }],
    mirror: true,
  },

  hipAdduction: {
    view: 'front',
    height: 200,
    chain: [
      { x: 128, y: 120, len: 27, stretched: 44, contracted: 86 },
      { x: 147.4, y: 138.8, len: 25, stretched: 44, contracted: 86, hand: true },
    ],
    marks: [{ x: 14, y: 194, text: 'open wide before you close' }],
    mirror: true,
  },

};

export const CUES: Record<FigureKey, Cue> = {
  pulldown: {
    reach: 'Arms fully straight at the top, with the shoulders allowed to rise toward your ears.',
    points: [
      'The lat crosses the shoulder, so it only reaches full length when the shoulder blade rotates upward. Let the weight pull your shoulders up, then pull down from there.',
      'Holding the blade down through the whole rep, which is what packing the shoulders teaches, cuts the stretch to almost nothing.',
    ],
  },
  row: {
    reach: 'Arm all the way forward at the front, with the shoulder blade following it.',
    points: [
      'Same joint as the pulldown at the other end of the movement. A blade locked in place means the lat never lengthens.',
      'Because these are single arm, you can also let the torso rotate slightly toward the pulley at the front and rotate back as you pull.',
    ],
  },
  flyHigh: {
    reach: 'Arms up and out at the start, with the hands behind the line of your torso.',
    points: [
      'Stand about two steps in front of the pulleys, roughly an arm\'s length. At one step the cable pulls nearly along your arm at the stretch, which loads the shoulder joint more than the pec. At two it pulls across the arm, so the stretch is the hardest point of the rep.',
      'Stagger your feet and lean forward about 20 degrees from the hips with your chest up. Chest up means the upper back stays straight while the hips hinge, so the chest faces forward. The lean sets the angle between the cable and your chest.',
      'The pulley is high, so the hands sweep down and in and finish low in front. That path works the lower and middle fibers of the pec, and those are longest with the arm raised and back.',
      'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
      'Pull your shoulder blades back and down before the first rep. That carries the shoulder joint back, so the arm opens further across the chest and the pec lengthens more. They draw slightly further together as the arms open. As the hands meet, keep them from sliding forward. Letting them go all the way turns the finish into front delt and serratus work.',
    ],
  },
  flyMid: {
    reach: 'Arms out at chest height at the start, with the hands behind the line of your torso.',
    points: [
      'Stand about two steps in front of the pulleys, roughly an arm\'s length. At one step the cable pulls nearly along your arm at the stretch, which loads the shoulder joint more than the pec. At two it pulls across the arm, so the stretch is the hardest point of the rep.',
      'Stagger your feet and lean forward about 12 degrees from the hips with your chest up. Chest up means the upper back stays straight while the hips hinge, so the chest faces forward. The lean sets the angle between the cable and your chest.',
      'The hands travel level and meet in front of the chest. That path works the middle fibers of the pec.',
      'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
      'Pull your shoulder blades back and down before the first rep. That carries the shoulder joint back, so the arm opens further across the chest and the pec lengthens more. They draw slightly further together as the arms open. As the hands meet, keep them from sliding forward. Letting them go all the way turns the finish into front delt and serratus work.',
    ],
  },
  flyLow: {
    reach: 'Arms down and out at the start, with the hands behind the line of your torso.',
    points: [
      'Stand about two steps in front of the pulleys, roughly an arm\'s length. At one step the cable pulls nearly along your arm at the stretch, which loads the shoulder joint more than the pec. At two it pulls across the arm, so the stretch carries at least as much load as the finish.',
      'Stagger your feet and lean forward only slightly, about 5 degrees, from the hips with your chest up. Chest up means the upper back stays straight while the hips hinge, so the chest faces forward. The lean sets the angle between the cable and your chest.',
      'The pulley is low, so the hands sweep up and in and finish high in front. That path works the upper fibers of the pec, the clavicular head, and those are longest with the arm low and back.',
      'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
      'Pull your shoulder blades back and down before the first rep. That carries the shoulder joint back, so the arm opens further across the chest and the pec lengthens more. They draw slightly further together as the arms open. As the hands meet, keep them from sliding forward. Letting them go all the way turns the finish into front delt and serratus work.',
    ],
  },
  bench: {
    reach: 'Elbows tucked back and down at the bottom, with the bar touching under control.',
    points: [
      'The bar on your ribcage is the hard limit, so what is left to control is elbow path. Tucked rather than flared puts the upper arm further behind your torso, which is where the pec stretch comes from.',
      'No bounce off the chest. The turnaround at full length is where pecs tear.',
      'Dumbbells reach further than a bar here, since nothing stops at the ribcage. Your crossover flys cover that range separately.',
    ],
  },
  overheadExt: {
    reach: 'Elbow folded fully behind your head, with the upper arm pointed up and back.',
    points: [
      'The long head crosses the shoulder, so it only reaches full length with the shoulder flexed. This is why the overhead version grows it 1.5 to 2 times more than a pushdown.',
      'Watch the upper arm rather than the elbow joint. If the elbow drifts forward as you lower, the long head shortens and the position stops being worth anything.',
      'If getting the bar overhead is the problem, raise the pulley off the floor or kneel. That is a setup fix rather than an exercise fix.',
    ],
  },
  pushdown: {
    reach: 'Forearm all the way up at the top, past 90 degrees.',
    points: [
      'The shoulder stays down here, so the long head is short whatever you do and the range worth having is at the top of the rep.',
      'Stopping at 90 degrees throws away the only stretch this exercise has.',
    ],
  },
  curl: {
    reach: 'Forearm completely straight at the bottom before you reverse.',
    points: [
      'With the elbow at your side the stretch is just full elbow extension. Most people stop 15 to 20 degrees short.',
      'That short position is also where swinging starts, so finishing straight fixes both.',
    ],
  },
  behindCurl: {
    reach: 'Arm straight at the bottom with the elbow still behind your torso.',
    points: [
      'The elbow sitting behind you lengthens the biceps long head at the shoulder as well as at the elbow, which is why this version is worth the awkward setup.',
      'Do not let the elbow drift forward as you lower. That gives up the shoulder half of the stretch.',
    ],
  },
  lateralRaise: {
    reach: 'Arm across the midline at the bottom before you raise.',
    points: [
      'The cable comes from the far side, so the bottom of the rep is loaded. A dumbbell at the same point has no moment arm and no tension at all.',
      'Travelling across the body first is the whole reason this version exists.',
    ],
  },
  rearDelt: {
    reach: 'Arm fully across the body before you pull.',
    points: [
      'The rear delt lengthens as the arm comes across the front, so the start position is where the stretch is.',
      'Keep the elbow angle fixed. Bending and straightening it turns the movement into a row.',
    ],
  },
  facePull: {
    reach: 'Arms fully extended forward at the start, with the shoulder blades allowed to spread.',
    points: [
      'The rhomboids lengthen when the blades spread apart, so let them travel forward rather than holding them pinned.',
      'Finish with the elbows high and behind, hands beside your head.',
    ],
  },
  uprightRow: {
    reach: 'Arms fully down at the bottom, shoulders relaxed.',
    points: [
      'The delt lengthens as the arm hangs, so stopping short at the bottom removes the stretch from every rep.',
      'Lead with the elbows on the way up rather than lifting with the hands.',
    ],
  },
  legPress: {
    reach: 'Knee bent as far as it goes before the pelvis starts to tuck off the pad.',
    points: [
      'The tuck is the limit rather than your flexibility. Past it the load goes into the lower back instead of the quad.',
      'Do not lock the knee at the top. The stretch is at the bottom and locking out just rests the joint.',
    ],
  },
  legCurl: {
    reach: 'Knee completely straight at the top of each rep.',
    points: [
      'Use the seated machine over the lying one if your gym has both. The seated version holds the hip flexed, which holds the hamstring longer, and Maeo and colleagues measured about 1.8 times the growth from it.',
      'That is the largest single difference in this list and it costs nothing.',
    ],
  },
  legExtension: {
    reach: 'Knee fully bent at the bottom, with the seat reclined.',
    points: [
      'The rectus femoris crosses the hip and the knee, so reclining the backrest puts the hip in more extension and lengthens it.',
      'Sitting bolt upright shortens it at the hip and leaves only the three single-joint quad heads working.',
    ],
  },
  hipAbduction: {
    reach: 'Knees all the way together before each rep.',
    points: [
      'The glute medius lengthens as the thigh crosses toward the midline, so the start position is the stretch.',
      'Setting the machine to a narrow start is what makes this worth doing.',
    ],
  },
  hipAdduction: {
    reach: 'Knees as wide as the machine goes before each rep.',
    points: [
      'The adductors lengthen as the legs open, so a wide start is the whole range.',
      'Open wide under control. This is one position where a fast turnaround is a strain risk.',
    ],
  },
  crunch: {
    reach: 'Spine tall at the top, with the ribs lifted away from the hips.',
    points: [
      'The abs lengthen as the trunk extends, so letting the spine stack up at the top is the stretch.',
      'Curl down with the spine rather than folding at the hip. Hip flexion moves the weight without loading the abs.',
    ],
  },
  woodchopper: {
    reach: 'Torso rotated fully toward the pulley before each rep.',
    points: [
      'The obliques lengthen in rotation, so the start position with the torso turned toward the stack is the stretch.',
      'Turn from the ribcage. Letting the hips spin with the torso removes the rotation from the muscle.',
    ],
  },
};

/** Every exercise that reaches a position worth drawing, and which one it is. */
export const FIGURE_FOR: Record<string, FigureKey> = {
  'barbell-incline-bench-press': 'bench',
  'barbell-bench-press': 'bench',
  'barbell-decline-bench-press': 'bench',

  'close-grip-lat-pulldown': 'pulldown',
  'lat-pulldown': 'pulldown',
  'wide-grip-lat-pulldown': 'pulldown',

  'cable-high-crossover-fly': 'flyHigh',
  'cable-mid-crossover-fly': 'flyMid',
  'cable-low-crossover-fly': 'flyLow',

  'cable-single-arm-high-row': 'row',
  'cable-single-arm-mid-row': 'row',
  'cable-single-arm-low-row': 'row',

  'cable-high-overhead-tricep-extension': 'overheadExt',
  'cable-low-overhead-tricep-extension': 'overheadExt',

  'cable-tricep-pushdown': 'pushdown',
  'cable-single-arm-underhand-tricep-pushdown': 'pushdown',

  'cable-bicep-curl': 'curl',
  'cable-hammer-curl': 'curl',
  'cable-reverse-curl': 'curl',
  'cable-behind-the-back-bicep-curl': 'behindCurl',

  'cable-behind-the-back-lateral-raise': 'lateralRaise',
  'cable-single-arm-rear-delt-fly': 'rearDelt',
  'cable-face-pull': 'facePull',
  'cable-upright-row': 'uprightRow',

  'machine-leg-press': 'legPress',
  'machine-leg-curl': 'legCurl',
  'machine-leg-extension': 'legExtension',
  'machine-hip-abductor': 'hipAbduction',
  'machine-hip-adductor': 'hipAdduction',

  'cable-crunch': 'crunch',
  'cable-oblique-crunch': 'crunch',
  'cable-high-woodchopper': 'woodchopper',
  'cable-low-woodchopper': 'woodchopper',
};

export interface Stretch {
  key: FigureKey;
  /** Absent where the cue stands on its own without a drawing. */
  figure?: Figure;
  cue: Cue;
}

/** The figure and cue for an exercise, or null where there is nothing to show. */
export function stretchFor(exerciseId: string | undefined): Stretch | null {
  if (!exerciseId) return null;
  const key = FIGURE_FOR[exerciseId];
  if (!key) return null;
  return { key, figure: FIGURES[key], cue: CUES[key] };
}

/**
 * The other limb, reflected about the body's center line at x 120.
 *
 * Reflecting x to 240 - x turns an angle a into 180 - a, for both poses, which
 * also reverses the direction of each sweep. Done on the data rather than with
 * a scale(-1, 1) wrapper, because the joints rotate with transform-box: view-box
 * and a mirrored ancestor would put their pivots in the wrong place.
 */
export function mirrored(chain: Joint[]): Joint[] {
  return chain.map((j) => ({
    ...j,
    x: 240 - j.x,
    stretched: 180 - j.stretched,
    contracted: 180 - j.contracted,
  }));
}

/** Where a joint's segment ends when the figure is at rest. */
export function endOf(j: Joint): { x: number; y: number } {
  const a = (j.stretched * Math.PI) / 180;
  return { x: j.x + j.len * Math.cos(a), y: j.y + j.len * Math.sin(a) };
}

/**
 * How far each joint rotates from the resting (stretched) pose to the
 * contracted one.
 *
 * A nested segment inherits its parent's rotation, so its own share is the
 * difference between the two poses minus whatever the parent already applied.
 * Rotating about the joints this way keeps every segment its drawn length at
 * every frame, which interpolating the endpoints does not.
 */
export function sweeps(chain: Joint[]): number[] {
  let parent = 0;
  return chain.map((j) => {
    const own = j.contracted - j.stretched - parent;
    parent += own;
    return own;
  });
}
