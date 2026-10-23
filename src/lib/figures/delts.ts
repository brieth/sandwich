/**
 * Delt work on a cable, one arm at a time: the behind the back lateral raise
 * and the single arm rear delt fly. Both are drawn with the right arm and a D
 * handle, standing upright with the pulley on the person's left, so the cable
 * comes across the body to the working hand.
 *
 * The hand is placed at a fixed distance from the shoulder, which holds the
 * elbow angle, and the elbow is bent toward a pole. The shoulder rides on the
 * blade, so each frame solves the body once without the arm to find it. The
 * torso, legs and left arm hold still.
 */
import type { Body, BodySpec, Limb } from '../figure3d/body';
import { solveBody } from '../figure3d/body';
import type { FigureDef, ViewDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, angleBetween, lerpN, mul, norm, sub } from '../figure3d/math';
import { cable, floor, handle, pulley } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, dirHE, key, keyDir } from './kit';

/* Hip joints to floor. 93 with the legs locked; 92.5 gives soft knees, about 12 degrees. */
const FLOOR = 92.5;

/* Feet a little wider than the hips, flat, toes forward, ankles under the hips. */
const foot = (x: number): Limb => ({
  foot: { heel: [x, FLOOR, -DIM.heel], dir: [0, 0, 1] },
  pole: [0, 0, 1],
});
const LEGS = { legR: foot(12), legL: foot(-12) };

/* Left arm hanging relaxed, a little away from the side, with a soft elbow. */
const ARM_L: Limb = { dirs: [norm([-0.15, 1, 0]), norm([-0.1, 1, 0.15])] };
const SCAP_L = { x: 0, y: 0, z: 0, rot: 0 };

/** Shoulder to hand with the elbow bent this many degrees. */
const reach = (elbow: number) =>
  Math.sqrt(DIM.upperArm ** 2 + DIM.forearm ** 2 + 2 * DIM.upperArm * DIM.forearm * Math.cos((elbow * Math.PI) / 180));

/**
 * The right hand placed reach from the shoulder along dir, with the elbow bent
 * toward pole, both in the upper torso frame.
 */
function rightArm(base: Omit<BodySpec, 'armR'>, dir: V3, reachCm: number, pole: V3): BodySpec {
  const pre = solveBody({ ...base, armR: { dirs: [[0, 1, 0], [0, 1, 0]] } });
  const target = add(pre.j.shoulderR, mul(pre.dirOf('upper', norm(dir)), reachCm));
  return { ...base, armR: { ik: target, pole: pre.dirOf('upper', pole) } };
}

const feetDown = (b: Body) => [
  { name: 'heelR on floor', gap: Math.abs(b.j.heelR[1] - FLOOR) },
  { name: 'toeR on floor', gap: Math.abs(b.j.toeR[1] - FLOOR) },
  { name: 'heelL on floor', gap: Math.abs(b.j.heelL[1] - FLOOR) },
  { name: 'toeL on floor', gap: Math.abs(b.j.toeL[1] - FLOOR) },
];

/** Pulley, cable and D handle in the right hand, and the cable's pull on the hand. */
function oneArmCable(P: V3) {
  return {
    equipment: (b: Body) => {
      const hd = handle(b.j.handR, P, sub(b.j.handR, b.j.elbowR));
      return [floor(FLOOR), pulley(P), cable(P, hd.attach), ...hd.prims];
    },
    load: (b: Body) => [{ at: b.j.handR, dir: sub(P, b.j.handR) }],
  };
}

/*
 * Side view from the right, so the working arm is on the near side. From
 * this side the left shoulder is behind the torso, so its dot is left out:
 * with the blades set apart it sat 5 behind the teal one in the rear delt fly
 * and as a grey edge above it at the bottom of the lateral raise.
 */
const SIDE: ViewDef = { ...VIEW.sideRight, hide: ['armL.shoulder'] };

/*
 * From above, the toes showed as two short ticks past the front of the torso,
 * as in the other standing figures, and the hanging left arm drew as three
 * grey dots beside the torso's left edge. Both are left out.
 */
const TOP: ViewDef = { ...VIEW.top, hide: ['leg', 'armL'] };

/**
 * Upper arm direction against a direction in the upper torso frame, turned
 * with the blade's upward rotation, in radians: the angle the arm has to
 * travel at the joint itself to point that way.
 */
const armFrom = (b: Body, d: V3) => {
  const a = ((b.spec.scapR?.rot ?? 0) * Math.PI) / 180;
  // Upward rotation tips the socket up, outward of the blade, about the
  // torso's front to back axis.
  const turned: V3 = [d[0] * Math.cos(a) + d[1] * Math.sin(a), d[1] * Math.cos(a) - d[0] * Math.sin(a), d[2]];
  return (angleBetween(sub(b.j.elbowR, b.j.shoulderR), b.dirOf('upper', turned)) * Math.PI) / 180;
};

/* ---------- behind the back lateral raise ---------- */

/*
 * Low pulley, 15 off the floor, 120 to the person's left and 90 behind the
 * hips: 150 from the hips, about two steps. The cable runs behind the hips to
 * the right hand. Share of the cable's full leverage on the arm at the bottom
 * / at its most / at the top, and the closest the cable comes to the torso,
 * against where the pulley is, with the start drawn here:
 *
 *              50 behind                  90 behind
 *   80 out:    29 / 100 / 73, 3.9         25 / 98 / 73, 8.5
 *   120 out:   48 / 100 / 65, 0.2         44 / 99 / 67, 7.6
 *   160 out:   59 / 100 / 59, through it  55 / 99 / 61, 5.5
 *   200 out:   66 / 100 / 54, through it  63 / 100 / 56, 2.7
 *
 * Closer in, the cable pulls more along the arm and the bottom carries less,
 * 25 to 29 at 80 out. A dumbbell pulls straight along a hanging arm and puts
 * no load on the bottom. Farther out loads the bottom more and the top less.
 * At 50 behind the cable grazes the back of the waist at the top of the rep
 * from 120 out and runs through it from 160, so the pulley sits 90 behind.
 * Farther out would load the bottom more, but keeping the pulley in frame
 * shrinks the drawing from scale 1.06 to 0.89 at 160 out and 0.76 at 200.
 * Leaning forward 10 or 20 degrees from the hips lowered the bottom share to
 * 39 or 35, so the person stands upright.
 */
const LR_PULLEY: V3 = [-120, FLOOR - 15, -90];

/*
 * Elbow bent 30 degrees. With the hand in the same direction from the
 * shoulder, 25 or 20 degrees put the elbow end of the forearm 2.9 or 3.8 into
 * the lower back at the bottom, past the 2.5 the check allows; at 30 it is 2.1
 * in.
 */
const LR_ELBOW = 30;
/*
 * Hand direction from the shoulder in the upper torso frame: down, back and
 * across at the bottom, which puts the hand behind the left side of the hips;
 * out to the side, 10 below level, at the top.
 */
const LR_HAND0 = norm([-0.45, 0.87, -0.3]);
const LR_HAND1 = dirHE(-5, -10);
/* The elbow points back and out at the bottom, which carries the upper arm round the back of the ribs, and up at the top. */
const LR_POLE0: V3 = [1, 0, -0.7];
const LR_POLE1: V3 = [0, -1, -0.4];
/* The cable draws the blade down and out at the bottom. It turns upward with the arm and finishes level, without a shrug. */
const LR_SCAP0 = { x: 2, y: 2, z: 0, rot: 0 };
const LR_SCAP1 = { x: 0, y: 0, z: 0, rot: 25 };

/*
 * Side delt length, wrapped over the top of the humeral head. The engine's
 * sideDelt runs straight from the top of the joint to the upper arm, with its
 * origin level with the joint front to back, so it reads the arm reaching
 * back as shortening: the start drawn here reads 16.07 on it, and the same
 * body with the arm hanging straight down 16.12. This takes 8 of free fiber
 * plus a 4.5 radius wrap times the angle of the upper arm from straight out
 * of the socket, with straight out turned by the blade's upward rotation.
 * With the blade unturned, as at the bottom, swinging a hanging arm forward
 * or back leaves it unchanged: 15.07 at 30 forward, straight down and 30
 * back. Bringing the arm in past the side of the body lengthens it. It reads
 * 16.15 at the start against 15.07 with the arm hanging straight down. The
 * engine's proxy stays in the check for the shortening on the way up.
 */
const sideDeltWrapped = (b: Body) => 8 + 4.5 * armFrom(b, [1, 0, 0]);

function lateralRaise(): FigureDef {
  const R = reach(LR_ELBOW);
  const { equipment, load } = oneArmCable(LR_PULLEY);
  return {
    // The back view shows the hand behind the hips and the cable to it; the
    // front view hides both behind the body, so it is left out.
    views: [VIEW.back, SIDE, TOP],
    pose: (t) => {
      const base: Omit<BodySpec, 'armR'> = {
        pos: [0, 0, 0],
        scapR: key(t, [
          [0, LR_SCAP0],
          [1, LR_SCAP1],
        ]),
        scapL: SCAP_L,
        armL: ARM_L,
        ...LEGS,
      };
      const dir = keyDir(t, [
        [0, LR_HAND0],
        [1, LR_HAND1],
      ]);
      const pole = keyDir(t, [
        [0, LR_POLE0],
        [1, LR_POLE1],
      ]);
      return rightArm(base, dir, R, pole);
    },
    equipment,
    check: {
      muscles: [{ m: 'sideDelt', side: 'R' }],
      custom: [{ name: 'sideDeltWrapR', len: sideDeltWrapped }],
      load,
      lever: [{ joint: 'shoulderR', end: 'handR' }],
      contacts: feetDown,
      // At the bottom the upper arm passes the back right corner of the box
      // torso, 5.9 into it at (15.4, -26.8, -12.4) at t = 0, and 3.9 at
      // t = 0.05. A real back is rounded there: against an elliptical section
      // through the same rings the arm is 0.2 into that point, and 2.5 in at
      // most, at the side of the ribs below the armpit, where the arm rests
      // on the body.
      allow: ['armR.upper~torso'],
    },
  };
}

/* ---------- single arm rear delt fly ---------- */

/*
 * Pulley at shoulder height, 145 off the floor, the cross body extension's
 * height, so the two can share a pulley. 45 to the person's left and 50 in
 * front of the hips: 67 from the hips, a little under one step. Share of full
 * leverage at the start / at its most / at the finish, and the cable's
 * closest pass to the torso box and to the head over the rep:
 *
 *   45 out, 50 forward, 145 up:  65 / 94 / 20,  0.4, 27.0
 *   30 out:                      49 / 92 / 25,  3.0, 28.5
 *   60 out:                      69 / 96 / 15,  through the torso at the finish
 *   45 forward:                  74 / 93 / 17,  through the torso at the finish
 *   55 forward:                  55 / 96 / 22,  1.9, 28.5
 *   65 forward:                  31 / 96 / 28,  4.6, 31.6
 *   160 up:                      83 / 98 / 21,  touching, 19.8
 *   193 up, the old setting:     66 / 91 / 24,  3.3, 9.1
 *
 * The closest pass is at the finish, at the box's front outer corner 12 below
 * the right shoulder, where a real chest is rounded, so the cable clears it by
 * more than the box shows. Standing closer or with the pulley farther out to
 * the side runs the cable into the chest. Farther forward clears it more but
 * lightens the start, and at 193 up the start was the same load with the
 * cable passing 9 in front of the face.
 */
const RD_PULLEY: V3 = [-45, FLOOR - 145, 50];
const RD_ELBOW = 20;

/*
 * Hand direction from the shoulder, as heading and elevation in the upper
 * torso frame. The heading and elevation are interpolated separately so the
 * arm sweeps round and down; a great circle between the two ends went up over
 * the shoulder. The start reaches across the front of the body with the upper
 * arm 12 degrees above level and the hand at chin height in front of the left
 * shoulder. The finish has the upper arm 25 degrees behind the line of the
 * shoulders and 17 below level, 20 degrees short of REAR_SHORT as the proxy
 * below counts it. A start 35 degrees up put the hand about 4 above the top
 * of the head, and the Back view drew the arm across the head.
 */
const RD_START: [number, number] = [-130, 10];
const RD_FINISH: [number, number] = [15, -20];

/*
 * Blade forward and a little up at the start, back at the finish. Upward
 * rotation is 28 with the upper arm 12 above level and 18 with it 17 below,
 * in step with the lateral raise's 25 with the arm level. The blade is drawn
 * flat on the back and cannot wrap round the ribs as a protracted blade does,
 * so it slides 3 out at the start: at 5 out, the bottom of the drawn blade
 * showed in the Side view, just inside the back edge of the torso, from 11
 * of rotation. At 3 out it stays hidden up to 30.
 */
const RD_SCAP0 = { x: 3, y: -1, z: 5, rot: 28 };
const RD_SCAP1 = { x: -2, y: 0, z: -2, rot: 18 };

/** Upper arm direction, in the upper torso frame, at which the rear delt is shortest: out, back and a little down, the end of a reverse fly. */
const REAR_SHORT = dirHE(45, -20);

/*
 * Rear delt length, wrapped. The engine's rearDelt is a straight line from a
 * point behind the joint to the upper arm, which reads longest with the arm
 * pointing forward and shortest with it across the chest; on this rep it reads
 * 16.4 at the start, 18.9 halfway and 15.0 at the finish. Across the chest the
 * real fibers wrap round the back and outside of the humeral head, so this
 * takes 8 of free fiber plus a 4.5 radius wrap times the angle of the upper
 * arm from where the muscle is shortest, counted at the joint.
 *
 * REAR_SHORT is set by hand from the anatomy, not measured: the rear delt
 * draws the arm back and out, so it is shortest with the arm out to the side
 * and behind the line of the shoulders, as at the end of a reverse fly. The
 * proxy scores a direction by its angle from REAR_SHORT alone, so a start
 * overhead and a start at chest height the same angle away read the same. The
 * start is set from the reach across the body; it sits 158 degrees from
 * REAR_SHORT. The blade sliding forward also turns the socket toward the
 * front, which this does not count.
 */
const rearDeltWrapped = (b: Body) => 8 + 4.5 * armFrom(b, REAR_SHORT);

function rearDeltFly(): FigureDef {
  const R = reach(RD_ELBOW);
  const { equipment, load } = oneArmCable(RD_PULLEY);
  return {
    // No Front view: the person's right is on screen right in Front and Back
    // alike, so the two drew the same outline, and Back also shows the blade.
    views: [VIEW.back, SIDE, TOP],
    pose: (t) => {
      const base: Omit<BodySpec, 'armR'> = {
        pos: [0, 0, 0],
        scapR: key(t, [
          [0, RD_SCAP0],
          [1, RD_SCAP1],
        ]),
        scapL: SCAP_L,
        armL: ARM_L,
        ...LEGS,
      };
      const h = lerpN(RD_START[0], RD_FINISH[0], t);
      const e = lerpN(RD_START[1], RD_FINISH[1], t);
      // The elbow points the way the arm travels, back and a little up, so
      // the hand trails it.
      return rightArm(base, dirHE(h, e), R, dirHE(h + 90, 15));
    },
    equipment,
    check: {
      muscles: [{ m: 'midTrap', side: 'R' }],
      custom: [{ name: 'rearDeltWrapR', len: rearDeltWrapped }],
      load,
      lever: [{ joint: 'shoulderR', end: 'handR' }],
      contacts: feetDown,
      // Reaching across, the upper arm crosses the top front corner of the box
      // chest, 6.0 into it at (18.1, -56.1, 13.4) at the start, and past the
      // check's 2.5 until t = 0.2. A real chest and shoulder are round there:
      // against an elliptical section through the same rings the arm clears
      // that point by 0.3, and is 0.4 in at most, at the start.
      allow: ['armR.upper~torso'],
    },
  };
}

export const group: Group = {
  figures: {
    lateralRaise: lateralRaise(),
    rearDelt: rearDeltFly(),
  },
  cues: {
    lateralRaise: {
      reach: 'Hand behind the left side of your hips at the bottom, with the arm angled down and across behind your back.',
      points: [
        ['Setup', 'Set the pulley at the bottom and hold a D handle in your right hand. Stand upright with the pulley to your left and behind you, your hips about two steps from it, so the cable runs behind your hips. For the left arm, do everything mirrored.'],
        ['Stretch', 'Let the cable pull your hand behind your hips toward your left side. The side delt is longest with the arm down and across the body, and behind your back it can cross past the middle.'],
        ['Raise', 'Raise your arm out to the side until your elbow is level with your shoulder. Keep the elbow bent about 30 degrees the whole way.'],
        ['Distance', 'Stay about two steps from the pulley. Closer in, the stretch gets lighter.'],
        ['Avoid', 'Shrugging as your arm rises. Let your shoulder blade turn upward without lifting. Moving your torso.'],
      ],
    },
    rearDelt: {
      reach: 'Hand across in front of your left shoulder at the start, at about chin height.',
      points: [
        ['Setup', 'Set the pulley at about shoulder height and hold a D handle in your right hand. Stand upright with the pulley in front of you and to your left, your hips a little under one step from it. Let your left arm hang. For the left arm, do everything mirrored.'],
        ['Stretch', 'Reach across your body toward the pulley, with your hand in front of your left shoulder at about chin height, and let your shoulder blade slide forward. The rear delt is longest with the arm across the front of the body.'],
        ['Sweep', 'Sweep your arm out, back and down until it is out to the side, a little behind your shoulders, with the elbow a little below shoulder height. Let your shoulder blade move back toward your spine. Keep the elbow bent about 20 degrees the whole way.'],
        ['Distance', 'Stay a little under one step from the pulley. Farther back makes the stretch lighter. Closer in, or with the pulley farther out to your side, the cable presses into your chest at the finish.'],
        ['Avoid', 'Bending and straightening your elbow during the rep. The movement should stay at the shoulder. Moving your torso.'],
      ],
    },
  },
  exercises: {
    'cable-behind-the-back-lateral-raise': 'lateralRaise',
    'cable-single-arm-rear-delt-fly': 'rearDelt',
  },
};
