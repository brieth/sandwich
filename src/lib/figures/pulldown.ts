/**
 * Lat pulldowns, close, regular and wide: seated under a knee pad, the lat bar
 * on a pulley overhead.
 *
 * The torso holds one slight lean back through the rep, so only the arms and
 * shoulder blades move. At the top the arms are straight and the blades ride
 * up and rotate upward with them, which is where the lat is longest: it runs
 * from the low back over the bottom of the blade to the front of the upper arm.
 * At the bottom the bar is at the top of the chest with the blades down and
 * together.
 */
import type { FigureDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, sub } from '../figure3d/math';
import { bar, box, cable, cylinder, floor, pulley, rail } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, key } from './kit';

/* Seated: thighs level, shins upright, feet flat. Seat top is the bottom of the pelvis block. */
const SEAT = DIM.pelvis.y1;
const FLOOR = DIM.shin + DIM.ankle;
/** Lean back from upright, degrees, held the whole rep. */
const LEAN = 10;

function pulldown(gripHalf: number): FigureDef {
  // Bar center: overhead at arm's length at the stretch, at the top of the
  // chest at the finish. Solved against the shoulders' positions so the arms
  // are 1 short of straight at the top.
  const top: V3 = [0, -121, 6];
  // Upper chest with the 10 degree lean back is at about (0, -52, 6).
  const chest: V3 = [0, -52, 10];
  const pulleyP: V3 = [0, -165, 8];
  const barAt = (t: number): V3 => key(t, [
    [0, top],
    [0.5, [0, -90, 10]],
    [1, chest],
  ]);
  return {
    views: [VIEW.front, VIEW.back, VIEW.side],
    pose: (t) => {
      const c = barAt(t);
      return {
        pos: [0, 0, 0],
        pelvis: { flex: -LEAN },
        scapR: key(t, [
          [0, { x: 3, y: -6, z: 1, rot: 35 }],
          [1, { x: -2, y: 2, z: -2, rot: 0 }],
        ]),
        // Elbows point out at the top and down and a little back at the bottom.
        armR: { ik: add(c, [gripHalf, 0, 0]), pole: key(t, [[0, [1, 0, -0.2]], [1, [0.35, 1, -0.4]]]) },
        armL: { ik: add(c, [-gripHalf, 0, 0]), pole: key(t, [[0, [-1, 0, -0.2]], [1, [-0.35, 1, -0.4]]]) },
        legR: { foot: { heel: [DIM.hipHalf, FLOOR, DIM.thigh - DIM.heel], dir: [0, 0, 1] }, pole: [0, -1, 0.3] },
        legL: { foot: { heel: [-DIM.hipHalf, FLOOR, DIM.thigh - DIM.heel], dir: [0, 0, 1] }, pole: [0, -1, 0.3] },
      };
    },
    equipment: (b) => {
      const br = bar('lat', b.j.handR, b.j.handL, { toward: pulleyP });
      return [
        floor(FLOOR),
        box([0, SEAT + 4, 4], [40, 8, 36], { part: 'eq.seat' }),
        rail([[0, SEAT + 8, 4], [0, FLOOR, 4]], { part: 'eq.post' }),
        cylinder([-22, -12, DIM.thigh - 6], [22, -12, DIM.thigh - 6], 5, { part: 'eq.kneepad' }),
        pulley(pulleyP),
        cable(pulleyP, br.attach),
        ...br.prims,
      ];
    },
    check: {
      muscles: [
        { m: 'lat', side: 'R' },
        { m: 'lat', side: 'L' },
      ],
      load: (b) => {
        const c = sub(pulleyP, add(b.j.handR, b.j.handL).map((v) => v / 2) as V3);
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
        { name: 'heelR on floor', gap: b.j.heelR[1] - FLOOR },
        { name: 'toeR on floor', gap: b.j.toeR[1] - FLOOR },
        { name: 'heelL on floor', gap: b.j.heelL[1] - FLOOR },
        { name: 'toeL on floor', gap: b.j.toeL[1] - FLOOR },
      ],
    },
  };
}

const pulldownCue = {
    reach: 'Arms fully straight at the top, with the shoulders allowed to rise toward your ears.',
    points: [
      'The lat crosses the shoulder, so it only reaches full length when the shoulder blade rotates upward. Let the weight pull your shoulders up, then pull down from there.',
      'Holding the blade down through the whole rep, which is what packing the shoulders teaches, cuts the stretch to almost nothing.',
    ],
};

/*
 * A first draft, written to try the engine on a seated figure with a bar.
 * Grip half widths: close is about shoulder width, wide reaches the bends.
 */
export const group: Group = {
  figures: {
    pulldownClose: pulldown(19),
    pulldown: pulldown(30),
    pulldownWide: pulldown(40),
  },
  cues: { pulldownClose: pulldownCue, pulldown: pulldownCue, pulldownWide: pulldownCue },
  exercises: {
    'close-grip-lat-pulldown': 'pulldownClose',
    'lat-pulldown': 'pulldown',
    'wide-grip-lat-pulldown': 'pulldownWide',
  },
};
