/**
 * Face pull and upright row: standing cable pulls for the back and side of the
 * shoulder.
 *
 * Face pull: rope on a pulley above head height, staggered stance, leaning
 * back. The stretch is the arms reaching nearly straight toward the pulley
 * with the shoulder blades drawn forward and apart, which is where the rear
 * delts and middle traps are longest in this rep. The finish is the rope
 * spread with the hands beside the head, above the elbows, and the elbows
 * wide and behind the shoulders.
 *
 * Upright row: cambered bar on the low pulley, standing close to it. The
 * stretch is the arms hanging nearly straight (elbows bent 10) with the bar in
 * front of the thighs and the shoulders sunk, where the side delt is longest
 * in this rep. The bar rises close to the body and the elbows lead it up to
 * about shoulder height.
 */
import type { Body } from '../figure3d/body';
import type { FigureDef } from '../figure3d/figure';
import type { Q, V3 } from '../figure3d/math';
import { add, angleBetween, mul, norm, pitchFwd, qRot, sub } from '../figure3d/math';
import { bar, cable, floor, pulley, rope } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, dirHE, key, keyDir, mx } from './kit';

/* ---------- face pull ---------- */

/* Hip joints to floor: soft knees in a stance 15 ahead and 15 behind. */
const FP_FLOOR = 91;
const FP_STAGGER = 15;

/*
 * Lean back from the hips, degrees, held the whole rep.
 *
 * The pulley is 105 above the hips, 196 off the floor against a head top at
 * 177, and 150 in front of the hips, about two steps. Tried with the arm path
 * of FP_KEYS, which starts with the upper arm 10 above level against the
 * torso, and the hands on the line from the shoulders to the pulley: elbow
 * bend at full reach, and the elbow's distance above (+) or below (-) the
 * line from shoulder to hand along the torso's up axis; then the rope's
 * torque on the shoulder per unit of cable load, cm, at t = 0, 0.25, 0.5,
 * 0.75, 1 (FP_KEYS says how):
 *
 *   upright, 120 back: elbow 30, -7.2;  25 27 24 16 14
 *   upright, 150 back: elbow 21, -5.0;  26 28 24 16 14
 *   lean 10, 120 back: elbow 10, -1.2;  27 29 25 17 14
 *   lean 10, 150 back: elbow 10, +1.1;  27 30 25 17 14
 *   lean 10, 200 back: elbow 16, +3.6;  27 30 26 17 15, drawing scale 0.98
 *   lean 20, 150 back: elbow 27, +7.2;  26 31 26 17 15
 *
 * The load hardly changes, since the arm path is set against the torso. What
 * changes is how the cable meets the arms at full reach. Upright, the cable
 * climbs more steeply than the upper arm, so the elbow sags below the line
 * to keep the hands on it. Leaning back 10 at 120 to 150 lines the arms up
 * with the cable, and at the finish the cable runs level in the body's frame
 * (0.6 degrees off the torso's forward axis). Farther back or leaning more,
 * the cable runs flatter than the upper arm and the elbow bends upward; 200
 * back also draws the person smaller.
 */
const FP_LEAN = 10;
const FP_PULLEY: V3 = [0, -105, 150];

/*
 * Right arm in the body frame through the rep: the upper arm's heading and
 * elevation (dirHE), then the hand's x and y. The hand's z is wherever the
 * forearm reaches in front of the elbow, so the forearm keeps its length.
 *
 * At the stretch the upper arm points along the cable, a little above it so
 * the elbow bends upward rather than sagging, and the hands sit on the line
 * to the pulley: in the room the upper arm rises 20 degrees, the forearm 16
 * and the cable 18, with the elbow bent 10. The elbows then sweep out and
 * back at about the same height, 2 to 3.5 below the bottom of the chin from
 * t = 0.25 to the finish (5 below it at the stretch), while the hands rise
 * toward the face, so the rope moves from the first frame.
 *
 * The hands hold the rope spread, 40 apart at the stretch, 54 at the
 * finish. Spread, each strand pulls its hand in toward the knot, which the
 * rear delts hold against. The strands are 30 each, so 54 puts the knot 13
 * in front of the hands, clear of the face.
 *
 * The check's load is each strand's direction, so its table leaves out that
 * the strands pull harder as they spread: each carries the cable's load over
 * twice the cosine of its angle from the cable, 0.67 of it at 40 apart and
 * 1.15 at 54. The table's moment arm times that, in cm per unit of cable
 * load, is 26.9, 29.5, 25.4, 16.8, 14.5 at t = 0, 0.25, 0.5, 0.75, 1, which
 * would put the stretch at 91 percent of the peak and the finish at 49. The
 * pushdown's rope works out the same correction and keeps to the check, so
 * this cue does too: the moment arm, sampled every 0.05, peaks at 42.3 at
 * t = 0.2 (42.2 at 0.25), is 40.1 at the stretch (95 percent) and 12.6 at
 * the finish (30). With the stretch hands 20 apart and the upper arms aimed
 * at them, the corrected stretch read 4.4.
 */
const FP_KEYS: [number, number, number, number, number][] = [
  // y at the stretch is solved so the hands sit on the line to the pulley.
  [0, -89, 10, 20, NaN],
  [0.25, -68, 13, 21, -70],
  [0.5, -42, 14, 22, -75],
  [0.75, -12, 15, 24, -77],
  [1, 20, 15, 27, -79],
];

/*
 * Shoulder blades: forward and apart at the stretch, back and together at the
 * finish. Held at the same height: lowering them 2 at the finish lengthens
 * the midTrap proxy there to 5.5 against 3.7, which would undo the shortening
 * the cue describes. Upward rotation stays about 20 with the arm a little
 * above level; at 28 the finish drew the two blades as one mark at the spine.
 */
const fpScap = (t: number) =>
  key(t, [
    [0, { x: 4, y: -1, z: 3, rot: 20 }],
    [1, { x: -3, y: -1, z: -2, rot: 22 }],
  ]);

/** Upper arm direction, in the upper torso frame, at which the rear delt is shortest: out, back and a little down. The same as the rear delt fly's. */
const REAR_SHORT = dirHE(45, -20);

/*
 * Rear delt length, wrapped: 8 of free fiber plus a 4.5 radius wrap round the
 * back of the humeral head times the angle of the upper arm from where the
 * muscle is shortest, as in the rear delt fly. The engine's rearDelt is a
 * straight line from behind the joint to the upper arm, which reads longer as
 * the arm swings out from straight forward until about 60 forward of the
 * side. On this path it read 18.4 at t = 0.25 against 18.1 at the stretch, so
 * it called the stretch short. The wrapped length also grows as the arm
 * rises in front, as the real muscle does with the shoulder flexed.
 */
const rearDeltWrapped = (s: 'R' | 'L') => (b: Body) => {
  const u = sub(b.j[`elbow${s}`], b.j[`shoulder${s}`]);
  return 8 + (4.5 * Math.PI * angleBetween(u, b.dirOf('upper', s === 'R' ? REAR_SHORT : mx(REAR_SHORT)))) / 180;
};

function facePull(): FigureDef {
  const R: Q = pitchFwd(-FP_LEAN);
  const toBody = (p: V3): V3 => qRot([R[0], -R[1], -R[2], -R[3]], p);
  const P = FP_PULLEY;
  const Pb = toBody(P);
  const shoulderAt = (t: number): V3 => {
    const s = fpScap(t);
    return add(DIM.shoulder, [s.x, s.y, s.z]);
  };
  /** Forearm direction from an upper arm direction and the hand's x and y. */
  const forearm = (sh: V3, u: V3, hx: number, hy: number): V3 => {
    const el = add(sh, mul(u, DIM.upperArm));
    let dx = hx - el[0];
    let dy = hy - el[1];
    const r = Math.hypot(dx, dy);
    if (r > DIM.forearm) {
      dx *= DIM.forearm / r;
      dy *= DIM.forearm / r;
    }
    return norm([dx, dy, Math.sqrt(Math.max(0, DIM.forearm ** 2 - dx * dx - dy * dy))]);
  };
  // At the stretch the hands sit on the line from between the shoulders to
  // the pulley, so the cable carries on along the arms.
  const sh0 = shoulderAt(0);
  const u0 = dirHE(FP_KEYS[0][1], FP_KEYS[0][2]);
  let hy0 = sh0[1];
  for (let i = 0; i < 20; i++) {
    const f = forearm(sh0, u0, FP_KEYS[0][3], hy0);
    const hz = sh0[2] + DIM.upperArm * u0[2] + DIM.forearm * f[2];
    hy0 = sh0[1] + ((Pb[1] - sh0[1]) * (hz - sh0[2])) / (Pb[2] - sh0[2]);
  }
  const keys = FP_KEYS.map(([t, h, e, hx, hy]) => ({ t, u: dirHE(h, e), hx, hy: Number.isNaN(hy) ? hy0 : hy }));
  const foot = (x: number, z: number) => ({
    foot: { heel: [x, FP_FLOOR, z - DIM.heel] as V3, dir: [0, 0, 1] as V3 },
    pole: [0, 0, 1] as V3,
  });
  const knot = (b: Body) => rope(b.j.handR, b.j.handL, P).attach;
  return {
    /*
     * Front is turned 30 degrees toward the person's right. Straight on, the
     * arms point at the camera at the stretch and draw as short stubs with the
     * hands beside the head, so the stretch looked like the finish. Turned,
     * the arms reach up toward the pulley at the start and the elbows still
     * spread wide at the finish; the person's right stays on screen right.
     * Turned toward the person's left, the forward left foot and the back
     * right foot landed 2.3 apart on screen and the legs read as feet
     * together; turned right, the ankles are 32 apart.
     * The blades are hidden in Front and Side: from the side the protracted
     * blade showed as a lone dash inside the torso at t = 0 only. The Back
     * view shows them.
     */
    views: [
      { label: 'Front', cam: { dir: [0.5, 0, 0.866], up: [0, -1, 0], right: [0.866, 0, -0.5] }, hide: ['scap'] },
      VIEW.back,
      { ...VIEW.side, hide: ['scap'] },
      { ...VIEW.top, hide: ['leg'] },
    ],
    pose: (t) => {
      const u = keyDir(t, keys.map((k) => [k.t, k.u] as [number, V3]));
      const hx = key(t, keys.map((k) => [k.t, k.hx] as [number, number]));
      const hy = key(t, keys.map((k) => [k.t, k.hy] as [number, number]));
      const f = forearm(shoulderAt(t), u, hx, hy);
      return {
        pos: [0, 0, 0],
        rot: R,
        scapR: fpScap(t),
        armR: { dirs: [u, f] },
        armL: { dirs: [mx(u), mx(f)] },
        // Left foot forward, right foot back.
        legR: foot(DIM.hipHalf, -FP_STAGGER),
        legL: foot(-DIM.hipHalf, FP_STAGGER),
      };
    },
    equipment: (b) => {
      const r = rope(b.j.handR, b.j.handL, P);
      return [floor(FP_FLOOR), pulley(P), cable(P, r.attach), ...r.prims];
    },
    check: {
      muscles: [
        { m: 'midTrap', side: 'R' },
        { m: 'midTrap', side: 'L' },
      ],
      custom: [
        { name: 'rearDeltWrapR', len: rearDeltWrapped('R') },
        { name: 'rearDeltWrapL', len: rearDeltWrapped('L') },
      ],
      // Each strand pulls its hand toward the knot, so once the rope spreads
      // the pull on each hand turns inward and forward.
      load: (b) => {
        const j = knot(b);
        return [
          { at: b.j.handR, dir: sub(j, b.j.handR) },
          { at: b.j.handL, dir: sub(j, b.j.handL) },
        ];
      },
      lever: [
        { joint: 'shoulderR', end: 'elbowR' },
        { joint: 'shoulderL', end: 'elbowL' },
      ],
      contacts: (b) => [
        { name: 'heelR on floor', gap: b.j.heelR[1] - FP_FLOOR },
        { name: 'toeR on floor', gap: b.j.toeR[1] - FP_FLOOR },
        { name: 'heelL on floor', gap: b.j.heelL[1] - FP_FLOOR },
        { name: 'toeL on floor', gap: b.j.toeL[1] - FP_FLOOR },
      ],
    },
  };
}

/* ---------- upright row ---------- */

/* Hip joints to floor, standing tall with soft knees, feet under the hips. */
const UR_FLOOR = 92;

/*
 * Pulley 15 off the floor and 30 in front of the hip joints, a little under
 * half a step of 75, which puts the toes 12 from its center; the curl cues
 * use the same stance and the same words for it. The cable's torque on the
 * upper arm per unit of load (the check's moment arm, cm) at t = 0, 0.25,
 * 0.5, 0.75, 1, negative where it helps the elbows up. The arm folds through
 * the rep, so share would not compare:
 *
 *    30 in front:  1.0, -1.2,   3.3,  7.4, 9.9
 *    60 in front:  5.8, -4.5,  -3.6,  2.0, 6.4
 *   100 in front:  9.2, -7.0, -10.1, -3.7, 2.0
 *
 * Standing back angles the cable forward, which loads the bottom more,
 * helps the arms up through the middle and lightens the top. Close, it pulls
 * nearly along the arms at the bottom, about a tenth of the top's load, helps
 * slightly from t = 0.05 to 0.35, and resists from there to the top, from
 * about a third of the way up by bar height (16 of its 52 of rise, 30%).
 */
const UR_PULLEY: V3 = [0, UR_FLOOR - 15, 30];

/*
 * Hands 20 either side of center, 6 from the ends of the 52 bar, about
 * shoulder width: 40 apart against shoulder joints 42 apart at the bottom
 * and 40 at the top. At 14 the cable helped the arms up early (-9.0, -7.0 at
 * t = 0 and 0.25), the top measured 9.0 against 9.9, and the forearms ran
 * 3.5 into the torso at the bottom. The engine draws the cambered bar's bends
 * 3 deep and square to the forearms, so from the front it reads as straight.
 */
const UR_GRIP = 20;

function uprightRow(): FigureDef {
  const P = UR_PULLEY;
  /*
   * Bar center: in front of the thighs, then up close to the body to the lower
   * chest. The early keys are slow because an arm near straight bends a lot
   * at the elbow for a little rise; spaced evenly, the elbows jumped out in
   * the first tenth (9 of travel, against 4 to 6 per tenth after). Forward
   * of the hips by 11 at the thighs to 19 at the chest. The bar's center is
   * clear of the torso by 5 at the thighs, 0.1 at its closest at the waist
   * (t = 0.325) and 4.7 at the chest.
   */
  const barAt = (t: number): V3 => {
    const y = key(t, [
      [0, 14],
      [0.1, 12],
      [0.25, 5],
      [0.5, -12],
      [0.75, -26],
      [1, -38],
    ]);
    return [0, y, 11 + ((14 - y) * 8) / 52];
  };
  const foot = (x: number) => ({
    foot: { heel: [x, UR_FLOOR, -DIM.heel] as V3, dir: [0, 0, 1] as V3 },
    pole: [0, 0, 1] as V3,
  });
  return {
    views: [VIEW.front, VIEW.back, VIEW.side],
    pose: (t) => {
      const c = barAt(t);
      // Elbows bend out and a little back from the hanging arm, and finish
      // out and up. With the bar at the lower chest that puts them 35 forward
      // of straight out to the side, near the plane of the shoulder blade,
      // with the upper arm raised 82 and the elbow 4.6 below the shoulder.
      const pole = key(t, [
        [0, [1, 0, -0.3] as V3],
        [1, [1, -0.4, 0.2] as V3],
      ]);
      return {
        pos: [0, 0, 0],
        // Sunk and slightly forward under the bar at the bottom; raised and
        // rotated upward with the elbows at the top. In the Back view the
        // lower tip of each blade finishes level with the hand: raised 3 with
        // 28 of rotation it sat 5.9 from the hand's center and the blade, arm
        // and hand read as one shape; raised 6 with 22, and 1 nearer the
        // spine, it sits 7.8 away.
        scapR: key(t, [
          [0, { x: 1, y: 2, z: 1, rot: 0 }],
          [1, { x: 0, y: -6, z: 0, rot: 22 }],
        ]),
        armR: { ik: add(c, [UR_GRIP, 0, 0]), pole },
        armL: { ik: add(c, [-UR_GRIP, 0, 0]), pole: [-pole[0], pole[1], pole[2]] },
        legR: foot(DIM.hipHalf),
        legL: foot(-DIM.hipHalf),
      };
    },
    equipment: (b) => {
      const br = bar('cambered', b.j.handR, b.j.handL, { forearm: sub(b.j.handR, b.j.elbowR) });
      return [floor(UR_FLOOR), pulley(P), cable(P, br.attach), ...br.prims];
    },
    check: {
      muscles: [
        { m: 'sideDelt', side: 'R' },
        { m: 'sideDelt', side: 'L' },
        { m: 'upperTrap', side: 'R' },
        { m: 'upperTrap', side: 'L' },
      ],
      load: (b) => {
        const c = sub(P, mul(add(b.j.handR, b.j.handL), 0.5));
        return [
          { at: b.j.handR, dir: c },
          { at: b.j.handL, dir: c },
        ];
      },
      lever: [
        { joint: 'shoulderR', end: 'elbowR' },
        { joint: 'shoulderL', end: 'elbowL' },
      ],
      contacts: (b) => [
        { name: 'heelR on floor', gap: b.j.heelR[1] - UR_FLOOR },
        { name: 'toeR on floor', gap: b.j.toeR[1] - UR_FLOOR },
        { name: 'heelL on floor', gap: b.j.heelL[1] - UR_FLOOR },
        { name: 'toeL on floor', gap: b.j.toeL[1] - UR_FLOOR },
      ],
    },
  };
}

export const group: Group = {
  figures: {
    facePull: facePull(),
    uprightRow: uprightRow(),
  },
  cues: {
    facePull: {
      reach: 'Arms reaching nearly straight toward the pulley at the start, hands spread on the rope, with the shoulder blades drawn forward and apart.',
      points: [
        'Set the pulley a little above head height and clip a rope to it. Stand facing the pulley with your hips about two steps from it and your feet staggered, and lean back about 10 degrees from the hips. With that lean the cable lines up with your arms at the stretch, with the elbows nearly straight. Hold the lean and keep your torso still through the rep.',
        'The rear delt lengthens as the arm reaches forward, and the middle trapezius lengthens as the shoulder blades move apart. Let the rope draw your arms and shoulder blades forward at the start of each rep.',
        'Hold the ends of the rope pulled apart, with your hands about shoulder width apart at the stretch. The strands then pull your hands in toward the middle, and the rear delt holds against that, so it carries load there. With the hands close together the rope pulls nearly along your arms, and the stretch carries much less load.',
        'Pull toward your face with the elbows wide and about level with your chin. Keep spreading the rope as it comes in. Finish with your hands beside your head and above your elbows, and your elbows behind your shoulders. Moving the elbows back shortens the rear delt, and drawing the shoulder blades together shortens the middle trapezius.',
        'The cable resists the movement most about a quarter of the way through the rep. At the stretch it resists nearly as much, and at the finish about a third as much.',
      ],
    },
    uprightRow: {
      reach: 'Arms hanging nearly straight at the bottom, with the shoulders relaxed down.',
      points: [
        'Set the pulley at the bottom and clip a cambered bar to it. Stand facing the pulley with your hips a little under half a step from it, your feet about hip width apart and your knees slightly bent. Hold the bar overhand near its ends, with your hands about shoulder width apart. A grip at least shoulder width apart, with the elbows stopping at about shoulder height, is the usual advice for sparing the shoulder.',
        'The side delt lengthens as the arm comes down to your side. Let the bar settle in front of your thighs with the arms nearly straight and the shoulders sinking down, which also lengthens the upper trapezius.',
        'Raising the arm shortens the side delt. Raise the elbows out and up, leading the hands, and keep the bar close to your body. Stop with the elbows at about shoulder height, pointing out to the sides and partly forward, with the bar near your lower chest. Let the shoulder blades rise and turn upward as the elbows come up, and keep your torso upright and still.',
        'The cable resists the movement most at the finish, where it pulls the hands down in front of the shoulders. At the stretch it pulls nearly along your arms and resists about a tenth as much. Early in the rep it pulls along your arms or helps them up a little, and its load builds from about a third of the way up. Standing close keeps the cable running nearly straight down. Standing farther back angles it forward, which loads the stretch more, helps lift the elbows through the middle of the rep, and makes the finish lighter.',
      ],
    },
  },
  exercises: {
    'cable-face-pull': 'facePull',
    'cable-upright-row': 'uprightRow',
  },
};
