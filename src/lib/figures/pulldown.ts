/**
 * Lat pulldowns, close, regular and wide: seated under a knee pad, an overhand
 * grip on the lat bar, the cable from a pulley overhead.
 *
 * The torso holds one lean back from the hips through the rep, so only the
 * arms and shoulder blades move. At the stretch the arms are straight and the
 * bar hangs straight under the pulley; the blades are drawn up and rotated
 * upward, which lifts the shoulder joint away from the low back where the lat
 * starts. At the finish the bar is on the upper chest, the blades down and
 * together, the elbows down.
 *
 * The lat's length proxy (analysis.ts) runs from the low back over the bottom
 * of the blade to a point 8 down the upper arm. It carries the blade's height
 * into the lat's length almost one for one, and it cannot tell arm elevations
 * past about 140 degrees apart: with the torso still it reads longest near 140
 * and a little shorter toward 180. The real lat keeps lengthening up to full
 * overhead flexion (the lat length test is full flexion with the low back
 * flat), so the lean below is set by the face and the cable, and the proxy is
 * not used to choose it.
 *
 * The teres major's proxy, from the bottom of the blade to a point 6 down the
 * upper arm, has the same flat top. It reads longest at the stretch only
 * while the blade's upward rotation keeps pace with the arm; see the blade
 * keys below.
 *
 * Measured with the proxy at the stretch, with the t = 0 blade set to the
 * finish blade and the same hands: the lat's change over the rep falls by 54
 * to 56%. That pose leaves the hands 9 to 10 short of the bar, so it is a
 * proxy figure for a bar set lower, and the cue says only "a large part".
 */
import type { BodySpec } from '../figure3d/body';
import { solveBody } from '../figure3d/body';
import type { FigureDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, dist, dot, mul, norm, rad, sub } from '../figure3d/math';
import { bar, box, cable, cylinder, floor, pulley, rail } from '../figure3d/equipment';
import type { Cue, Group } from './kit';
import { DIM, VIEW, key } from './kit';

/*
 * The pulley is about 225 above the floor, its cable hanging 12 in front of
 * the hip joints, over the forehead of someone sitting upright. That is
 * roughly where a pulldown station hangs its bar; the user's machine is not
 * known, so the cue ties the lean to the bar clearing the face.
 */
const PULLEY: V3 = [0, -166, 12];

/*
 * Lean back from the hips, degrees, held through the rep. Measured for
 * close / regular / wide: at the stretch, the arm's elevation against the
 * torso in degrees and the check's moment arm (cm) and share (%); and the
 * closest the bar or cable comes to the head from mid-rep to the finish, cm.
 *
 *   lean   elevation         moment arm     share          bar to head
 *     0    170 / 166 / 160   11 / 10 / 11   17 / 15 / 17    1
 *     5    160 / 158 / 154   16 / 14 / 15   24 / 21 / 23    6
 *     8    154 / 153 / 149   19 / 17 / 17   28 / 25 / 26    8
 *    10    150 / 149 / 146   20 / 18 / 19   31 / 28 / 29    9
 *    12    146 / 145 / 142   22 / 20 / 20   34 / 30 / 30   10
 *    15    140 / 140 / 137   24 / 22 / 21   37 / 33 / 33   12
 *
 * At the finish, at every lean in the table, the moment arm is 17 for close,
 * 20 to 21 for regular and 25 to 27 for wide, and share is 86 to 92.
 *
 * moment arm is the check's row: the torque about the axis the arm moves in,
 * per unit of cable tension. share divides it by the shoulder-to-hand
 * distance, which is about 66 with the arm straight at the top and 20 to 29
 * with it folded at the bottom, so share is not comparable across the rep.
 * At the top both depend on the elbow pole weights in arm() below, which set
 * the plane the arm starts to move in; the whole turning load there,
 * shoulder to hand crossed with the cable's direction, is 21 / 21 / 26 at a
 * lean of 10.
 *
 * Upright, the bar's path down crosses the face: the cable hangs at z 12 and
 * the front of the face is at z 14. From a lean of 5 up, the cable comes
 * closest, in front of the face at the finish. 10 is about the least lean
 * that keeps the bar about 11 and the cable about 9 clear of the head, and
 * the bar then lands on the chest with the cable 1.5 degrees off vertical.
 * Each further degree of lean lowers the arms about 2 degrees from
 * overhead, which the real lat feels as a shorter stretch (the proxy does
 * not; see the top of the file), and moves the shoulders farther behind the
 * cable, which raises the moment arm and the share at the top. At 10 the
 * moment arm at t = 0, 0.25, 0.5, 0.75 and 1 is 20, 20, 20, 17, 17 for
 * close; 18, 21, 21, 19, 21 for regular; and 19, 25, 25, 24, 27 for wide.
 * No point in the rep stands out as the hard one, and the cue makes no such
 * claim.
 *
 * The lean is held: rocking back during the pull adds hip extension to what
 * moves the bar.
 */
const LEAN = 10;

/*
 * Seated with the shins upright and the thighs sloping 9.5 down to the
 * knees, the seat top 48 off the floor. At that slope the thighs rest on the
 * front edge of the seat, as they do once the pad presses them down.
 */
const KNEE_DROP = 9.5;
const FLOOR = KNEE_DROP + DIM.shin + DIM.ankle;
const THIGH_RUN = Math.sqrt(DIM.thigh ** 2 - KNEE_DROP ** 2);
/** Half the thigh's thickness, the check's capsule radius. */
const THIGH_R = 7;

/*
 * Knee pad: a roller each side over the thighs, 9 behind the knees, on a
 * post that comes up between the knees from under the seat. It sits on the
 * top of the thigh pressed about 1 into it (the check reads 1.1), the way a
 * pad set snug does.
 */
const PAD_R = 6;
const PAD_Z = 34;
const PAD_Y = KNEE_DROP * (PAD_Z / DIM.thigh) - THIGH_R - PAD_R + 1.2;

/*
 * The leaned pelvis rests on the back edge of its block. The seat top is 0.5
 * above that edge, the give of the cushion.
 */
const SEAT_TOP = (() => {
  const a = rad(LEAN);
  return DIM.pelvis.y1 * Math.cos(a) + DIM.pelvis.b * Math.sin(a) - 0.5;
})();
const SEAT_FRONT = 17;

/** Shoulder to grip at the stretch, 0.2 short of straight: an elbow bend of 9 degrees. */
const REACH = 65.8;

/*
 * Shoulder blade, right side. At the stretch: drawn up 6, out 3 and forward
 * 2, rotated up 40, which suits an arm 150 degrees up. Up to LEAD it drops
 * 3.5 with the arms still straight, which lowers them 1.5 to 3 degrees, and
 * rotates down 1. From there its upward rotation follows the arm at about 0.3
 * of the arm's elevation, the usual share. With the 1, the regular grip's
 * teres proxy is 28.53 at the stretch, 28.03 at LEAD and back up to 28.45 at
 * 0.35. Turning it 3 by LEAD instead made that proxy read longest at 0.3
 * (28.65 against 28.53 at the stretch).
 *
 * It stays out from the spine until mid-rep, which keeps the close grip's
 * upper arms from pressing far into the chest: from 0.4 to 0.95 they
 * sit 1.2 to 1.9 into the torso's surface, inside the 2.5 of soft tissue the
 * check allows. Moving the blade in a straight line from LEAD to the finish
 * makes that 1.7 to 2.5, reaching 2.5 near 0.75, and the check fails at 0.75
 * when only the outward offset moves straight. It finishes down 2.5, in 2.5
 * and back 2.
 */
const LEAD = 0.2;
const SCAP: [number, Record<string, number>][] = [
  [0, { x: 3, y: -6, z: 2, rot: 40 }],
  [LEAD, { x: 3, y: -2.5, z: 1, rot: 39 }],
  [0.65, { x: 1.5, y: 1, z: 0, rot: 18 }],
  [1, { x: -2.5, y: 2.5, z: -2, rot: 6 }],
];

interface Grip {
  /** Hand from the middle of the bar. */
  half: number;
  /** Weight of the outward pull on the elbow from LEAD to 0.75. */
  mid: number;
  /** Weight of the outward pull on the elbow at the finish. */
  flare: number;
  /** Weight of the down-and-back pull on the elbow at the finish. */
  back: number;
}

const HANG: [V3, V3] = [
  [0, 1, 0],
  [0, 1, 0],
];

function pulldown(g: Grip): FigureDef {
  const foot = (x: number) => ({
    foot: { heel: [x, FLOOR, THIGH_RUN - DIM.heel] as V3, dir: [0, 0, 1] as V3 },
    pole: [0, -1, 0.3] as V3,
  });
  const torso = (t: number): Omit<BodySpec, 'armR' | 'armL'> => ({
    pos: [0, 0, 0],
    pelvis: { flex: -LEAN },
    scapR: key(t, SCAP),
    legR: foot(DIM.hipHalf),
    legL: foot(-DIM.hipHalf),
  });
  const bodyOf = (t: number) => solveBody({ ...torso(t), armR: { dirs: HANG }, armL: { dirs: HANG } });

  // The bar hangs straight under the pulley, as high as the arms reach, at
  // the stretch and again at LEAD, after the blades have dropped with the
  // arms still straight. At the finish it is at the upper chest, its center
  // 2.8 in front of the torso's surface.
  const under = (t: number): V3 => {
    const sh = bodyOf(t).j.shoulderR;
    const across = Math.hypot(g.half - sh[0], PULLEY[2] - sh[2]);
    return [0, sh[1] - Math.sqrt(REACH * REACH - across * across), PULLEY[2]];
  };
  const top = under(0);
  const dropped = under(LEAD);
  const chest = bodyOf(1).at('upper', [0, -48, DIM.top.f + 2.5]);
  // From LEAD the bar follows the cable down past the face to the chest.
  const barAt = (t: number): V3 =>
    key(t, [
      [0, top],
      [LEAD, dropped],
      [0.7, [0, chest[1] - 22, (PULLEY[2] + chest[2]) / 2 + 1]],
      [1, chest],
    ]);

  return {
    // The blades show only from behind; from the side, early in the rep, the
    // edge of one shows as a stray mark just inside the outline of the back
    // (measured at t = 0.1 and 0.25). The pad's post adds only another upright
    // line from the front; from behind, the rollers' ends stick out past the
    // hips as tabs ('eq.pad' hides the post with them, which the body covers
    // there anyway), and the low cable shows as a tick under the chin where
    // the head and torso should cover it.
    views: [
      { ...VIEW.front, hide: ['eq.padpost'] },
      { ...VIEW.back, hide: ['eq.pad', 'eq.cablelow'] },
      { ...VIEW.side, hide: ['scap'] },
    ],
    pose: (t) => {
      const spec = torso(t);
      const b = solveBody({ ...spec, armR: { dirs: HANG }, armL: { dirs: HANG } });
      const c = barAt(t);
      const up = norm(sub(PULLEY, c));
      const arm = (side: 1 | -1) => {
        const hand = add(c, [side * g.half, 0, 0]);
        const sh = side === 1 ? b.j.shoulderR : b.j.shoulderL;
        // The elbow goes as near the line of the cable below the hand as the
        // arm allows, so the forearm pulls along the cable. While the arm is
        // nearly straight that line runs along the arm, so the elbow is sent
        // out and back instead. Through mid-rep the outward pull is small, so
        // the elbows travel a little outside the hands, the forearms 12 to 19
        // degrees off the cable's line in the Front view at 0.5; at the
        // finish a close grip flares out more to clear the chest, and the
        // wider grips draw the elbows back.
        const ideal = sub(sub(hand, mul(up, DIM.forearm)), sh);
        const axis = norm(sub(hand, sh));
        const below = norm(sub(ideal, mul(axis, dot(ideal, axis))));
        const out = norm(b.dirOf('upper', [side, 0.2, -0.5]));
        const back = norm(b.dirOf('upper', [side * 0.4, 1, -0.8]));
        const wOut = key(t, [
          [0, 1.5],
          [LEAD, g.mid],
          [0.75, g.mid],
          [1, g.flare],
        ]);
        const wBack = key(t, [
          [0, 0],
          [0.6, 0],
          [1, g.back],
        ]);
        return { ik: hand, pole: add(add(below, mul(out, wOut)), mul(back, wBack)) };
      };
      return { ...spec, armR: arm(1), armL: arm(-1) };
    },
    equipment: (b) => {
      const br = bar('lat', b.j.handR, b.j.handL, { toward: PULLEY });
      // The cable in two pieces, split level with the top of the head, so the
      // Back view can drop the piece the head and torso cover. While the bar
      // is above the head the lower piece has no length and is left out.
      const headTop = b.head.c[1] - b.head.r;
      const a = br.attach;
      const k = a[1] > headTop ? (headTop - PULLEY[1]) / (a[1] - PULLEY[1]) : 1;
      const split = add(PULLEY, mul(sub(a, PULLEY), k));
      return [
        floor(FLOOR),
        box([0, SEAT_TOP + 4, SEAT_FRONT - 19], [36, 8, 38], { part: 'eq.seat' }),
        rail([[0, SEAT_TOP + 8, -2], [0, FLOOR, -2]], { part: 'eq.seatpost' }),
        rail([[0, PAD_Y, PAD_Z], [0, SEAT_TOP + 14, PAD_Z], [0, SEAT_TOP + 14, -2]], { part: 'eq.padpost' }),
        cylinder([3, PAD_Y, PAD_Z], [22, PAD_Y, PAD_Z], PAD_R, { part: 'eq.padR' }),
        cylinder([-3, PAD_Y, PAD_Z], [-22, PAD_Y, PAD_Z], PAD_R, { part: 'eq.padL' }),
        pulley(PULLEY),
        cable(PULLEY, split),
        ...(k < 1 ? [cable(split, a, { part: 'eq.cablelow' })] : []),
        ...br.prims,
      ];
    },
    check: {
      muscles: [
        { m: 'lat', side: 'R' },
        { m: 'lat', side: 'L' },
        { m: 'teresMajor', side: 'R' },
        { m: 'teresMajor', side: 'L' },
      ],
      // Each hand carries half the cable, along the cable.
      load: (b) => {
        const d = sub(PULLEY, mul(add(b.j.handR, b.j.handL), 0.5));
        return [
          { at: b.j.handR, dir: d },
          { at: b.j.handL, dir: d },
        ];
      },
      lever: [
        { joint: 'shoulderR', end: 'elbowR' },
        { joint: 'shoulderL', end: 'elbowL' },
      ],
      contacts: (b) => {
        const low = Math.max(...b.torso.pelvis.slice(0, 4).map((p) => p[1]));
        // Distance from a point to the thigh's line, less the thigh's
        // thickness: the pad's axis less its radius, and the seat's front
        // top edge less the cushion's 0.5 of give.
        const toThigh = (s: 'R' | 'L', p: V3) => {
          const h = b.j[`hip${s}`];
          const kn = b.j[`knee${s}`];
          const u = norm(sub(kn, h));
          const q = add(h, mul(u, Math.max(0, Math.min(dist(h, kn), dot(sub(p, h), u)))));
          return dist(p, q) - THIGH_R;
        };
        const x = (s: 'R' | 'L') => (s === 'R' ? 1 : -1) * DIM.hipHalf;
        return [
          { name: 'heelR on floor', gap: b.j.heelR[1] - FLOOR },
          { name: 'toeR on floor', gap: b.j.toeR[1] - FLOOR },
          { name: 'heelL on floor', gap: b.j.heelL[1] - FLOOR },
          { name: 'toeL on floor', gap: b.j.toeL[1] - FLOOR },
          { name: 'pelvis on seat', gap: SEAT_TOP - low },
          { name: 'thighR under pad', gap: toThigh('R', [12, PAD_Y, PAD_Z]) - PAD_R },
          { name: 'thighL under pad', gap: toThigh('L', [-12, PAD_Y, PAD_Z]) - PAD_R },
          { name: 'thighR on seat front', gap: toThigh('R', [x('R'), SEAT_TOP, SEAT_FRONT]) + 0.5 },
          { name: 'thighL on seat front', gap: toThigh('L', [x('L'), SEAT_TOP, SEAT_FRONT]) + 0.5 },
        ];
      },
    },
  };
}

/* Grip widths are against a 40 shoulder width, joint to joint: hands 36, 60
 * and 78 apart. The lat bar is straight for 76 and bends past that, so the
 * regular grip is 8 inside each bend and the wide grip is at the bends. */
const cues: Record<'pulldownClose' | 'pulldown' | 'pulldownWide', Cue> = {
  pulldownClose: {
    reach: 'Arms straight, reaching up and forward to the bar, with your shoulders drawn up toward your ears.',
    points: [
      ['Setup', 'Sit facing the machine with your feet flat and the knee pad snug on your thighs. Take the lat bar overhand with your hands about shoulder width apart or a little closer.'],
      ['Lean', 'Lean back about 10 degrees from the hips, enough for the bar to clear your face, and hold that lean for the whole set.'],
      ['Stretch', 'At the top, keep your arms straight and let the bar pull your shoulders up toward your ears. The lat is longest with the arm overhead and the shoulder raised.'],
      ['Pull', 'Pull the bar to the top of your chest. Your elbows travel down in front of you and finish pointing down, a little in front of your sides, with your shoulder blades back and down.'],
      ['Avoid', 'Holding your shoulders down at the top, which takes away a large part of the lat\'s stretch. Rocking back as you pull, which lets your hips do part of the work. Leaning back much more than 10 degrees, which lowers your arms from overhead and shortens the stretch.'],
    ],
  },
  pulldown: {
    reach: 'Arms straight, reaching up and forward to the bar, with your shoulders drawn up toward your ears.',
    points: [
      ['Setup', 'Sit facing the machine with your feet flat and the knee pad snug on your thighs. Take the lat bar overhand with your hands about one and a half shoulder widths apart, about a hand\'s width inside each bend.'],
      ['Lean', 'Lean back about 10 degrees from the hips, enough for the bar to clear your face, and hold that lean for the whole set.'],
      ['Stretch', 'At the top, keep your arms straight and let the bar pull your shoulders up toward your ears. The lat is longest with the arm overhead and the shoulder raised.'],
      ['Pull', 'Pull the bar to the top of your chest. Your elbows travel down and out and finish pointing down, in line with your sides, with your shoulder blades back and down.'],
      ['Avoid', 'Holding your shoulders down at the top, which takes away a large part of the lat\'s stretch. Rocking back as you pull, which lets your hips do part of the work. Leaning back much more than 10 degrees, which lowers your arms from overhead and shortens the stretch.'],
    ],
  },
  pulldownWide: {
    reach: 'Arms straight, reaching up and out to the bends of the bar, with your shoulders drawn up toward your ears.',
    points: [
      ['Setup', 'Sit facing the machine with your feet flat and the knee pad snug on your thighs. Take the lat bar overhand with your hands where the bar starts to bend.'],
      ['Lean', 'Lean back about 10 degrees from the hips, enough for the bar to clear your face, and hold that lean for the whole set.'],
      ['Stretch', 'At the top, keep your arms straight and let the bar pull your shoulders up toward your ears. The lat is longest with the arm overhead and the shoulder raised.'],
      ['Pull', 'Pull the bar to the top of your chest. Your elbows travel out to the sides and finish pointing down, in line with your sides, with your shoulder blades back and down.'],
      ['Avoid', 'Holding your shoulders down at the top, which takes away a large part of the lat\'s stretch. Rocking back as you pull, which lets your hips do part of the work. Leaning back much more than 10 degrees, which lowers your arms from overhead and shortens the stretch.'],
    ],
  },
};

export const group: Group = {
  figures: {
    pulldownClose: pulldown({ half: 18, mid: 0.4, flare: 0.8, back: 0.3 }),
    pulldown: pulldown({ half: 30, mid: 0.25, flare: 0.5, back: 1.5 }),
    pulldownWide: pulldown({ half: 39, mid: 0.5, flare: 0.5, back: 1.5 }),
  },
  cues,
  exercises: {
    'close-grip-lat-pulldown': 'pulldownClose',
    'lat-pulldown': 'pulldown',
    'wide-grip-lat-pulldown': 'pulldownWide',
  },
};
