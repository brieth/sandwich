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
}

export interface Pose {
  view: View;
  /** Root first. A second joint hangs off the end of the first. */
  chain?: Joint[];
  /** Used instead of chain where the limb foreshortens. Includes every limb. */
  track?: Track;
  /** Fixed segment drawn in the limb's color, e.g. an upper arm held still. */
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
 * Timing for sampled tracks, matched to the CSS limb-sweep keyframes so a track
 * moves on the same beat as a rotating chain: rest at the stretch to 16%, ease
 * to the contracted end by 54%, hold to 66%, ease back by 100%.
 */
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

/** Fraction of the way to the contracted end at a point in the 3.4 s cycle. */
export function sweepAt(phase: number): number {
  if (phase < 0.16) return 0;
  if (phase < 0.54) return EASE((phase - 0.16) / 0.38);
  if (phase < 0.66) return 1;
  return 1 - EASE((phase - 0.66) / 0.34);
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

/**
 * A crossover fly as one movement in 3D, projected into the top and front views.
 *
 * The arm sweeps in a plane tilted by the pulley height: a high pulley starts the
 * arm raised and finishes it low in front, a low pulley the reverse. Both views
 * are projections of the same motion, so they cannot disagree.
 *
 * Headings are the ones the top view already used: upper arm from 34 at the
 * stretch to -92.5 with the hands together in front, a 126.5 degree sweep. The
 * forearm runs 20 degrees further along the same arc, which is the fixed elbow
 * bend. At zero elevation this reproduces the previous top view exactly, which
 * is how the model was checked.
 */
function flyFigure(startElev: number, endElev: number): Figure {
  const d0 = dir(34, startElev);
  const d1 = dir(-92.5, endElev);
  const total = (Math.acos(dot3(d0, d1)) * 180) / Math.PI;
  const lead = 20 / total;

  const at = (t: number) => {
    const u = slerp(d0, d1, t);
    const f = slerp(d0, d1, t + lead);
    return { u, f };
  };

  const project = (view: 'top' | 'front'): Track => {
    // Top: shoulder on the torso side at mid depth, forward is up the page.
    // Front: shoulder on the shoulder line, up is up.
    const sx = view === 'top' ? 144 : 140;
    const sy = view === 'top' ? 93 : 56;
    const to2 = (v: V3): Pt => (view === 'top' ? { x: v[0], y: -v[2] } : { x: v[0], y: v[1] });
    const frames: Pt[][][] = [];
    for (let i = 0; i < FRAMES; i++) {
      const { u, f } = at(sweepAt(i / (FRAMES - 1)));
      const pu = to2(u);
      const pf = to2(f);
      const elbow = { x: sx + 34 * pu.x, y: sy + 34 * pu.y };
      const hand = { x: elbow.x + 32 * pf.x, y: elbow.y + 32 * pf.y };
      const near = [{ x: sx, y: sy }, elbow, hand];
      const far = near.map((q) => ({ x: 240 - q.x, y: q.y }));
      frames.push([near, far]);
    }
    return { frames };
  };

  return {
    view: 'top',
    height: 158,
    track: project('top'),
    alts: [{ view: 'front', height: 172, track: project('front') }],
  };
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
      { x: 140, y: 102, len: 34, stretched: -74, contracted: 45 },
      { x: 149.4, y: 69.3, len: 32, stretched: -74, contracted: 198, hand: true },
    ],
    marks: [{ x: 14, y: 30, text: 'blade rises' }],
    mirror: true,
    alts: [
      {
        view: 'back',
        height: 180,
        body: { headY: 76, spineTop: 90, hipY: 166 },
        chain: [
          { x: 140, y: 102, len: 34, stretched: -74, contracted: 45 },
          { x: 149.4, y: 69.3, len: 32, stretched: -74, contracted: 198, hand: true },
        ],
        blades: { dx: 0, dy: 9 },
        marks: [{ x: 14, y: 30, text: 'blades ride up' }],
        mirror: true,
      },
    ],
  },

  // Cable row. Same joint as the pulldown at the other end of the movement.
  row: {
    view: 'top',
    height: 158,
    chain: [
      { x: 144, y: 93, len: 30, stretched: -90, contracted: 78 },
      { x: 144, y: 63, len: 28, stretched: -90, contracted: -86, hand: true },
    ],
    alts: [
      {
        view: 'back',
        height: 172,
        // The forearm points mostly away from the camera here, so it is drawn
        // short. The blades are the whole reason for this angle.
        chain: [
          { x: 140, y: 56, len: 30, stretched: -20, contracted: 35 },
          { x: 168.2, y: 45.7, len: 10, stretched: -20, contracted: 35, hand: true },
        ],
        blades: { dx: -8, dy: 0 },
        marks: [{ x: 14, y: 150, text: 'blades spread at the front' }],
      },
    ],
  },

  // Crossover flys. The top view shows the stretch, which is the same for all
  // three: hands behind the line of the torso. The front view shows what the
  // pulley height changes, which is the plane the arm sweeps in. The high fly
  // starts 30 up and finishes 35 down at the waist. The low fly starts 30 down
  // and its upper arm finishes 5 up. The forearm runs 20 further along the
  // rising arc, which lifts the hands to y 44.5, just under the chin at 42, so
  // they finish at collarbone height. Measured: any finish from 10 up put the
  // hands over the face, 13.0 to 13.2 from the head center against 13.5.
  flyHigh: flyFigure(30, -35),
  flyMid: flyFigure(0, 0),
  flyLow: flyFigure(-30, 5),

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
          { x: 150, y: 93, len: 42, stretched: -80, contracted: -80 },
          { x: 157.3, y: 51.6, len: 28, stretched: 140, contracted: -80, hand: true },
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
    chain: [{ x: 128, y: 106, len: 44, stretched: -130, contracted: 90, hand: true }],
    marks: [{ x: 14, y: 54, text: 'forearm all the way up' }],
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
      { x: 140, y: 56, len: 32, stretched: 108, contracted: 0 },
      { x: 130.1, y: 86.4, len: 30, stretched: 108, contracted: 0, hand: true },
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
          // 145 keeps the upper arm 13.8 from the head center, clear of its
          // radius of 11 plus the stroke.
          { x: 144, y: 93, len: 31, stretched: 145, contracted: 0 },
          { x: 118.6, y: 110.8, len: 29, stretched: 145, contracted: 0, hand: true },
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
      { x: 144, y: 93, len: 31, stretched: 220, contracted: 375 },
      { x: 120.3, y: 73.1, len: 29, stretched: 220, contracted: 375, hand: true },
    ],
    alts: [
      {
        view: 'back',
        height: 172,
        chain: [
          { x: 150, y: 56, len: 29, stretched: 170, contracted: 0 },
          { x: 121.4, y: 61.0, len: 27, stretched: 170, contracted: 0, hand: true },
        ],
        blades: { dx: -8, dy: 0 },
        marks: [{ x: 14, y: 150, text: 'blades squeeze at the end' }],
      },
    ],
  },

  facePull: {
    view: 'top',
    mirror: true,
    height: 158,
    chain: [
      { x: 144, y: 93, len: 30, stretched: -90, contracted: -10 },
      { x: 144, y: 63, len: 28, stretched: -90, contracted: 150, hand: true },
    ],
    alts: [
      {
        view: 'back',
        height: 172,
        chain: [
          { x: 140, y: 56, len: 30, stretched: -25, contracted: -55 },
          { x: 167.2, y: 43.3, len: 16, stretched: -25, contracted: -95, hand: true },
        ],
        blades: { dx: -8, dy: 0 },
        marks: [{ x: 14, y: 150, text: 'elbows finish high' }],
        mirror: true,
      },
    ],
  },

  uprightRow: {
    view: 'front',
    height: 172,
    chain: [
      { x: 140, y: 56, len: 34, stretched: 90, contracted: 10 },
      { x: 140, y: 90, len: 32, stretched: 90, contracted: 160, hand: true },
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
      'The pulley is high, so the hands sweep down and in and finish low in front. That path works the lower and middle fibers of the pec, and those are longest with the arm raised and back.',
      'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
      'Keep the chest open. A shoulder that rolls forward at the start puts the range into the joint instead of the pec.',
    ],
  },
  flyMid: {
    reach: 'Arms out at chest height at the start, with the hands behind the line of your torso.',
    points: [
      'The hands travel level and meet in front of the chest. That path works the middle fibers of the pec.',
      'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
      'Keep the chest open. A shoulder that rolls forward at the start puts the range into the joint instead of the pec.',
    ],
  },
  flyLow: {
    reach: 'Arms down and out at the start, with the hands behind the line of your torso.',
    points: [
      'The pulley is low, so the hands sweep up and in and finish high in front. That path works the upper fibers of the pec, the clavicular head, and those are longest with the arm low and back.',
      'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
      'Keep the chest open. A shoulder that rolls forward at the start puts the range into the joint instead of the pec.',
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
