/**
 * Overhead cable triceps extensions, high and low: standing in a staggered
 * stance facing away from the pulley, leaning forward from the hips, the upper
 * arms raised beside the head and held there while the elbows open.
 *
 * At the stretch the elbows are bent 140 degrees with the hands behind the
 * head and the shoulders flexed close to their limit. The long head of the
 * triceps runs from the shoulder blade, under the shoulder joint, to the
 * elbow, so it is longest with both the shoulder flexed and the elbow bent.
 * The upper arms and shoulder blades hold still, so only the forearms move.
 */
import type { FigureDef, ViewDef } from '../figure3d/figure';
import type { Body } from '../figure3d/body';
import type { V3 } from '../figure3d/math';
import { rad, sub } from '../figure3d/math';
import { bar, cable, floor, pulley, rope } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, key, mx } from './kit';

interface Setup {
  /** Hip hinge, degrees forward. The back stays flat on top of it. */
  lean: number;
  /**
   * Upper arm angle from hanging in the upper torso's sagittal plane, degrees,
   * before the tilt in that puts the elbow at elbowX. 170 with elbowX 17
   * measures 167 degrees of shoulder elevation in the check.
   */
  armElev: number;
  /** Distance of the elbow from the midline. */
  elbowX: number;
  /** Distance of the hand from the midline at the stretch and at lockout. */
  handX: [number, number];
  /** Elbow flexion at the stretch and at lockout, degrees. */
  elbow: [number, number];
  pulley: V3;
  kind: 'rope' | 'bar';
}

/*
 * Arms overhead: the blade rides up and rotates upward 40 degrees, as it does
 * at the top of a pulldown, and holds there for the whole rep.
 */
const SCAP = { x: 2, y: -5, z: 1, rot: 40 };
const SHOULDER_X = DIM.shoulder[0] + SCAP.x;

/*
 * Stance, shared by both figures: hip joints 90 above the floor, the front
 * (left) ankle 15 ahead of the hips and the back (right) ankle 22 behind.
 * Measured: the back knee bends 6 degrees with the heel flat and the back
 * shin 18 degrees forward of vertical; the front shin is within 2 degrees of
 * vertical with the knee bent 23. The first stances, floor 86 and 87 with
 * the back ankle 30 and 28 behind, bent the back knee about 20 with the back
 * shin about 30 degrees forward over a flat heel, which read as a lunge.
 * Lifting the back heel 10 to 15 degrees raised the ankle and bent the back
 * knee further, 25 to 45. Floor 90 with the back ankle 26 behind straightens
 * the back leg fully and the foot misses the floor.
 */
const FLOOR = 90;
const FRONT = 15;
const BACK = -22;

function extension(s: Setup, views: FigureDef['views']): FigureDef {
  // Upper arm, right side, in the upper torso frame: armElev forward and up
  // from hanging, tilted in so the elbow sits at elbowX.
  const ux = (s.elbowX - SHOULDER_X) / DIM.upperArm;
  const th = rad(s.armElev);
  const k = Math.sqrt(1 - ux * ux);
  const u: V3 = [ux, k * Math.cos(th), k * Math.sin(th)];
  // Forearm with the hand at handX and the elbow bent e. Its sideways part is
  // set by the hand's distance from the midline, which on a bar is the grip
  // and stays fixed; the rest turns back from the upper arm until the angle
  // between them is e. The plane the elbow bends in then turns through the
  // rep, which a real upper arm allows by rotating on its own axis: measured
  // from the stretch, 9, 14 and 19 degrees at t = 0.25, 0.5 and 0.75 with
  // the rope, 12, 17 and 21 with the bar.
  const fore = (t: number): V3 => {
    const hx = key(t, [[0, s.handX[0]], [1, s.handX[1]]]);
    const e = rad(key(t, [[0, s.elbow[0]], [1, s.elbow[1]]]));
    const c = (hx - s.elbowX) / DIM.forearm;
    const m = Math.sqrt(1 - c * c);
    const psi = th + Math.acos(Math.max(-1, Math.min(1, (Math.cos(e) - ux * c) / (k * m))));
    return [c, m * Math.cos(psi), m * Math.sin(psi)];
  };
  const foot = (x: number, z: number) => ({
    foot: { heel: [x, FLOOR, z - DIM.heel] as V3, dir: [0, 0, 1] as V3 },
    pole: [0, 0, 1] as V3,
  });
  const grip = (b: Body) =>
    s.kind === 'rope' ? rope(b.j.handR, b.j.handL, s.pulley) : bar('straight', b.j.handR, b.j.handL, { toward: s.pulley });
  return {
    views,
    pose: (t) => {
      const f = fore(t);
      return {
        pos: [0, 0, 0],
        pelvis: { flex: s.lean },
        scapR: SCAP,
        armR: { dirs: [u, f] },
        armL: { dirs: [mx(u), mx(f)] },
        // Left foot forward, right foot back.
        legR: foot(DIM.hipHalf, BACK),
        legL: foot(-DIM.hipHalf, FRONT),
      };
    },
    equipment: (b) => {
      const g = grip(b);
      return [floor(FLOOR), pulley(s.pulley), cable(s.pulley, g.attach), ...g.prims];
    },
    check: {
      muscles: [
        { m: 'tricepsLong', side: 'R' },
        { m: 'tricepsLong', side: 'L' },
        { m: 'tricepsShort', side: 'R' },
        { m: 'tricepsShort', side: 'L' },
      ],
      // A rope pulls each hand along its own strand; a bar pulls both along
      // the cable.
      load: (b) => {
        const g = grip(b);
        return (['handR', 'handL'] as const).map((h) => ({
          at: b.j[h],
          dir: s.kind === 'rope' ? sub(g.attach, b.j[h]) : sub(s.pulley, g.attach),
        }));
      },
      lever: [
        { joint: 'elbowR', end: 'handR' },
        { joint: 'elbowL', end: 'handL' },
      ],
      contacts: (b) => [
        { name: 'heelR on floor', gap: b.j.heelR[1] - FLOOR },
        { name: 'toeR on floor', gap: b.j.toeR[1] - FLOOR },
        { name: 'heelL on floor', gap: b.j.heelL[1] - FLOOR },
        { name: 'toeL on floor', gap: b.j.toeL[1] - FLOOR },
      ],
    },
  };
}

/*
 * High: a rope, the pulley 165 off the floor, about eye level for the 178 cm
 * person standing upright, and 100 behind the hips, so the back heel is 74
 * in front of it. A 65 degree hinge points the upper arms forward and 15
 * degrees above level (measured 14.8), and puts the head's center 119 off
 * the floor, 46 below the pulley.
 *
 * At the stretch the forearms point back and 23 degrees up, and the cable
 * rises 11 degrees from the rope toward the pulley, so it runs close to the
 * line of the forearms. Measured share of the cable's leverage on the elbow,
 * stretch / peak at t = 0.5 / finish, and how far the cable clears the head
 * at lockout, changing one thing at a time:
 *
 *   as drawn: 18 / 87 / 39 (8.3 clear)
 *   lean 55: 7 / 86 / 46 (12.0)   60: 13 / 87 / 42 (10.2)
 *        70: 23 / 87 / 35 (6.4)
 *   pulley 200 off the floor: 0 / 85 / 50 (14.7)   180: 10 / 87 / 44 (11.2)
 *          150: 26 / 87 / 33 (5.3)   140: 31 / 86 / 29 (3.2)
 *   hips 70 in front of the pulley: 14 / 87 / 41   130: 20 / 87 / 37
 *   hands 20 apart at the stretch: 13 / 94 / 41 (forearms 4.7 from the head)
 *
 * The first version leaned 55 with the hands 20 apart and the hips about 80 in
 * front of the pulley, and there the cable worked to open the elbows at the
 * stretch (share 2, resists -1). With this pulley, the same lean and hands
 * leave the stretch with no load (share 0). Lowering the pulley or leaning
 * farther both load the stretch; leaning keeps the pulley
 * high, where this exercise has it. With the hands 30 apart the forearms pass
 * beside the head and the strands pull partly inward on the hands, which the
 * share leaves out and the sine (48 at the stretch) counts.
 */
const HIGH_PULLEY: V3 = [0, FLOOR - 165, -100];

/*
 * Low: a short straight bar with the hands 26 apart, the pulley 15 off the
 * floor and 140 behind the hips, so the back heel is 114 in front of it. A 15
 * degree hinge.
 *
 * Here the cable passes behind the head at lockout, and whatever brings it
 * closer to the head loads the stretch more and the finish less. Stretch /
 * peak at t = 0.5 / finish, and the cable's clearance of the head at lockout:
 *
 *   as drawn: 31 / 100 / 38 (5.0 clear)
 *   hips 110 in front of the pulley: 41 / 99 / 30 (0.9)
 *        125: 36 / 99 / 34 (3.0)   155: 26 / 100 / 42 (6.7)
 *   lean 5: 18 / 100 / 47 (9.3)   10: 24 / 100 / 43 (7.2)
 *        20: 37 / 99 / 33 (2.7)   25: 42 / 99 / 29 (0.5)
 *   pulley raised to 45 off the floor: 19 / 100 / 46 (8.7), or
 *        31 / 100 / 38 (4.8) with the hips moved 30 closer
 *   hands 30 apart: 33 / 100 / 33 (3.4)
 *
 * At 125, where the hips first stood, the cable cleared the head by 3, 2 to
 * 3 px in the app, and read as touching. 140 leaves a visible gap and keeps
 * the stretch at about a third of the peak (31) and the finish a little over
 * a third (38).
 */
const LOW_PULLEY: V3 = [0, FLOOR - 15, -140];

/*
 * The low figure's Back view, swung 15 degrees toward the person's left.
 * Square from behind, the cable ran straight up the midline and read as the
 * spine, and the pulley ring sat between the feet. Swung, the ring shows
 * beside the back foot and the cable leaves the body toward it. Swung 15
 * toward the right, the staggered legs drew almost on top of each other, and
 * at 25 they crossed.
 */
const BACK_LEFT: ViewDef = {
  label: 'Back',
  cam: { dir: [-0.259, 0, -0.966], up: [0, -1, 0], right: [0.966, 0, -0.259] },
};

export const group: Group = {
  figures: {
    overheadExtHigh: extension(
      {
        lean: 65,
        armElev: 170,
        elbowX: 17,
        handX: [15, 14],
        elbow: [140, 4],
        pulley: HIGH_PULLEY,
        kind: 'rope',
      },
      // Side: the lean, the cable over the head, the forearms' arc. Top:
      // elbow width and the hands coming out from behind the head. With the
      // lean, Top looks down on the upper back, where the blades, which hold
      // still here, drew two grey arcs under the rope's V, so it hides them.
      [VIEW.side, { ...VIEW.top, hide: ['leg', 'scap'] }],
    ),
    overheadExtLow: extension(
      {
        lean: 15,
        armElev: 170,
        elbowX: 17,
        handX: [13, 13],
        elbow: [140, 4],
        pulley: LOW_PULLEY,
        kind: 'bar',
      },
      // Back: elbow width, the grip, and the bar behind the head. Side: the
      // lean, the stance's distance from the pulley, and the cable passing
      // behind the head at lockout.
      [BACK_LEFT, VIEW.side],
    ),
  },
  cues: {
    overheadExtHigh: {
      reach: 'Elbows fully bent with your hands behind your head and your upper arms beside your ears, pointing forward.',
      points: [
        'Set the pulley at about your eye level when you stand upright, and clip a rope to it. Hold one end of the rope in each hand. Face away from the pulley with your hips about one and a half steps in front of it, stagger your feet, and lean forward about 65 degrees from the hips with your back flat. Your upper arms point forward beside your head, about 15 degrees above level. The cable runs from the rope back over your upper back to the pulley.',
        'The long head of the triceps starts on the shoulder blade and crosses both the shoulder and the elbow, so it is longest with the arm raised and the elbow fully bent. Maeo and colleagues found more triceps growth from overhead extensions than from pushdowns, which work the triceps with the arm at your side.',
        'Hold your upper arms still, with the elbows pointing forward and a little narrower than your shoulders, and move only at the elbows. Bring your hands back behind your head until your elbows are fully bent. If you pull the elbows down to help, the upper arms come down from beside your head and the long head shortens.',
        'The cable resists the movement most about halfway through the rep, with your forearms pointing straight up and the cable crossing them at about a right angle. At the stretch the cable runs close to the line of your forearms, so it resists about a fifth as much. At the finish, with your elbows straight, it resists a little under half as much.',
        'A higher pulley, or a more upright torso, lines the cable up with your forearms at the stretch, so it resists less there. With the pulley at the top it resists almost nothing at the stretch. A lower pulley makes the stretch heavier and the finish lighter, and brings the cable closer to your head at the finish. With the pulley at about your shoulder height when you stand upright, the cable resists about a third as much at the stretch as at its peak, about the same as in the low pulley extension.',
      ],
    },
    overheadExtLow: {
      reach: 'Elbows fully bent with the bar behind your head and your upper arms up beside your ears.',
      points: [
        "Set the pulley at the bottom and clip a short straight bar to it. Hold the bar about a hand's width in from each end. Face away from the pulley with your hips a little under two steps in front of it, stagger your feet, and lean forward about 15 degrees from the hips with your back flat. The cable runs up behind your back to the bar.",
        'The long head of the triceps starts on the shoulder blade and crosses both the shoulder and the elbow, so it is longest with the arm raised and the elbow fully bent. Maeo and colleagues found more triceps growth from overhead extensions than from pushdowns, which work the triceps with the arm at your side.',
        'Hold your upper arms still beside your head, with the elbows pointing up and a little narrower than your shoulders, and lower the bar behind your head until your elbows are fully bent. If you let the elbows drift forward to help, the upper arms come down from beside your head and the long head shortens.',
        'The cable resists the movement most about halfway through the rep. At the stretch it resists about a third as much, and at the finish a little over a third as much, with the cable passing just behind your head. Standing closer to the pulley, or leaning farther forward, makes the stretch heavier and the finish lighter, and brings the cable closer to your head. At a lean of about 25 degrees it reaches the back of your head. Standing farther away makes the stretch lighter and the finish heavier, and moves the cable away from your head.',
        'Raising the pulley to about knee height makes it easier to get the bar from the pulley to behind your head. With the pulley at knee height the cable resists about a fifth as much at the stretch as at its peak. Standing a little under half a step closer brings that back to about a third, with the cable still just behind your head at the finish.',
      ],
    },
  },
  exercises: {
    'cable-high-overhead-tricep-extension': 'overheadExtHigh',
    'cable-low-overhead-tricep-extension': 'overheadExtLow',
  },
};
