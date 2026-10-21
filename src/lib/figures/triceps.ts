/**
 * Cable triceps work with the upper arm held still: the rope pushdown facing a
 * high pulley, and the one-arm cross body extension with the pulley on the
 * left at shoulder height.
 *
 * The triceps straighten the elbow, so all three heads are longest with the
 * elbow fully bent, and that is t = 0 in both. The long head also crosses the
 * shoulder, so where the upper arm sits sets how long it can get: hanging at
 * the side for the pushdown, raised out to the side for the cross body
 * extension. Only the forearms move.
 */
import type { Body } from '../figure3d/body';
import type { FigureDef, ViewDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, dot, mul, norm, rad, sub } from '../figure3d/math';
import { cable, floor, pulley, rail, rope } from '../figure3d/equipment';
import type { Prim } from '../figure3d/scene';
import { perpTo } from '../figure3d/scene';
import type { Group } from './kit';
import { DIM, VIEW, dirHE, key, mx } from './kit';

const feetOn = (floorY: number) => (b: Body) => [
  { name: 'heelR on floor', gap: b.j.heelR[1] - floorY },
  { name: 'toeR on floor', gap: b.j.toeR[1] - floorY },
  { name: 'heelL on floor', gap: b.j.heelL[1] - floorY },
  { name: 'toeL on floor', gap: b.j.toeL[1] - floorY },
];

const footAt = (floorY: number, x: number, ankleZ: number) => ({
  foot: { heel: [x, floorY, ankleZ - DIM.heel] as V3, dir: [0, 0, 1] as V3 },
  pole: [0, 0, 1] as V3,
});

/* ---------- pushdown ---------- */

/*
 * Hips 92 above the floor with the ankles 6 in front of them: soft knees,
 * bent 15, under a hinge that sends the hips back. Feet 12 either side of the
 * midline, about hip width.
 */
const PUSH_FLOOR = 92;
const PUSH_ANKLE_Z = 6;

/*
 * Hip hinge, degrees. The upper back stays flat on it, and the neck takes back
 * 60 percent of it so the eyes look ahead.
 */
const PUSH_LEAN = 15;

/*
 * High pulley 205 off the floor, 50 in front of the hip joints: two thirds of
 * a 75 step, so a little over half a step, and 26 ahead of the toes. How close
 * the person stands sets how the cable crosses the forearm at the top. Share
 * of the cable's full leverage on the elbow at the stretch and at lockout, and
 * the closest the cable comes to the head and to the torso during the rep (at
 * lockout unless marked):
 *
 *   pulley 50 in front of the hips: 43 / 17, head 6.9, torso 2.7
 *          60: 32 / 19, head 12.6 at the stretch, torso 3.4
 *          70: 23 / 22, head 15.6 at the stretch, torso 4.0
 *          80: 14 / 24, head 18.3 at the stretch, torso 4.8
 *
 * At 50 the torso's closest point is the front of the hips beside the rope's
 * knot; the chest is 3.0 clear. The first version, with the elbows 20 forward
 * and the pulley 42.5 out, had the cable 1.7 from the chest at lockout, drawn
 * on its corner in the side view.
 *
 * The lean does the same thing from the other end. At this pulley distance:
 *
 *   upright: 5 / 25   lean 5: 18 / 22   10: 31 / 20   15: 43 / 17
 *   20: the cable runs through the chest at lockout
 *
 * Leaning tips the folded forearms forward, away from the line of the cable,
 * so it pulls across them at the top. Moving the pulley in until the cable
 * just clears the face and chest at lockout gives 47 or 48 at the stretch at
 * every lean from 0 to 30, so the body is the real limit, and the lean sets
 * where that spot is: 15 in front of the hips upright, which is behind the
 * toes where no stack can be, 35 at lean 10, 45 at 15, 55 at 20, 80 at 30.
 * The figure stands 5 behind the spot for its lean.
 */
const PUSH_PULLEY: V3 = [0, PUSH_FLOOR - 205, 50];

/*
 * Upper arm 15 forward of the torso's down axis, which under the 15 degree
 * hinge hangs it straight down in the room, with the elbow 9 in front of the
 * shoulder joint along the torso's forward axis, inside the depth of the
 * torso. Its elbow sits 25 from the midline, about 8 degrees out from the
 * side: the box torso's corners swallow an arm hanging any closer.
 *
 * At 20 the elbow sat at the front corner of the ribcage and read as held in
 * front of the body. At 10 the straight arms at lockout put the hands beside
 * the hips and the rope's knot against the front of the pelvis with the pulley
 * 50 to 60 out (it clears by 1.4 at 80 and 3.3 at 120), and at this lean the
 * cable ran through the torso until the pulley was 57.5 out.
 *
 * The lead asked whether the elbows should drift forward and up at the top to
 * lengthen the long head. Moving them forward at t = 0 only, with lockout
 * unchanged (stretch share, long head proxy at the stretch; it is 32.2 at
 * lockout in every case):
 *
 *   held at 15: 43, 37.0   20: 36, 37.3   25: 29, 37.7   30: 22, 38.1
 *   40: 6, 38.8
 *
 * Ten degrees of drift adds 0.7 to the long head's 4.8 of travel and turns the
 * forearm toward the cable's line, cutting the load at the stretch by about a
 * third (by a third as well with the rope's strand tension counted, see the
 * load below). The figure keeps the elbows still and the cue says so.
 */
const PUSH_ARM_FWD = 15;
const PUSH_ELBOW_X = 25;

/*
 * Elbow bent 140 at the top, hands 15 from the midline, 10 below the shoulder
 * joints and 7 in front of the chest. At lockout 3, hands 28 out where the
 * rope ends spread past the thighs; that keeps the forearm in line with the
 * upper arm, so the last of the rep is elbow motion. At the top, hands 12 out
 * put the forearms into the chest; 13 out gives 40 at the stretch and 17 out
 * 43. Bent 145 with the hands 15 out, the forearms go into the chest, and the
 * check stops at 150; 135 gives 52.
 */
const PUSH_ELBOW: [number, number] = [140, 3];
const PUSH_HAND_X: [number, number] = [15, 28];

/*
 * Front, turned 50 degrees toward the person's right and kept level so the
 * floor shows. Straight on, the cable ran down the midline through the head
 * and the rope's V sat on the torso like collarbones or the bottom of the
 * pelvis. Turned 35, the cable still crossed the edge of the head at mid-rep.
 * At 45 it passed beside it, but at lockout it drew on the head's outline, 1.9
 * from it on screen. At 50 the gap is 2.9 at lockout, 4.6 at the stretch and
 * 10 at mid-rep.
 */
const PUSH_FRONT_TURN = 50;
const PUSH_FRONT: ViewDef = {
  label: 'Front',
  cam: {
    dir: [Math.sin(rad(PUSH_FRONT_TURN)), 0, Math.cos(rad(PUSH_FRONT_TURN))],
    up: [0, -1, 0],
    right: [Math.cos(rad(PUSH_FRONT_TURN)), 0, -Math.sin(rad(PUSH_FRONT_TURN))],
  },
};

function pushdown(): FigureDef {
  const shoulderX = DIM.shoulder[0];
  const ux = (PUSH_ELBOW_X - shoulderX) / DIM.upperArm;
  const k = Math.sqrt(1 - ux * ux);
  const th = rad(PUSH_ARM_FWD);
  const upper: V3 = [ux, k * Math.cos(th), k * Math.sin(th)];
  // Forearm with the hand at handX and the elbow bent e: the sideways part is
  // set by the hand's distance from the midline, and the rest turns forward
  // and up from the upper arm until the angle between them is e.
  const fore = (t: number): V3 => {
    const hx = key(t, [[0, PUSH_HAND_X[0]], [1, PUSH_HAND_X[1]]]);
    const e = rad(key(t, [[0, PUSH_ELBOW[0]], [1, PUSH_ELBOW[1]]]));
    const c = (hx - PUSH_ELBOW_X) / DIM.forearm;
    const m = Math.sqrt(1 - c * c);
    const psi = th + Math.acos(Math.max(-1, Math.min(1, (Math.cos(e) - ux * c) / (k * m))));
    return [c, m * Math.cos(psi), m * Math.sin(psi)];
  };
  const grip = (b: Body) => rope(b.j.handR, b.j.handL, PUSH_PULLEY);
  return {
    // Front: elbow width, the forearms' arc, the hands in front of the chest
    // and spreading at the bottom, the rope. Side: the hinge, the upper arm
    // hanging straight down, the forearm's arc past level, and the cable
    // running just in front of the face and chest.
    views: [PUSH_FRONT, VIEW.side],
    pose: (t) => {
      const f = fore(t);
      return {
        pos: [0, 0, 0],
        pelvis: { flex: PUSH_LEAN },
        neck: { flex: -PUSH_LEAN * 0.6 },
        armR: { dirs: [upper, f] },
        armL: { dirs: [mx(upper), mx(f)] },
        legR: footAt(PUSH_FLOOR, 12, PUSH_ANKLE_Z),
        legL: footAt(PUSH_FLOOR, -12, PUSH_ANKLE_Z),
      };
    },
    equipment: (b) => {
      const g = grip(b);
      return [floor(PUSH_FLOOR), pulley(PUSH_PULLEY), cable(PUSH_PULLEY, g.attach), ...g.prims];
    },
    check: {
      muscles: [
        { m: 'tricepsLong', side: 'R' },
        { m: 'tricepsShort', side: 'R' },
        { m: 'tricepsLong', side: 'L' },
        { m: 'tricepsShort', side: 'L' },
      ],
      // Each strand of the rope pulls its hand toward the knot. The check
      // takes each strand's direction at a unit pull, and its moment arms
      // peak at t = 0.33 (27.4), forearms 3 above level, and are 50 percent of
      // that at the stretch and 20 at lockout. The cue gives these figures.
      //
      // The real pull on each hand is the stack's over twice the cosine of
      // the strand's angle to the cable: 0.58 of it at the top, hands 30
      // apart, rising to 1.39 at lockout, hands 56 apart, where most of it
      // pulls the hands together. Counting that, and taking the torque about
      // a fixed elbow hinge (square to the upper arm, nearest the room's
      // left-right), the load peaks at t = 0.4 with the forearms 6 below
      // level, and is 42 percent of the peak at the stretch and 25 at
      // lockout. The lockout figure depends on that choice of hinge: the
      // true flexion axis, square to both arm segments, sits 10 to 18 degrees
      // off it until t = 0.9, then swings wide (25 at t = 0.95) and is
      // undefined with the arm straight. So the cue keeps to the check.
      load: (b) => {
        const g = grip(b);
        return (['handR', 'handL'] as const).map((h) => ({ at: b.j[h], dir: sub(g.attach, b.j[h]) }));
      },
      lever: [
        { joint: 'elbowR', end: 'handR' },
        { joint: 'elbowL', end: 'handL' },
      ],
      contacts: feetOn(PUSH_FLOOR),
    },
  };
}

/* ---------- cross body extension ---------- */

const CROSS_FLOOR = 92;

/*
 * Upper arm out to the side, 20 degrees forward of straight out and 5 below
 * level, held there. The forearm folds forward from it, square to the upper
 * arm, in a plane about 5 degrees from level; the cable runs 4 to 7 degrees
 * out of that plane. The hand at the stretch is in front of the right
 * shoulder, and the straight arm at lockout points out to the side, 20
 * degrees forward.
 *
 * Pointing the upper arm farther forward lines the folded forearm up with a
 * cable that has to clear the chest on its way to the left, and a straight arm
 * can only finish out to the side if the upper arm points there. Stretch and
 * lockout share with the pulley as far back as the cable still clears the
 * chest and the forearm (its distance in front of the hips in brackets), and
 * the long head proxy at the stretch:
 *
 *   straight out: 50 / 27 (40), 38.9   10 forward: 50 / 27 (22), 39.4
 *   20 forward: 48 / 29 (8), 39.9      30 forward: 39 / 35 (1), 40.4
 *   45 forward: 15 / 49 (0), 40.9
 *
 * At 45 forward the folded forearm lies in front of the chest, and with the
 * pulley where this figure has it, 15 in front of the hips, the stretch share
 * is 0. 20 gives up a little load for a little long head length. The hand
 * cannot reach the opposite shoulder from here: with the elbow out at the side
 * the forearm is too short, and only an upper arm pointing across the chest
 * puts it there.
 */
const CROSS_HEADING = 20;
const CROSS_ELEV = -5;

/*
 * Arm raised to the side: the blade rotates up 25 degrees and rides up 3.
 * The left arm hangs, so its blade stays put.
 */
const CROSS_SCAP = { x: 1, y: -3, z: 1, rot: 25 };

/*
 * Elbow bent 140 at the stretch. Each 5 degrees less bend lets the cable cross
 * the forearm more squarely at the start (stretch share, long head proxy):
 *
 *   130: 60, 39.5   135: 52, 39.7   140: 42, 39.9   145: 31, 40.1
 *
 * 140 matches the pushdown and is about as far as the forearm folds against
 * the upper arm; the check stops at 150.
 */
const CROSS_ELBOW: [number, number] = [140, 3];

/*
 * Pulley at elbow height, 145 off the floor, 80 to the left of the midline
 * and 15 in front of the hip joints, in line with the front of the chest:
 * 81 from the hips, about one step of 75. Stretch and lockout share against
 * how far forward of the hips it sits:
 *
 *   15: 42 / 33   22: 36 / 37   32: 26 / 43   42: 17 / 48   52: 8 / 53
 *
 * At 12 the cable cleared the chest's front corner by 2.0 at lockout and drew
 * on it in the top view; at 15 it clears by 3.7. At 7 or closer it runs into
 * the chest at lockout. How far to the side matters little: 50 to the left
 * 45 / 32, 80: 42 / 33, 110: 40 / 34, 140: 39 / 35.
 */
const CROSS_PULLEY: V3 = [-80, CROSS_FLOOR - 145, 15];

/* Feet 20 either side of the midline, about shoulder width, for a wider base against the sideways pull. */
const CROSS_FOOT_X = 20;

/*
 * Front, raised 30 degrees. From level, the forearm swings in a plane through
 * the camera, so the folded arm drew as a straight one, the forearm pointing
 * ahead drew as a dot, and the cable ran along the shoulder line. From above,
 * the fold, the forearm pointing forward and the cable crossing in front of
 * the chest below the shoulders all show. The engine draws the floor only for
 * level cameras, so a line at the toe tips stands in for it. It spans the room
 * x that lands at 3 and 97 percent of the box (midline at 118.4 box units,
 * scale 1.35), where the engine draws its floor, and is left out of the fit:
 * counted, it widened the view and the scale fell to 1.317.
 */
const CROSS_FRONT_RAISE = 30;
const CROSS_FRONT: ViewDef = {
  label: 'Front',
  cam: {
    dir: [0, -Math.sin(rad(CROSS_FRONT_RAISE)), Math.cos(rad(CROSS_FRONT_RAISE))],
    up: [0, -Math.cos(rad(CROSS_FRONT_RAISE)), -Math.sin(rad(CROSS_FRONT_RAISE))],
    right: [1, 0, 0],
  },
};

function crossBody(): FigureDef {
  const u = dirHE(-CROSS_HEADING, CROSS_ELEV);
  // Square to the upper arm, toward the front: the way the forearm folds.
  const w = norm(sub([0, 0, 1], mul(u, dot([0, 0, 1], u))));
  const fore = (t: number): V3 => {
    const e = rad(key(t, [[0, CROSS_ELBOW[0]], [1, CROSS_ELBOW[1]]]));
    return add(mul(u, Math.cos(e)), mul(w, Math.sin(e)));
  };
  // Thumb up: the grip of the D stands upright, square to the cable, and the
  // D's sides meet 9 out along the cable, where it clips on. handle() in
  // equipment.ts takes the grip from the plane of the cable and the forearm,
  // nearest the room's left-right; this cable runs left-right, so it laid the
  // grip along the cable and the D drew as a line. The D is drawn here.
  const grip = (b: Body) => {
    const H = b.j.handR;
    const c = norm(sub(CROSS_PULLEY, H));
    const g = perpTo(c, [0, -1, 0]);
    const clip = add(H, mul(c, 9));
    const D: Prim = { k: 'line', part: 'eq.handle', pts: [sub(H, mul(g, 6)), add(H, mul(g, 6)), clip], closed: true, w: 2, tone: 'equip' };
    return { prims: [D], attach: clip };
  };
  return {
    // Front: the cable across the chest from the left, the arm level at
    // shoulder height, the fold at the start and the hand moving out to the
    // side. Top: the forearm's sweep and the angle the cable makes with it.
    views: [CROSS_FRONT, { ...VIEW.top, hide: ['leg', 'armL', 'eq.floor'] }],
    pose: (t) => ({
      pos: [0, 0, 0],
      scapR: CROSS_SCAP,
      scapL: {},
      armR: { dirs: [u, fore(t)] },
      // Left arm hanging relaxed at the side.
      armL: { dirs: [norm([-0.12, 1, 0.03]), norm([-0.08, 1, 0.1])] },
      legR: footAt(CROSS_FLOOR, CROSS_FOOT_X, 3),
      legL: footAt(CROSS_FLOOR, -CROSS_FOOT_X, 3),
    }),
    equipment: (b) => {
      const g = grip(b);
      return [
        rail([[-82, CROSS_FLOOR, 21], [85, CROSS_FLOOR, 21]], { part: 'eq.floor', fit: false }),
        pulley(CROSS_PULLEY),
        cable(CROSS_PULLEY, g.attach),
        ...g.prims,
      ];
    },
    check: {
      muscles: [
        { m: 'tricepsLong', side: 'R' },
        { m: 'tricepsShort', side: 'R' },
      ],
      load: (b) => [{ at: b.j.handR, dir: sub(CROSS_PULLEY, grip(b).attach) }],
      lever: [{ joint: 'elbowR', end: 'handR' }],
      contacts: feetOn(CROSS_FLOOR),
    },
  };
}

export const group: Group = {
  figures: {
    pushdown: pushdown(),
    crossBodyExt: crossBody(),
  },
  cues: {
    pushdown: {
      reach: 'Forearms folded up past level at the top, with the hands in front of your upper chest and the elbows at your sides.',
      points: [
        'Set the pulley at the top and clip a rope to it. Hold one end of the rope in each hand. Stand facing the pulley with your hips a little over half a step from it, your feet about hip width apart and your knees slightly bent. Lean forward about 15 degrees from the hips with your back flat, so your upper arms hang straight down. At the finish the cable runs just in front of your face and chest.',
        'The triceps straightens the elbow, so all three heads are longest with the elbow fully bent. Bring the hands up until the forearms are well past level and the elbows are bent about as far as they go. Stopping with the forearms level leaves out the part of the rep where the triceps is longest.',
        'The long head also starts on the shoulder blade and crosses the shoulder, so it is longer with the arm raised than with the arm at your side. Letting the elbows drift forward about 10 degrees at the stretch lengthens it a little. It also turns the forearms toward the line of the cable, which cuts the load at the stretch by about a third. Keep the elbows at your sides through the rep. At the finish, straighten the elbows fully and pull the rope ends apart, out to the sides of your thighs.',
        'The cable resists the movement most with your forearms about level. At the stretch it resists about half as much, and at the finish about a fifth as much. Standing close and leaning forward let the cable pull across your forearms at the stretch. If you stand upright in the same spot, the cable runs almost along the forearms at the stretch and barely loads them. Standing farther back also makes the stretch lighter, and the finish a little heavier.',
      ],
    },
    crossBodyExt: {
      reach: 'Elbow bent about as far as it goes at the start, with the hand in front of your right shoulder and the upper arm out to the side at shoulder height.',
      points: [
        'Set the pulley at about shoulder height and clip a D handle to it. Hold the handle in your right hand, thumb up. Stand upright, side-on to the pulley with it on your left, your hips about one step from it and your feet about shoulder width apart. The pulley is in line with the front of your chest, so the cable runs across it. To work the left arm, do everything mirrored.',
        'The triceps straightens the elbow, so all three heads are longest with the elbow fully bent. The long head also starts on the shoulder blade and crosses the shoulder, so it is longer with the arm raised than with the arm at your side in a pushdown.',
        'Raise the upper arm out to the side, level with your shoulder and angled about 20 degrees forward, and hold it there. The forearm then swings in about the same level plane as the cable. At the finish the elbow is straight and the whole arm points out to the side, about 20 degrees forward.',
        'The cable resists the movement most in the middle of the rep, with the forearm pointing about straight ahead. At the stretch it resists a little under half as much, and at the finish about a third as much. Standing farther back, so the pulley is farther ahead of you, makes the stretch lighter and the finish heavier.',
        'With the upper arm angled about 45 degrees forward, the folded forearm lies in front of your chest and the long head is a little longer at the stretch. The cable then runs almost along the forearm. With the pulley in line with the front of your chest the stretch carries almost no load, and with the pulley in line with your hips it carries about a sixth as much as at its peak.',
      ],
    },
  },
  exercises: {
    'cable-tricep-pushdown': 'pushdown',
    'cable-single-arm-underhand-tricep-pushdown': 'crossBodyExt',
  },
};
