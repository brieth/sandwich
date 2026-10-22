/**
 * Cable crunches, kneeling with a high pulley: straight down with a rope, and
 * down and across with a D handle.
 *
 * Both are spinal flexion with the hips held still. The pelvis and thighs keep
 * one pose through the rep, so they draw grey, and everything above the waist
 * moves. The hands hold their place on the upper torso, beside the head, so
 * the arms ride with the chest and do not pull.
 */
import type { Body, BodySpec, Limb, Scap } from '../figure3d/body';
import { solveBody, twoBone } from '../figure3d/body';
import type { FigureDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, dist, mul, norm, sub } from '../figure3d/math';
import type { Prim } from '../figure3d/scene';
import { perpTo } from '../figure3d/scene';
import { cable, floor, pulley, rope } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, key } from './kit';

/* ---------- kneeling ---------- */

/*
 * Both knees down. The knee joint sits 5 above the floor, and the shin and the
 * top of the foot lie along the floor behind it, as in the half-kneeling row:
 * the foot points back and 36 degrees down, which puts the toe on the floor.
 */
const KNEE_H = 5;
const INSTEP_A = (36 * Math.PI) / 180;
const INSTEP: { dir: V3; up: V3 } = {
  dir: [0, Math.sin(INSTEP_A), -Math.cos(INSTEP_A)],
  up: [0, Math.cos(INSTEP_A), Math.sin(INSTEP_A)],
};

interface Kneel {
  floorY: number;
  knee: V3;
  legs: Pick<BodySpec, 'legR' | 'legL' | 'footR' | 'footL'>;
  contacts: (b: Body) => { name: string; gap: number }[];
}

/** Thighs tipped forward of vertical by tilt degrees, knees kneeX from the midline. */
function kneel(tilt: number, kneeX: number): Kneel {
  const a = (tilt * Math.PI) / 180;
  const dx = kneeX - DIM.hipHalf;
  const yz = Math.sqrt(DIM.thigh ** 2 - dx * dx);
  const knee = (s: 1 | -1): V3 => [s * kneeX, yz * Math.cos(a), yz * Math.sin(a)];
  const floorY = knee(1)[1] + KNEE_H;
  const ankle = (s: 1 | -1): V3 => [s * kneeX, floorY - 6, knee(s)[2] - Math.sqrt(DIM.shin ** 2 - 1)];
  return {
    floorY,
    knee: knee(1),
    legs: {
      legR: { pts: [knee(1), ankle(1)] },
      legL: { pts: [knee(-1), ankle(-1)] },
      footR: INSTEP,
      footL: INSTEP,
    },
    contacts: (b) => [
      { name: 'kneeR on floor', gap: floorY - KNEE_H - b.j.kneeR[1] },
      { name: 'kneeL on floor', gap: floorY - KNEE_H - b.j.kneeL[1] },
      { name: 'ankleR over floor', gap: floorY - 6 - b.j.ankleR[1] },
      { name: 'ankleL over floor', gap: floorY - 6 - b.j.ankleL[1] },
      { name: 'toeR on floor', gap: floorY - 1 - b.j.toeR[1] },
      { name: 'toeL on floor', gap: floorY - 1 - b.j.toeL[1] },
    ],
  };
}

/* ---------- arms ---------- */

/**
 * An arm whose hand holds a point fixed on the upper torso, given as
 * directions in that frame so it rides with the chest.
 */
function armTo(shoulder: V3, hand: V3, pole: V3): Limb {
  const { mid, end } = twoBone(shoulder, hand, pole, DIM.upperArm, DIM.forearm);
  return { dirs: [norm(sub(mid, shoulder)), norm(sub(end, mid))] };
}

/** The shoulder joint in upper torso coordinates, moved by the blade. */
const shoulderAt = (s: 1 | -1, sc: Scap): V3 => [
  s * (DIM.shoulder[0] + (sc.x ?? 0)),
  DIM.shoulder[1] + (sc.y ?? 0),
  DIM.shoulder[2] + (sc.z ?? 0),
];

const pathLen = (pts: V3[]) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0);

/* ---------- cable crunch ---------- */

/*
 * Hip flexion held through the rep, as the pelvis's tip forward. The thighs
 * stand 10 degrees forward of vertical, so the hips sit just behind the knees
 * and the hip angle is 10 more than this.
 *
 * The setup asks for the spine tall at the top. It is drawn as the spine
 * extended on a trunk leaned forward from the hips, which is how the exercise
 * is set up: the cable pulls up along the trunk at the top and across it once
 * the trunk has curled, so an upright trunk leaves the top with almost no
 * load. Two things set the top's load. One is where the pulley sits: here it
 * is over the farthest-forward point the head reaches, which puts the knees 64
 * behind it, a little under one step, and kneeling farther back tips the cable
 * forward at the top. The other is the hip lean. Measured as the cable's
 * moment arm about the mid back, cm of torque per unit of force, at the top
 * and at its most (about t = 0.75), with the pulley over the head's farthest
 * point:
 *
 *   lean 40: 9 / 47   lean 45: 15 / 48   lean 50: 21 / 48   lean 55: 27 / 47
 *
 * At lean 50, setting the pulley 15 farther forward drops the top to 15, and
 * 30 farther forward to 9; 15 farther back raises it to 27.
 *
 * The trunk's own weight works against the cable at the top: leaning forward,
 * it pulls the spine into flexion. For an 80 kg body (head, arms and chest at
 * standard segment fractions) that is about 580 kg cm about the mid back at
 * lean 50, against the cable's 21 kg cm per kg of stack, so the abs carry load
 * at the top only above about 27 kg on the stack; below that the back
 * extensors hold the arch. The same crossover is 53 kg at lean 40, 34 at 45
 * and 24 at 55. The weight helps the curl through the whole rep, and against
 * the cable's moment it helps most at the top (27 kg cm per cm of moment arm
 * there, 18 at t = 0.75), so counting it makes the top lighter still.
 *
 * Lean 50 puts the hip-to-shoulder line 41 degrees forward of vertical at the
 * top, and at the bottom leaves the elbows 20 off the floor and 44 in front of
 * the knees; lean 55 brings the elbows to 15 off the floor.
 */
interface CrunchSetup {
  /** Hip flexion as the pelvis's tip forward, degrees. */
  lean: number;
  /** Lumbar flex, start then finish, degrees. */
  lumbar: [number, number];
  /** Thoracic flex, start then finish, degrees. */
  thoracic: [number, number];
}

/*
 * Spine, degrees, top then bottom. The engine bends the lumbar joint about the
 * line through the hip joints, so lumbar flexion draws as the whole trunk
 * tipping at the hips, which reads as the hip hinge the cue warns against. The
 * thoracic joint bends at the mid ring, where it reads as the back rounding,
 * so most of the curl is put there. With lumbar -10 to 28 and thoracic -10 to
 * 30 the first half of the rep drew as a hinge. Here the lower back arches 5
 * and the chest lifts 15 at the top, so the ribs ride up away from the hips;
 * at the bottom the lower back rounds 12, the upper back 40, and the chin
 * tucks 10. rectusAbdominis shortens 33 percent.
 */
const CRUNCH: CrunchSetup = { lean: 50, lumbar: [-5, 12], thoracic: [-15, 40] };

function cableCrunch(c: CrunchSetup): FigureDef {
  const k = kneel(10, 12);
  // Blades drawn forward and slightly up, as they go with the elbows in front.
  const scap: Scap = { x: 3, y: -2, z: 3, rot: 30 };
  // Fists beside the ears, a little in front of the head's center. The rope's
  // strands then clear the head on their way up to the knot.
  const handR: V3 = [16, -76, 7];
  const handL: V3 = [-16, -76, 7];
  // Elbows forward and a little in, about shoulder width apart.
  const armR = armTo(shoulderAt(1, scap), handR, [0.15, 0.4, 1]);
  const armL = armTo(shoulderAt(-1, scap), handL, [-0.15, 0.4, 1]);
  const pose = (t: number): BodySpec => ({
    pos: [0, 0, 0],
    pelvis: { flex: c.lean },
    lumbar: { flex: key(t, [[0, c.lumbar[0]], [1, c.lumbar[1]]]) },
    thoracic: { flex: key(t, [[0, c.thoracic[0]], [1, c.thoracic[1]]]) },
    neck: { flex: key(t, [[0, 0], [1, 10]]) },
    scapR: scap,
    armR,
    armL,
    ...k.legs,
  });
  // The highest pulley, 205 off the floor, over the farthest-forward point the
  // head reaches.
  const headZ = Math.max(...[0, 0.25, 0.5, 0.75, 1].map((t) => solveBody(pose(t)).j.head[2]));
  const P: V3 = [0, k.floorY - 205, headZ];
  const knot = (b: Body) => rope(b.j.handR, b.j.handL, P);
  return {
    views: [VIEW.front, VIEW.side],
    pose,
    equipment: (b) => {
      const r = knot(b);
      return [floor(k.floorY), pulley(P), cable(P, r.attach), ...r.prims];
    },
    check: {
      muscles: [{ m: 'rectusAbdominis', side: 'R' }],
      // The strands meet at the knot, so the cable's pull on both hands acts
      // as one force there along the cable.
      load: (b) => {
        const j = knot(b).attach;
        return [{ at: j, dir: sub(P, j) }];
      },
      // The spine at the mid back, and at the waist, which the engine bends
      // about the line through the hip joints.
      lever: [
        { joint: 'mid', end: 'neck' },
        { joint: 'hipR', end: 'neck' },
      ],
      contacts: k.contacts,
    },
  };
}

/* ---------- oblique crunch ---------- */

/*
 * Grip to the clip, along the cable. At 9 the D hid under the two hand dots
 * in every view; the woodchopper's two-hand D measured the same and uses 13.
 */
const D_APEX = 13;

/**
 * A D handle in both hands, one wrapped over the other. The grip is 12 long,
 * centered between the hands and square to the cable, which is how the
 * cable's pull holds it, and the two sides of the D meet D_APEX out along the
 * cable, where it clips on.
 */
function dHandle(h1: V3, h2: V3, toward: V3): { prims: Prim[]; attach: V3 } {
  const m = mul(add(h1, h2), 0.5);
  const c = norm(sub(toward, m));
  const g = perpTo(c, sub(h2, h1));
  const a = add(m, mul(c, D_APEX));
  return {
    prims: [{ k: 'line', part: 'eq.handle', pts: [add(m, mul(g, -6)), add(m, mul(g, 6)), a], closed: true, w: 2, tone: 'equip' }],
    attach: a,
  };
}

/*
 * The side wall of the waist on one side: the lower ribs at the side, down to
 * the top of the hip bone. The lateral fibers of both obliques run here, and
 * this is the length a side bend changes most. The built-in oblique proxies
 * cross the midline in front, which suits rotation and flexion.
 */
const sideWall = (sd: 1 | -1) => (b: Body) =>
  pathLen([b.at('upper', [sd * 16, -34, 3]), b.at('lower', [sd * 15, -15, 2]), b.at('pelvis', [sd * 13, -6, 1])]);

interface ObliqueSetup {
  /** Pulley out to the left of the hips, cm. */
  out: number;
  /** Pulley forward of the knees, cm. */
  fwd: number;
  /** Hip flexion as the pelvis's tip forward, degrees. */
  lean: number;
  /** Lumbar side bend, start then finish, degrees. */
  side: [number, number];
  /** Thoracic flex, start then finish, degrees. */
  thoracic: [number, number];
  /** Left and right fists in upper torso coordinates, one wrapped over the other. */
  hL: V3;
  hR: V3;
}

/*
 * Spine, degrees, start then finish. The side bend is all at the waist and the
 * flexion all in the upper back. The engine joins torso parts with a filler
 * whose faces stay flat only while one joint turns about one axis; a joint
 * that both flexes and side-bends warps it, and the collision test then
 * reports limbs far from the torso as inside it (the shins 15 to 19 inside
 * it, with either the flexion or the side bend split across both joints). The
 * waist does most of a real side bend and the upper back a good part of a
 * crunch, so the split draws the movement fairly.
 */

function obliqueCrunch(o: ObliqueSetup): FigureDef {
  const k = kneel(5, 12);
  // Turned up 30. The left arm's 136 degrees of elevation would take about
  // 40, but at 40 the blade's lower tip passes the side of the drawn torso
  // and shows in the Side view as a stray dash.
  const scapL: Scap = { x: 3, y: -2, z: 3, rot: 30 };
  // The right blade slides forward round the ribs and rises so the right hand
  // can reach across to the left side of the head. At y -2 the upper arm ran
  // 5.2 into the drawn chest's square front corner; at -6 it clears. Turned up
  // 20: with the blade slid out 5, at 30 its lower tip passed the side of the
  // drawn torso and showed in the Front view as a stray dash.
  const scapR: Scap = { x: 5, y: -6, z: 6, rot: 20 };
  const armL = armTo(shoulderAt(-1, scapL), o.hL, [-0.3, 0.2, 1]);
  // The right elbow sits in front of the chin, and the forearm runs back along
  // the left side of the jaw to the grip.
  const armR = armTo(shoulderAt(1, scapR), o.hR, [0.3, 0.1, 1]);
  const pose = (t: number): BodySpec => ({
    pos: [0, 0, 0],
    pelvis: { flex: o.lean },
    lumbar: { side: key(t, [[0, o.side[0]], [1, o.side[1]]]) },
    thoracic: { flex: key(t, [[0, o.thoracic[0]], [1, o.thoracic[1]]]) },
    scapR,
    scapL,
    armR,
    armL,
    ...k.legs,
  });
  const P: V3 = [-o.out, k.floorY - 205, k.knee[2] + o.fwd];
  const grip = (b: Body) => dHandle(b.j.handL, b.j.handR, P);
  return {
    // From the left, both hands, forearms and elbows drew in one knot round
    // the head, and the right arm crossed in front of the face. Side shows
    // the near arm only; Front shows both hands on the handle.
    views: [VIEW.front, { ...VIEW.side, hide: ['armR'] }],
    pose,
    equipment: (b) => {
      const h = grip(b);
      return [floor(k.floorY), pulley(P), cable(P, h.attach), ...h.prims];
    },
    check: {
      muscles: [
        { m: 'obliqueExt', side: 'R' },
        { m: 'obliqueInt', side: 'R' },
      ],
      custom: [{ name: 'sideWallR', len: sideWall(1) }],
      load: (b) => {
        const a = grip(b).attach;
        return [{ at: a, dir: sub(P, a) }];
      },
      // The side bend turns about the hip center, where the engine has no
      // joint to name, so it is taken about each hip joint, which bracket it.
      // The mid back mixes the side bend below it with the upper back's curl.
      lever: [
        { joint: 'mid', end: 'neck' },
        { joint: 'hipR', end: 'mid' },
        { joint: 'hipL', end: 'mid' },
      ],
      contacts: k.contacts,
    },
  };
}

/*
 * Side-on with the stack on the left, working the right side. The cable's
 * side-bend moment arm about the hip center (the mean of the two hip levers),
 * cm of torque per unit of force, start then finish:
 *
 *   out 100: 7 / 54   out 115: 13 / 56   out 125: 17 / 58
 *   out 145: 24 / 60   out 160: 29 / 62
 *
 * At out 125:
 *
 *   fwd -15: 19 / 56   fwd 15: 16 / 59   fwd 30: 13 / 60
 *   lean 15: 15 / 61   lean 35: 21 / 55
 *
 * So how far out the pulley is sets the cable's load at the stretch, and fore
 * and aft and the lean change it a little. Closer in, the cable runs along the
 * trunk at the start. Out 125 puts the pulley 113 from the left knee, about
 * one and a half steps, and fwd 0 puts it straight out to the side of the
 * knees.
 *
 * The trunk's weight matters as much as the cable. Tipped toward the stack at
 * the start, it bends the trunk farther that way, which the right side has to
 * hold: about 670 kg cm about the hip center for an 80 kg body (head, arms and
 * trunk above the waist at standard segment fractions). Bent the other way at
 * the finish, it helps the bend by about 530. With 20 kg on the stack the net
 * side-bend load on the right side is 1020 kg cm at the start, 1070 at a
 * quarter of the way and 630 at the finish; at 10 kg the start is the
 * heaviest point, and at 40 kg the middle is, with the start at about two
 * thirds of it.
 *
 * Lean 25 puts the hip-to-shoulder line 25 degrees forward of vertical at the
 * start, and the upper back's curl takes it to 49 at the finish. The side
 * bend starts at -20, which tips the hip-to-shoulder line 21 degrees toward
 * the stack; at -25 obliqueExtR shortens only 5.1 percent, just over the
 * check's 5 percent bar.
 *
 * The hands were searched against the grip, which runs square to the cable:
 * here it stays 60 to 111 degrees from the forearms through the rep, and the D
 * faces the Front view to within 49 degrees, so it shows past the hand dots.
 */
const OBLIQUE: ObliqueSetup = {
  out: 125,
  fwd: 0,
  lean: 25,
  side: [-20, 22],
  thoracic: [-10, 35],
  hL: [-14, -76, -5],
  hR: [-16, -70, -5],
};

export const group: Group = {
  figures: {
    crunch: cableCrunch(CRUNCH),
    obliqueCrunch: obliqueCrunch(OBLIQUE),
  },
  cues: {
    crunch: {
      reach: 'Ribs lifted away from your hips at the top, with your back slightly arched.',
      points: [
        ['Setup', 'Set the pulley at the top and clip a rope to it. Kneel facing it with your knees a little under one step away. Hold the rope ends beside your ears and keep your hands there for the whole set.'],
        ['Hips', 'Keep your thighs about upright and lean forward from the hips until your torso is about 40 degrees from upright. Hold your hips in that position for the whole set.'],
        ['Stretch', 'At the start of each rep, lift your ribs away from your hips and arch your back slightly. The abs are longest here. With a light weight the cable will not pull you into this position, so do it yourself.'],
        ['Crunch', 'Curl your spine down so your elbows travel toward the floor in front of your knees. Finish with your back rounded and your chin tucked.'],
        ['Avoid', 'Folding at the hips. The weight still moves, but the abs stay the same length.'],
      ],
    },
    obliqueCrunch: {
      reach: 'Torso tipped sideways toward the pulley at the start, with your chest up and the side of your waist away from the pulley long.',
      points: [
        ['Setup', 'Set the pulley at the top and clip a D handle to it. Kneel side-on with the pulley on your left, your left knee about one and a half steps from it. Hold the handle in both hands beside the left side of your head at ear level and keep it there. Lean forward about 25 degrees from the hips and hold that. This works your right side. Turn around for the left.'],
        ['Stretch', 'At the start of each rep, let your torso tip about 20 degrees sideways toward the pulley, with your chest up. The obliques on your right side are longest here.'],
        ['Crunch', 'Bend sideways and curl down so your elbows travel toward your right hip.'],
        ['Distance', 'Kneel the full one and a half steps out. Closer in, the stretch gets lighter.'],
        ['Avoid', 'Pulling with your arms. The handle moves, but the obliques do less of the work.'],
      ],
    },
  },
  exercises: {
    'cable-crunch': 'crunch',
    'cable-oblique-crunch': 'obliqueCrunch',
  },
};
