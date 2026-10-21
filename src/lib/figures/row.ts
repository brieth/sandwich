/**
 * Single-arm cable rows, high, mid and low, with a D handle in the right hand.
 *
 * The upper arm swings through directions set against the upper torso. The
 * forearm always points at the pulley, which is how a row is done: the cable
 * runs straight on from the forearm, so it puts no turning load on the elbow
 * and the pull turns the arm at the shoulder. At the stretch the upper arm
 * points at the pulley as well, so the whole arm lies along the cable.
 *
 * With the forearm on the cable, the cable's moment arm at the shoulder is
 * the upper arm's 34 times the sine of the elbow angle, so the cable resists
 * most with the elbow near 90 degrees and less at the finish, where the elbow
 * folds past it. Measured (check.mjs moment arm, cm, sampled every 0.05):
 * high peaks at 33.6 at t = 0.50 (elbow 84) and ends at 18.9, 56% of the peak;
 * mid 34.0 at 0.55 (elbow 91) and 22.4, 66%; low 33.7 at 0.70 (elbow 87) and
 * 29.7, 88%. The share row climbs to 84 to 98 at the finish only because the
 * hand comes in toward the shoulder.
 *
 * That moment arm covers only the arm turning at the shoulder. At the stretch
 * the arm lies along the cable, so the full tension reaches the shoulder
 * joint, and the blade drawing back works almost directly against it.
 * Measured with finite differences over 0.01 in t: at t = 0 the shoulder
 * joint's own movement makes up 64% (high), 56% (mid) and 72% (low) of the
 * cable's travel, falling to 15 to 22% at the finish, and it moves 9, 21 and
 * 34 degrees off the line away from the pulley, so it works against 99%, 93%
 * and 83% of the tension. The cue limits its leverage claims to the arm and
 * says what the blade carries.
 *
 * The lat proxy runs from the low back round the bottom of the blade to the
 * upper arm, so half or more of its stretch comes from the blade: drawn
 * forward and turned up at the start, back and down at the finish. With the
 * blade held at its finish position through the rep, the lat's travel falls
 * from 25.5 to 10.9 (high), 18.2 to 9.1 (mid) and 14.2 to 6.8 (low). That
 * ratio is a property of the proxy, so the cue says only that the stretch is
 * smaller.
 *
 * The chest turns 15 degrees to the left at the stretch, which brings the
 * right shoulder forward toward the pulley, and comes back square at the
 * finish. That adds 1.6 (high), 1.9 (mid) and 1.9 (low) to the lat proxy's
 * travel. The head turns back against the chest and keeps facing the pulley.
 * All of the turn is at the thoracic joint, since the lumbar spine turns only
 * a few degrees. The upper torso box then steps out 3.9 past the lower one,
 * front and back, at the stretch. Putting a third of the turn in the lumbar
 * joint cut the steps to 2.7 and 1.2 but turned the whole torso teal and took
 * 0.5 to 0.6 off the lat gain.
 */
import type { Body, BodySpec, Limb, Scap } from '../figure3d/body';
import { solveBody } from '../figure3d/body';
import type { FigureDef, MuscleName, ViewDef } from '../figure3d/figure';
import type { Q, V3 } from '../figure3d/math';
import { add, dist, dot, mul, norm, qRot, sub } from '../figure3d/math';
import { cable, floor, pulley } from '../figure3d/equipment';
import type { Prim } from '../figure3d/scene';
import { perpTo } from '../figure3d/scene';
import type { Group } from './kit';
import { DIM, VIEW, dirHE, key, keyDir } from './kit';

const conj = (q: Q): Q => [q[0], -q[1], -q[2], -q[3]];
/** A room point in the upper torso's body coordinates. */
const inUpper = (b: Body, p: V3): V3 => add(b.xf.upper.pivot, qRot(conj(b.xf.upper.r), sub(p, b.xf.upper.o)));
/** A room direction in the upper torso's axes. */
const dirInUpper = (b: Body, d: V3): V3 => qRot(conj(b.xf.upper.r), d);

const HANG: Limb = { dirs: [[0, 1, 0], [0, 1, 0]] };

interface RowDef {
  pulley: V3;
  /** Whether the drawing is sized to keep the pulley in view. */
  pulleyInFrame: boolean;
  floor: number;
  /** Hip hinge, degrees, held through the rep. */
  lean: number;
  /** Chest turned to the left at the stretch, degrees, so the right shoulder comes forward. */
  twist: number;
  scap: [number, Record<string, number>][];
  /** Upper arm directions in the upper torso frame after t = 0; the pulley sets t = 0. */
  arm: [number, V3][];
  legs: Pick<BodySpec, 'legR' | 'legL' | 'footR' | 'footL'>;
  /** Where the left hand rests, from the body at the finish. */
  handL: (b: Body) => V3;
  poleL: V3;
  /**
   * The left hand bears weight, so as the chest turns the left blade slides
   * round the ribs to keep the left shoulder where it is, and the left arm
   * holds still. Otherwise the blade stays put and the arm re-solves to the
   * same hand position, so it moves with the chest.
   */
  bracedL: boolean;
  muscles: MuscleName[];
  contacts: (b: Body) => { name: string; gap: number; tol?: number }[];
  views: ViewDef[];
  allow?: string[];
}

/** The body without its arms or left blade, which depend on it. */
function trunk(d: RowDef, t: number): BodySpec {
  const tw = key(t, [
    [0, d.twist],
    [1, 0],
  ]);
  return {
    pos: [0, 0, 0],
    pelvis: { flex: d.lean },
    thoracic: { twist: -tw },
    neck: { twist: tw },
    scapR: key(t, d.scap) as Scap,
    scapL: {},
    armR: HANG,
    armL: HANG,
    ...d.legs,
  };
}

function row(d: RowDef): FigureDef {
  const b0 = solveBody(trunk(d, 0));
  const b1 = solveBody(trunk(d, 1));
  const shoulderL = b1.j.shoulderL;
  const handL = d.handL(b1);
  // At the stretch the upper arm points 3 to 6 degrees below the line to the
  // pulley (5.2 high, 5.6 mid, 3.4 low), so the elbow is soft rather than
  // locked. The nudge is a fixed 0.1 down, which tilts a line that already
  // slopes down, as the low row's does, by less.
  const reach = norm(sub(d.pulley, b0.j.shoulderR));
  const u0 = dirInUpper(b0, norm(add(reach, [0, 0.1, 0])));
  return {
    views: d.views,
    pose: (t) => {
      const s = trunk(d, t);
      const b = solveBody(s);
      let scapL: Scap = {};
      if (d.bracedL) {
        const p = inUpper(b, shoulderL);
        scapL = { x: -DIM.shoulder[0] - p[0], y: p[1] - DIM.shoulder[1], z: p[2] - DIM.shoulder[2] };
      }
      const u = b.dirOf('upper', keyDir(t, [[0, u0], ...d.arm]));
      const E = add(b.j.shoulderR, mul(norm(u), DIM.upperArm));
      const H = add(E, mul(norm(sub(d.pulley, E)), DIM.forearm));
      return { ...s, scapL, armR: { pts: [E, H] }, armL: { ik: handL, pole: d.poleL } };
    },
    equipment: (b) => {
      const H = b.j.handR;
      const c = norm(sub(d.pulley, H));
      // Neutral grip, thumb up: the bar of the D runs up through the fist,
      // square to the cable, and the D's sides meet 9 out along the cable,
      // where it clips on. handle() in equipment.ts picks the bar nearest
      // left-right when the forearm lies along the cable, which drew a palm
      // down grip, so the D is drawn here.
      const grip = perpTo(c, b.dirOf('upper', [0, -1, 0]));
      const clip = add(H, mul(c, 9));
      const D: Prim = {
        k: 'line',
        part: 'eq.handle',
        pts: [sub(H, mul(grip, 6)), add(H, mul(grip, 6)), clip],
        closed: true,
        w: 2,
        tone: 'equip',
      };
      const fit = d.pulleyInFrame;
      return [floor(d.floor), pulley(d.pulley, { fit }), cable(d.pulley, clip, { fit }), D];
    },
    check: {
      muscles: d.muscles.map((m) => ({ m, side: 'R' as const })),
      load: (b) => [{ at: b.j.handR, dir: sub(d.pulley, b.j.handR) }],
      lever: [{ joint: 'shoulderR', end: 'elbowR' }],
      contacts: d.contacts,
      allow: d.allow,
    },
  };
}

/*
 * The mid and low finish: the upper arm 70 degrees back from straight out to
 * the side and 50 below level, with the blade 3 toward the spine and 1 down.
 * The elbow ends 8.6 behind the back and 13 degrees out from the side, close
 * to it, and the hand 4.9 (mid) and 6.7 (low) outside the torso. The first
 * finish, 55 back and 45 below with the blade 2 in and 2 down, flared the
 * elbow 24 degrees and left the hand 10 to 13 out, which is the path of an
 * upper-back row.
 *
 * Tucked like this, the upper arm's capsule (radius 4.5) passes into the box
 * torso past the check's 2.5 of give from t = 0.8 (low) or 0.85 (mid), up to
 * 4.8 at t = 1, where the arm's axis lies on the box's side face. At t = 1 the
 * overlap is past the give from 7 down the arm, the first point the check
 * tests and also the deepest, to 14, at the armpit, where the box's side face
 * runs straight down from the shoulder joint at the full shoulder width; a
 * real chest under the armpit is narrower than that, and an arm resting
 * against the side lies there. Hence the allow on the mid and low rows.
 *
 * Only 1 of depression at the finish. The middle trapezius proxy is a straight
 * line from the spine to a point on the blade that sits below it, so lowering
 * the blade lengthens it. With 2 down it bottomed out at t = 0.8 and rose 0.4
 * by the finish; with 1 it bottoms out at 5.3 at t = 0.85 and rises 0.2.
 */
const FINISH = dirHE(70, -50);
const RETRACTED = { x: -3, y: 1, z: -2, rot: -5 };

/* ---------- stances ---------- */

/**
 * front and back are where each ankle would be with the foot flat. heelUp
 * pitches the back foot that many degrees about its toe, which stays on the
 * floor, so the heel lifts and the ankle rises. The drawn foot is rigid, so
 * it pivots on the tip of the toe where a real foot bends at the ball.
 */
function standing(floorY: number, front: number, back: number, heelUp = 0): Pick<RowDef, 'legs' | 'contacts'> {
  const foot = (x: number, z: number, pitch: number): Limb => {
    const a = (pitch * Math.PI) / 180;
    const dir: V3 = [0, Math.sin(a), Math.cos(a)];
    const toe: V3 = [x, floorY, z + DIM.toe];
    return {
      foot: { heel: sub(toe, mul(dir, DIM.heel + DIM.toe)), dir, up: [0, -Math.cos(a), Math.sin(a)] },
      pole: [0, 0, 1],
    };
  };
  return {
    // Left foot forward, right foot back: the foot opposite the working arm
    // goes in front, where it braces against the cable's forward pull.
    legs: { legR: foot(DIM.hipHalf, back, heelUp), legL: foot(-DIM.hipHalf, front, 0) },
    contacts: (b) => [
      ...(heelUp ? [] : [{ name: 'heelR on floor', gap: b.j.heelR[1] - floorY }]),
      { name: 'toeR on floor', gap: b.j.toeR[1] - floorY },
      { name: 'heelL on floor', gap: b.j.heelL[1] - floorY },
      { name: 'toeL on floor', gap: b.j.toeL[1] - floorY },
    ],
  };
}

/** Left hand on the left hip, fingers forward, elbow out and back. */
const ON_HIP = (b: Body): V3 => b.at('pelvis', [-18, -9, 1]);

/*
 * Half-kneeling on the right knee with the left foot forward: the foot
 * opposite the working arm in front, as in the standing rows, with the knee
 * down on the working side. The kneeling thigh is 5 degrees behind vertical,
 * the knee joint 5 above the floor, and the shin and the top of the foot lie
 * along the floor behind it.
 */
const KNEE_H = 5;
const THIGH_BACK = (5 * Math.PI) / 180;
const KNEEL_KNEE: V3 = [DIM.hipHalf, DIM.thigh * Math.cos(THIGH_BACK), -DIM.thigh * Math.sin(THIGH_BACK)];
const KNEEL_FLOOR = KNEEL_KNEE[1] + KNEE_H;
const KNEEL_ANKLE: V3 = [DIM.hipHalf, KNEEL_FLOOR - 6, KNEEL_KNEE[2] - Math.sqrt(DIM.shin ** 2 - 1)];
// Instep flat: the foot points back and 36 degrees down, which puts the toe 5
// below the ankle, on the floor.
const INSTEP = (36 * Math.PI) / 180;
/*
 * The front ankle is under the front knee: the shin upright and the thigh
 * level, hip and knee both at 90 degrees. The ankle sits 2 wider than the
 * hip, so the check's hip abduction reads 1.
 */
const FRONT_ANKLE: V3 = [-12, KNEEL_FLOOR, 44];
/*
 * The left hand braces on top of the left thigh: 10 behind the knee joint, 9
 * above it and 4 to the outside. On the kneecap itself the arm was nearly
 * straight, so the upper arm ran down the front corner of the chest; here
 * the elbow bends 65 degrees and sits out to the side.
 */
const KNEE_BRACE: V3 = [-4, -9, -10];

/** Distance from a point to the segment a to b. */
const toSeg = (p: V3, a: V3, b: V3): number => {
  const ab = sub(b, a);
  const k = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return dist(p, add(a, mul(ab, k)));
};

const kneeling: Pick<RowDef, 'legs' | 'contacts'> = {
  legs: {
    legR: { pts: [KNEEL_KNEE, KNEEL_ANKLE] },
    footR: { dir: [0, Math.sin(INSTEP), -Math.cos(INSTEP)], up: [0, Math.cos(INSTEP), Math.sin(INSTEP)] },
    legL: { foot: { heel: sub(FRONT_ANKLE, [0, 0, DIM.heel]), dir: [0, 0, 1] }, pole: [0, -0.3, 1] },
  },
  contacts: (b) => [
    { name: 'kneeR on floor', gap: KNEEL_FLOOR - KNEE_H - b.j.kneeR[1] },
    { name: 'toeR on floor', gap: KNEEL_FLOOR - 1 - b.j.toeR[1] },
    { name: 'heelL on floor', gap: b.j.heelL[1] - KNEEL_FLOOR },
    { name: 'toeL on floor', gap: b.j.toeL[1] - KNEEL_FLOOR },
    // The hand's center against the thigh's axis: the thigh capsule's 7 and
    // about 3 of palm. Measured from the thigh itself, so it checks the
    // brace point really lies on the thigh.
    { name: 'handL on thighL', gap: toSeg(b.j.handL, b.j.hipL, b.j.kneeL) - 10 },
  ],
};

const MID_FLOOR = 87;
const LOW_FLOOR = 86;

/*
 * Back shows the blade, Side the stance, the lean and the cable's angle with
 * the forearm on it, Top the chest turning and the elbow passing the back. A
 * front view showed the back view's outline without the blade.
 *
 * From the side the far shoulder dot showed through the torso and the
 * protracted right blade left a fleck mid torso, so Side hides the blades and
 * the left arm; the high row hides only the left shoulder dot and keeps the
 * forearm, which shows the brace on the thigh. From above, the low row's
 * front foot drew over the head and a blade left a fleck at the back edge, so
 * Top hides the blades, and the legs of the standing rows, whose stance Side
 * already shows. The high row's Top keeps the legs for the kneel and the
 * brace.
 *
 * In the mid row's Back view at t = 0 the elbow is in front of the chest, 1.3
 * inside the torso's outline. A dot may sit up to 1.5 inside and still show
 * (INSET in scene.ts), so the elbow and the top of the upper arm show under
 * the shoulder dot. The rest of the arm is in front of the chest, hidden by
 * it. At an inset of 0.75 the elbow was hidden too and the arm read as a stub.
 */
const SIDE_STANDING: ViewDef = { ...VIEW.sideRight, hide: ['armL', 'scap'] };
const TOP_STANDING: ViewDef = { ...VIEW.top, hide: ['leg', 'scap'] };

/*
 * Pulley distances, hips to pulley, chosen from the check's moment arm at the
 * shoulder, cm, at t = 0.25 / 0.5 / 0.75 / 1. At t = 0 it is 1 to 5 at every
 * distance, since the arm points at the pulley.
 *
 * High, pulley at the top of the column, 205 off the floor; arm elevation at
 * the stretch and elbow flexion at the finish:
 *   100: 28.9 / 32.7 / 24.4 / 12.1, arm 133 up, elbow 156
 *   130: 27.1 / 33.5 / 27.3 / 15.3, arm 124 up, elbow 152
 *   155: 25.7 / 33.7 / 29.0 / 17.3, arm 119 up, elbow 149
 *   180: 24.6 / 33.6 / 30.3 / 18.9, arm 114 up, elbow 146
 *   200: 23.8 / 33.4 / 31.0 / 20.0, arm 112 up, elbow 144
 * Closer reaches higher, but the cable is so steep at the finish that the
 * elbow folds past what a loaded arm can before it gets behind the back. At
 * 180 it bends 146, near the end of a loaded arm's range; the lat proxy is
 * 66.9 at 100 and 66.6 at 180, so the higher reach gains it nothing it can
 * see. Capping the elbow and letting the forearm leave the cable does
 * not help: the forearm then sits short of the cable line, on the upper arm's
 * side of it, and the cable folds the elbow further. Capped at 135 at the
 * finish, the cable's moment arm about the elbow is 7.1, all of it bending
 * the elbow past the cap, which the triceps would have to hold.
 *
 * Mid, pulley at chest height, 125 off the floor:
 *    90: 27.9 / 34.0 / 30.6 / 22.1
 *   110: 26.2 / 33.9 / 31.2 / 22.4
 *   200: 23.2 / 33.1 / 32.2 / 23.1
 * Distance barely changes the load or the stretch (lat 59.5 at 90, 60.2 at
 * 200). At 110 the hand stops 31 short of the pulley at full reach, so the
 * weight stays lifted. Lower pulleys put the stretch lower and the hand only
 * a little lower at the finish (105 off the floor: arm 70 up at the stretch,
 * lat 58.6, hand 26 above the hip joints along the torso against 31), so the
 * pulley stays at chest height and the hand finishes by the lower ribs.
 *
 * Low, pulley 15 off the floor, 25 degree lean; arm elevation at the stretch
 * and the hand's height above the hip joints at the finish, measured along
 * the torso (the room's vertical reads less with the lean):
 *    70: 17.7 / 28.6 / 33.2 / 32.6, arm 42 up, hand 11
 *   125: 20.2 / 31.0 / 33.6 / 29.7, arm 61 up, hand 19
 *   160: 21.0 / 31.7 / 33.4 / 28.0, arm 69 up, hand 22
 * Farther reaches farther forward (lat 53.3, 55.8, 56.8 at the stretch) and
 * lifts the finish up the side. 125 puts the hand at the waist.
 */
const DEFS: Record<'rowHigh' | 'rowMid' | 'rowLow', RowDef> = {
  rowHigh: {
    pulley: [15, KNEEL_FLOOR - 205, 180],
    // In frame, the pulley this far ahead and up shrank the kneeling body
    // from scale 1.35 to 0.90, so it is left out; the cable still runs off
    // the edge at its angle.
    pulleyInFrame: false,
    floor: KNEEL_FLOOR,
    lean: 0,
    twist: 15,
    scap: [
      [0, { x: 4, y: -6, z: 3, rot: 40 }],
      [1, { x: -2, y: 2, z: -3, rot: 0 }],
    ],
    /*
     * Halfway, the elbow is down in front of the shoulder and a little out,
     * under the hand. The finish stays at 45 degrees back from out to the
     * side and 52 below level, so the elbow ends 4 behind the back and 26
     * degrees out from the side. With the forearm on this steep cable each
     * step back from there folds the elbow further: at 55 back it bends 151
     * and the upper arm passes 2.7 into the box torso, at 65 back 155.5 and
     * 3.4.
     */
    arm: [
      [0.5, dirHE(-45, -35)],
      [1, dirHE(45, -52)],
    ],
    ...kneeling,
    handL: (b) => add(b.j.kneeL, KNEE_BRACE),
    poleL: [-1, -0.3, -0.2],
    // The left blade slides up to 5.2 forward at the stretch.
    bracedL: true,
    muscles: ['lat'],
    views: [VIEW.back, { ...VIEW.sideRight, hide: ['armL.shoulder', 'scap'] }, { ...VIEW.top, hide: ['scap'] }],
  },
  rowMid: {
    pulley: [15, MID_FLOOR - 125, 110],
    pulleyInFrame: true,
    floor: MID_FLOOR,
    // Lean lengthens the stretch a little and lifts the finish: at 0, 5, 10
    // and 20 degrees the lat proxy starts at 59.2, 59.8, 60.3 and 61.2, and
    // the hand finishes 29, 31, 34 and 38 above the hip joints, measured
    // along the torso. 20 put it at the chest and bent the elbow 150.
    lean: 5,
    twist: 15,
    scap: [
      [0, { x: 5, y: -1, z: 4, rot: 25 }],
      [1, RETRACTED],
    ],
    arm: [[1, FINISH]],
    // Knees bent 26 degrees.
    ...standing(MID_FLOOR, 25, -25),
    handL: ON_HIP,
    poleL: [-1, 0, -0.6],
    // The left elbow moves 2.5 as the chest turns.
    bracedL: false,
    muscles: ['lat', 'midTrap'],
    allow: ['armR.upper~torso'],
    views: [VIEW.back, SIDE_STANDING, TOP_STANDING],
  },
  rowLow: {
    pulley: [15, LOW_FLOOR - 15, 125],
    pulleyInFrame: true,
    floor: LOW_FLOOR,
    // Lean does what distance does: at 15, 25 and 35 degrees the arm is 52,
    // 61 and 70 up at the stretch and the hand finishes 14.5, 18.9 and 23.6
    // above the hip joints, measured along the torso.
    lean: 25,
    twist: 15,
    // The arm is only about 60 degrees up at the stretch, so the blade turns
    // up less than for the other two.
    scap: [
      [0, { x: 5, y: 0, z: 4, rot: 12 }],
      [1, RETRACTED],
    ],
    arm: [[1, FINISH]],
    // A longer stagger than the mid row's for the lean, on the ball of the
    // back foot: the front knee bent 31 degrees and the back knee 20, the
    // back foot pitched 20 degrees with the heel 7.5 off the floor and the
    // toe 28 behind the hip joints. The ankle bends 20 degrees past square
    // to the shin. A first version had the knees the other way round and
    // looked mid-step. The next had the back foot flat with the ankle 33
    // behind the hips: the back knee bent only 11 and the ankle 28, the
    // position of a full standing calf stretch, which a person would not
    // hold through a set. Moving that flat foot in to bend the knee made the
    // stance symmetric again. The longer stance widens the side view and
    // takes the drawing's scale from 1.35 to 1.27.
    ...standing(LOW_FLOOR, 25, -46, 20),
    handL: ON_HIP,
    poleL: [-1, -0.3, -0.6],
    // The left elbow moves 2.4 as the chest turns.
    bracedL: false,
    muscles: ['lat'],
    allow: ['armR.upper~torso'],
    views: [VIEW.back, SIDE_STANDING, TOP_STANDING],
  },
};

export const group: Group = {
  figures: {
    rowHigh: row(DEFS.rowHigh),
    rowMid: row(DEFS.rowMid),
    rowLow: row(DEFS.rowLow),
  },
  cues: {
    rowHigh: {
      reach: 'Arm reaching up toward the pulley at the start with the elbow almost straight, and the shoulder blade drawn up and forward.',
      points: [
        'Set the pulley at the top and clip a D handle to it. Hold the handle in your right hand, thumb up. Kneel upright on your right knee, a little under two and a half steps from the pulley, with your left foot flat in front and the left shin upright, and rest your left hand on your left thigh just behind the knee. The front foot, opposite the working arm, braces against the forward pull of the cable. To work the left arm, do everything mirrored.',
        'The lat runs from your middle and lower back and the top of your pelvis, past the bottom of the shoulder blade, to the front of your upper arm just below the shoulder. It lengthens as the arm reaches up and forward and the shoulder blade is drawn up and forward around your ribs, so in this row it is longest at full reach. Let the handle draw your shoulder up and forward at the start of each rep, and let your chest turn about 15 degrees to the left so your right shoulder comes forward toward the pulley, which lengthens the lat a little more. Holding the shoulder blade back and down at the stretch leaves the lat shorter.',
        'Pull the elbow down and back until it is just behind your back and a little out from your side, with the shoulder blade drawn back and down and your chest facing the pulley again. The hand finishes beside your upper chest. Keep your forearm pointing at the pulley the whole way, so the cable pulls straight along it and does not bend or straighten the elbow. Keep your hips and legs still and your torso upright.',
        'At the stretch the cable runs straight along your arm and pulls your shoulder up and forward with the full weight. Drawing the shoulder blade back and down to start the pull works against nearly all of it, and the cable barely resists the arm turning at the shoulder. The cable resists the arm most about halfway through the rep, when your elbow is bent about 90 degrees. At the finish it resists the arm a little over half as much.',
        'At this distance the elbow is almost fully bent at the finish. Kneeling closer lets the arm reach higher at the stretch, but the cable then comes down more steeply, and the elbow would have to bend further than it comfortably can to get behind your back.',
      ],
    },
    rowMid: {
      reach: 'Arm reaching toward the pulley at the start with the elbow almost straight, and the shoulder blade drawn forward around your ribs.',
      points: [
        'Set the pulley at about chest height and clip a D handle to it. Hold the handle in your right hand, thumb up. Stand with your hips about one and a half steps from the pulley, your left foot forward, your right foot back and your knees slightly bent, and lean forward about 5 degrees from the hips. Rest your left hand on your hip. The front foot, opposite the working arm, braces against the forward pull of the cable. At the stretch the handle stops short of the pulley, so the weight stays lifted. To work the left arm, do everything mirrored.',
        'The lat runs from your middle and lower back and the top of your pelvis, past the bottom of the shoulder blade, to the front of your upper arm just below the shoulder. The middle trapezius runs from your upper spine to the ridge across the top of the shoulder blade. Both lengthen as the shoulder blade is drawn forward around your ribs, and the lat also lengthens as the arm reaches forward, so in this row both are longest at full reach. Let the handle draw your shoulder forward at the start of each rep, and let your chest turn about 15 degrees to the left so your right shoulder comes forward toward the pulley, which lengthens the lat a little more. Holding the shoulder blade back and down at the stretch leaves the lat shorter and keeps the middle trapezius at one length through the rep.',
        'Pull the elbow back close to your side until it is just behind your back, with the shoulder blade drawn back and down and your chest facing the pulley again. The hand finishes beside your lower ribs. Keep your forearm pointing at the pulley the whole way, so the cable pulls straight along it and does not bend or straighten the elbow. Keep your hips and legs still and hold the lean.',
        'At the stretch the cable runs straight along your arm and pulls your shoulder forward with the full weight. Drawing the shoulder blade back and down to start the pull works against nearly all of it, and the cable barely resists the arm turning at the shoulder. The cable resists the arm most a little past halfway through the rep, when your elbow is bent about 90 degrees. At the finish it resists the arm about two thirds as much.',
      ],
    },
    rowLow: {
      reach: 'Arm reaching down and forward toward the pulley at the start with the elbow almost straight, and the shoulder blade drawn forward around your ribs.',
      points: [
        'Set the pulley at the bottom and clip a D handle to it. Hold the handle in your right hand, thumb up. Stand with your hips a little over one and a half steps from the pulley, your left foot forward and your right foot back, the front knee bent, the back knee slightly bent and the back heel raised, and lean forward about 25 degrees from the hips. Rest your left hand on your hip. The front foot, opposite the working arm, braces against the forward pull of the cable. To work the left arm, do everything mirrored.',
        'The lat runs from your middle and lower back and the top of your pelvis, past the bottom of the shoulder blade, to the front of your upper arm just below the shoulder. It lengthens as the arm reaches forward and the shoulder blade is drawn forward around your ribs, so in this row it is longest at full reach. Let the handle draw your shoulder forward at the start of each rep, and let your chest turn about 15 degrees to the left so your right shoulder comes forward toward the pulley, which lengthens the lat a little more. Holding the shoulder blade back and down at the stretch leaves the lat shorter.',
        'Pull the elbow up and back close to your side until it is just behind your back, with the shoulder blade drawn back and down and your chest facing the pulley again. The hand finishes beside your waist. Keep your forearm pointing at the pulley the whole way, so the cable pulls straight along it and does not bend or straighten the elbow. Keep your hips and legs still and hold the lean.',
        'At the stretch the cable runs straight along your arm and pulls your shoulder down and forward with the full weight. Drawing the shoulder blade back to start the pull works against most of it, and the cable barely resists the arm turning at the shoulder. The cable resists the arm most about two thirds of the way through the rep, when your elbow is bent about 90 degrees. At the finish it resists the arm about nine tenths as much.',
        'Standing farther back lets the arm reach farther forward at the stretch, which lengthens the lat a little more. The hand then finishes a little higher up your side.',
      ],
    },
  },
  exercises: {
    'cable-single-arm-high-row': 'rowHigh',
    'cable-single-arm-mid-row': 'rowMid',
    'cable-single-arm-low-row': 'rowLow',
  },
};
