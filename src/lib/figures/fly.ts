/**
 * Crossover flys, high, mid and low.
 *
 * The arms sweep along a great circle between a start and a finish direction,
 * tilted by the pulley height, with the forearm 20 degrees further along the
 * same arc to hold the elbow bend. Headings: upper arm from 34 at the stretch
 * to -92.5 at the finish, close to as far across as the torso lets the upper
 * arms come (at -97 they pass into it in the mid and low flys). There the
 * hands are about 20 apart, center to center: high 20, mid 19, low 23.
 * The arm path is set against the upper torso. The lean is a hinge at the
 * hips; the upper back extends against it by up to THORACIC_EXT, so the chest
 * faces forward while the hips stay hinged. Legs stand in a staggered stance.
 * The pulleys are fixed in the room.
 */
import type { Body } from '../figure3d/body';
import type { FigureDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, angleBetween, dist, lerpN, mul, norm, slerpDir, sub } from '../figure3d/math';
import { cable, floor, handle, pulley } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, dirHE, mx } from './kit';

/*
 * Upper-back extension, in degrees, between the torso's lower and upper
 * halves. A single rigid torso tipped forward pointed the chest at the floor,
 * which is the slouch the chest-up cue prevents. The upper half tips back this
 * much against the lower, never past upright, so the chest tips forward 8
 * degrees in the high fly and stays upright in the mid and low.
 */
const THORACIC_EXT = 12;

/*
 * Hip joints to floor. 93 straight; the stance has the feet 20 ahead and 20
 * behind, hip to ankle 0.98 of full leg length as the first fly figures
 * stood, which bends both knees 22 degrees.
 */
const FLOOR = 89;
const STAGGER = 20;

/*
 * Distance from the hips back to the line between the pulleys, fly()'s
 * behind: 100 for the high and mid flys, about one and a half steps of 75,
 * and 130 for the low, a little under two. Measured with check.mjs, stretch
 * / finish, percent. share is the cable's torque about the axis the arm
 * sweeps in, over the most the cable could give; sine is the sine of the
 * angle between arm and cable, which also counts torque that pulls the arm
 * off its path.
 *
 *                      high      mid       low
 *   share, 40 in front   41 / 34   20 / 45   13 / 67
 *   share, 70            56 / 26   64 / 35   13 / 59
 *   share, 100           62 / 20   76 / 27   34 / 51
 *   share, 130           65 / 14   80 / 21   48 / 45
 *   share, 160           66 / 10   83 / 16   58 / 39
 *   sine, as drawn       75 / 28   76 / 27   65 / 52
 *
 * As drawn, share peaks at 95 at t = 0.30 for the high fly and 100 at 0.26
 * for the mid, both with the arms out to the sides, and 94 at 0.42 for the
 * low. At 100 the high and mid flys load the stretch harder than the finish
 * by both measures. The low fly at 100 loaded its stretch less than its
 * finish by share, 34 / 51 (sine 59 / 58); at 130 the two are about even.
 * Closer in, the stretch gets lighter and the finish heavier; the low fly's
 * stretch stops falling at 13 by 70. The low fly's pulleys at 130 lengthen
 * its Top view, so it draws at scale 1.084 against 1.10 for the others. The check
 * counts the cable only; the arm's own weight adds load as the low fly's
 * arms rise and takes some off as the high fly's arms fall.
 *
 * The pulleys are drawn 100 out from center. Many stations are wider, about
 * 130 to 150 out, but at 130 out the drawing shrinks from scale 1.10 to 0.85
 * to keep them in frame. A wider station loads the stretch less at the same
 * distance: with the pulleys 130 out, share is high 41 / 31 and mid 52 / 39
 * at 100 in front, and low 41 / 51 at 130.
 */
const PULLEY_OUT = 100;

/*
 * How far the right blade, and the shoulder joint on it, shifts from its set
 * position through the rep. At the stretch, opening the arms draws it 2
 * further toward the spine and 3 back. At the finish, reaching across lets it
 * drift 3 out and 2 forward, which holding the blades back keeps small. The
 * set position, back and down, is drawn at the body's default. Offsetting it
 * 1 in, 2 down and 1 back shortened the lower-fiber proxies at the stretch by
 * about 1 (high pecSternal 38.5 to 37.5, mid 37.6 to 37.0), since a lowered
 * shoulder sits closer to the sternum below it, which would have the drawing
 * argue against the cue's reason for setting the blades. The
 * retraction drawn at the stretch lengthens the pec proxies by 0.3 (high,
 * mid) to 0.8 (low) over blades held at the set position.
 */
const SCAP_STRETCH = { x: -2, z: -3 };
const SCAP_FINISH = { x: 3, z: 2 };

/** Upper arm 10 from the shoulder, where the pec proxies in analysis.ts insert. */
const humerus10 = (b: Body, s: 'R' | 'L'): V3 =>
  add(b.j[`shoulder${s}`], mul(norm(sub(b.j[`elbow${s}`], b.j[`shoulder${s}`])), 10));

/*
 * Lowest sternal fibers, from the bottom of the sternum, for the high fly's
 * claim about the lower fibers. analysis.ts has no proxy this low.
 */
const pecCostal = (s: 'R' | 'L') => ({
  name: `pecCostal${s}`,
  len: (b: Body) => dist(b.at('upper', [s === 'R' ? 3 : -3, -30, 14]), humerus10(b, s)),
});

/** Which pec fibers the path works: picks the length proxies the check verifies. */
type Fibers = 'lower' | 'middle' | 'upper';

/** behind: from the hips back to the line between the pulleys. */
function fly(startElev: number, endElev: number, lean: number, pulleyY: number, fibers: Fibers, behind: number): FigureDef {
  const d0 = dirHE(34, startElev);
  const d1 = dirHE(-92.5, endElev);
  const lead = 20 / angleBetween(d0, d1);
  const ext = Math.min(lean, THORACIC_EXT);
  const pulleys: V3[] = [
    [PULLEY_OUT, pulleyY, -behind],
    [-PULLEY_OUT, pulleyY, -behind],
  ];
  const foot = (x: number, z: number) => ({
    foot: { heel: [x, FLOOR, z - DIM.heel] as V3, dir: [0, 0, 1] as V3 },
    pole: [0, 0, 1] as V3,
  });
  const pec = fibers === 'upper' ? 'pecClavicular' : 'pecSternal';
  return {
    views: [VIEW.front, VIEW.back, VIEW.side, { ...VIEW.top, hide: ['leg'] }],
    pose: (t) => {
      const u = slerpDir(d0, d1, t);
      const f = slerpDir(d0, d1, t + lead);
      return {
        pos: [0, 0, 0],
        pelvis: { flex: lean },
        thoracic: { flex: -ext },
        scapR: { x: lerpN(SCAP_STRETCH.x, SCAP_FINISH.x, t), z: lerpN(SCAP_STRETCH.z, SCAP_FINISH.z, t) },
        armR: { dirs: [u, f] },
        armL: { dirs: [mx(u), mx(f)] },
        // Left foot forward, right foot back.
        legR: foot(DIM.hipHalf, -STAGGER),
        legL: foot(-DIM.hipHalf, STAGGER),
      };
    },
    equipment: (b) => {
      const hr = handle(b.j.handR, pulleys[0], sub(b.j.handR, b.j.elbowR));
      const hl = handle(b.j.handL, pulleys[1], sub(b.j.handL, b.j.elbowL));
      return [
        floor(FLOOR),
        pulley(pulleys[0]),
        pulley(pulleys[1]),
        cable(pulleys[0], hr.attach),
        cable(pulleys[1], hl.attach),
        ...hr.prims,
        ...hl.prims,
      ];
    },
    check: {
      muscles: [
        { m: pec, side: 'R' },
        { m: pec, side: 'L' },
      ],
      custom: fibers === 'lower' ? [pecCostal('R'), pecCostal('L')] : undefined,
      load: (b) =>
        (['R', 'L'] as const).map((s, i) => {
          const at = s === 'R' ? b.j.handR : b.j.handL;
          return { at, dir: sub(pulleys[i], at) };
        }),
      lever: [
        { joint: 'shoulderR', end: 'handR' },
        { joint: 'shoulderL', end: 'handL' },
      ],
      // At the finish the cable runs along the outside of the arm, as it does
      // on a real station.
      allow: ['eq.cable~arm'],
      contacts: (b) => [
        { name: 'heelR on floor', gap: Math.abs(b.j.heelR[1] - FLOOR) },
        { name: 'toeR on floor', gap: Math.abs(b.j.toeR[1] - FLOOR) },
        { name: 'heelL on floor', gap: Math.abs(b.j.heelL[1] - FLOOR) },
        { name: 'toeL on floor', gap: Math.abs(b.j.toeL[1] - FLOOR) },
      ],
    },
  };
}

export const group: Group = {
  /*
   * Pulleys: 205 off the floor for the high fly, the top of a real station
   * and about 30 above the head; shoulder height for the mid; 10 off the floor
   * for the low. At the high fly's stretch the cable rises 19 degrees from the
   * hand to the pulley; at 189, where the pulley sat before, it rose 10 and
   * read as level from the side.
   *
   * The low fly starts with the upper arms 30 degrees below level, as the
   * first figures did. The hands sit 17 above the hip joints and 10 behind the
   * back of the torso at that height, behind it in the Side and Top views.
   * The plane the arm sweeps in misses the low pulley there, so part of the
   * cable's pull at the stretch goes across it (share 48 against sine 65 at
   * 130) and the hands dip 3 before rising. A start 55 below level put the
   * plane through the pulley and gave share 58 / 57 at 100, but brought the
   * hands 2 in front of the back of the torso and shortened the
   * pecClavicular proxy at the stretch from 27.4 to 26.0. The start stays at
   * 30 below, and standing at 130 brings the stretch up to the finish.
   *
   * Leans are the usual coaching ranges: more for a high pulley, close to
   * upright for a low one.
   */
  figures: {
    flyHigh: fly(30, -35, 20, FLOOR - 205, 'lower', 100),
    flyMid: fly(0, 0, 12, -53, 'middle', 100),
    flyLow: fly(-30, -2, 5, FLOOR - 10, 'upper', 130),
  },
  cues: {
    flyHigh: {
      reach: 'Arms up and out at the start, with the hands behind the line of your torso.',
      points: [
        ['Setup', 'Set both pulleys at the top with a D handle on each. Stand about one and a half steps in front of the pulleys with your feet staggered. Lean forward about 20 degrees from the hips with your chest up.'],
        ['Blades', 'Pull your shoulder blades back and down before the first rep and keep them there.'],
        ['Stretch', 'Open your arms up and out until your hands are behind the line of your torso, with your elbows bent about 20 degrees. The lower and middle pec are longest with the arm raised and back.'],
        ['Fly', 'Sweep your hands forward and down, then in, until they are about a hand\'s width apart in front of your hips. Hold the elbow angle the whole way.'],
        ['Distance', 'Stand the full one and a half steps out. Closer in, the cable pulls along your arms at the stretch, which loads your shoulder joint and takes load off the pec.'],
        ['Avoid', 'Bending and straightening your elbows, which turns the fly into a press. Letting your shoulder blades slide forward as your hands meet, which moves the finish onto your front delts.'],
      ],
    },
    flyMid: {
      reach: 'Arms out at shoulder height at the start, with the hands behind the line of your torso.',
      points: [
        ['Setup', 'Set both pulleys at shoulder height with a D handle on each. Stand about one and a half steps in front of the pulleys with your feet staggered. Lean forward about 12 degrees from the hips with your chest up.'],
        ['Blades', 'Pull your shoulder blades back and down before the first rep and keep them there.'],
        ['Stretch', 'Open your arms out to the sides until your hands are behind the line of your torso, with your elbows bent about 20 degrees. The middle pec is longest with the arm out to the side and back.'],
        ['Fly', 'Bring your hands forward and in at shoulder height until they are about a hand\'s width apart in front of your chest. Hold the elbow angle the whole way.'],
        ['Distance', 'Stand the full one and a half steps out. Closer in, the cable pulls along your arms at the stretch, which loads your shoulder joint and takes load off the pec.'],
        ['Avoid', 'Bending and straightening your elbows, which turns the fly into a press. Letting your shoulder blades slide forward as your hands meet, which moves the finish onto your front delts.'],
      ],
    },
    flyLow: {
      reach: 'Arms down and out at the start, with the hands behind the line of your torso.',
      points: [
        ['Setup', 'Set both pulleys at the bottom with a D handle on each. Stand a little under two steps in front of the pulleys with your feet staggered. Lean forward about 5 degrees from the hips with your chest up.'],
        ['Blades', 'Pull your shoulder blades back and down before the first rep and keep them there.'],
        ['Stretch', 'Let your arms go down and out until your hands are behind the line of your torso, with your elbows bent about 20 degrees. The upper pec is longest with the arm low and back.'],
        ['Fly', 'Sweep your hands forward, then up and in, until they meet in front of you at shoulder height. Hold the elbow angle the whole way.'],
        ['Distance', 'Stand a little under two steps out. Closer in, the cable pulls your arms down toward your sides at the stretch, and the pec gets less of the load.'],
        ['Avoid', 'Bending and straightening your elbows, which turns the fly into a press. Letting your shoulder blades slide forward as your hands meet, which moves the finish onto your front delts.'],
      ],
    },
  },
  exercises: {
    'cable-high-crossover-fly': 'flyHigh',
    'cable-mid-crossover-fly': 'flyMid',
    'cable-low-crossover-fly': 'flyLow',
  },
};
