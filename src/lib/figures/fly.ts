/**
 * Crossover flys, high, mid and low.
 *
 * The arms sweep along a great circle between a start and a finish direction,
 * tilted by the pulley height, with the forearm 20 degrees further along the
 * same arc to hold the elbow bend. Headings: upper arm from 34 at the stretch
 * to -92.5 with the hands together in front. The arm path is set against the
 * upper torso. The lean is a hinge at the hips; the upper back extends against
 * it by up to THORACIC_EXT, so the chest faces forward while the hips stay
 * hinged. Legs stand in a staggered stance. The pulleys are fixed in the room,
 * so the cable from each to its hand shows the angle the lean makes with it.
 */
import type { FigureDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { angleBetween, lerpN, slerpDir, sub } from '../figure3d/math';
import { cable, floor, handle, pulley } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, dirHE, mx } from './kit';

/*
 * Upper-back extension, in degrees, between the torso's lower and upper
 * halves. A single rigid torso tipped forward pointed the chest at the floor,
 * which is the slouch the chest-up cue prevents. The upper half tips back this
 * much against the lower, never past upright.
 */
const THORACIC_EXT = 12;

/*
 * Hip joints to floor. 93 straight; the stance has the feet 20 ahead and 20
 * behind with soft knees, the same 0.983 of full leg length hip to ankle that
 * the first fly figures stood with.
 */
const FLOOR = 89;
const STAGGER = 20;

/*
 * The person stands about two steps, an arm's length, in front of the pulley
 * line. At one step the cable at the stretch ran nearly along the arm, so it
 * loaded the shoulder joint and barely turned the arm. Measured as the share of
 * the cable's full leverage on the arm, stretch then finish:
 *
 *   40 in front:  high 43 / 37, mid 20 / 45, low 54 / 71
 *   100 in front: high 79 / 34, mid 76 / 27, low 59 / 55
 *
 * At 100 all three load the stretch at least as hard as the finish. A real
 * station puts each pulley about 130 out from center; 100 is what fits the box.
 */
const PULLEY_BEHIND = 100;
const PULLEY_OUT = 100;

/*
 * How far the right blade, and the shoulder joint on it, shifts from its set
 * position through the rep. At the stretch, opening the arms draws it 2
 * further toward the spine and 3 back. At the finish, reaching across lets it
 * drift 3 out and 2 forward, which holding the blades back keeps small.
 */
const SCAP_STRETCH = { x: -2, z: -3 };
const SCAP_FINISH = { x: 3, z: 2 };

function fly(startElev: number, endElev: number, lean: number, pulleyY: number): FigureDef {
  const d0 = dirHE(34, startElev);
  const d1 = dirHE(-92.5, endElev);
  const lead = 20 / angleBetween(d0, d1);
  const ext = Math.min(lean, THORACIC_EXT);
  const pulleys: V3[] = [
    [PULLEY_OUT, pulleyY, -PULLEY_BEHIND],
    [-PULLEY_OUT, pulleyY, -PULLEY_BEHIND],
  ];
  const foot = (x: number, z: number) => ({
    foot: { heel: [x, FLOOR, z - DIM.heel] as V3, dir: [0, 0, 1] as V3 },
    pole: [0, 0, 1] as V3,
  });
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
        { m: pulleyY > 0 ? 'pecClavicular' : 'pecSternal', side: 'R' },
        { m: pulleyY > 0 ? 'pecClavicular' : 'pecSternal', side: 'L' },
      ],
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
  // Pulley heights are hip-relative: above the head, shoulder height, and 10
  // off the floor. Leans are the usual coaching ranges: more for a high
  // pulley, close to upright for a low one.
  figures: {
    flyHigh: fly(30, -35, 20, -100),
    flyMid: fly(0, 0, 12, -53),
    flyLow: fly(-30, -2, 5, FLOOR - 10),
  },
  cues: {
    flyHigh: {
      reach: 'Arms up and out at the start, with the hands behind the line of your torso.',
      points: [
        'Stand about two steps in front of the pulleys, roughly an arm\'s length. At one step the cable pulls nearly along your arm at the stretch, which loads the shoulder joint more than the pec. At two it pulls across the arm, so the stretch is the hardest point of the rep.',
        'Stagger your feet and lean forward about 20 degrees from the hips with your chest up. Chest up means the upper back stays straight while the hips hinge, so the chest faces forward. The lean sets the angle between the cable and your chest.',
        'The pulley is high, so the hands sweep down and in and finish low in front. That path works the lower and middle fibers of the pec, and those are longest with the arm raised and back.',
        'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
        'Pull your shoulder blades back and down before the first rep. That carries the shoulder joint back, so the arm opens further across the chest and the pec lengthens more. They draw slightly further together as the arms open. As the hands meet, keep them from sliding forward. Letting them go all the way turns the finish into front delt and serratus work.',
      ],
    },
    flyMid: {
      reach: 'Arms out at chest height at the start, with the hands behind the line of your torso.',
      points: [
        'Stand about two steps in front of the pulleys, roughly an arm\'s length. At one step the cable pulls nearly along your arm at the stretch, which loads the shoulder joint more than the pec. At two it pulls across the arm, so the stretch is the hardest point of the rep.',
        'Stagger your feet and lean forward about 12 degrees from the hips with your chest up. Chest up means the upper back stays straight while the hips hinge, so the chest faces forward. The lean sets the angle between the cable and your chest.',
        'The hands travel level and meet in front of the chest. That path works the middle fibers of the pec.',
        'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
        'Pull your shoulder blades back and down before the first rep. That carries the shoulder joint back, so the arm opens further across the chest and the pec lengthens more. They draw slightly further together as the arms open. As the hands meet, keep them from sliding forward. Letting them go all the way turns the finish into front delt and serratus work.',
      ],
    },
    flyLow: {
      reach: 'Arms down and out at the start, with the hands behind the line of your torso.',
      points: [
        'Stand about two steps in front of the pulleys, roughly an arm\'s length. At one step the cable pulls nearly along your arm at the stretch, which loads the shoulder joint more than the pec. At two it pulls across the arm, so the stretch carries at least as much load as the finish.',
        'Stagger your feet and lean forward only slightly, about 5 degrees, from the hips with your chest up. Chest up means the upper back stays straight while the hips hinge, so the chest faces forward. The lean sets the angle between the cable and your chest.',
        'The pulley is low, so the hands sweep up and in and finish high in front. That path works the upper fibers of the pec, the clavicular head, and those are longest with the arm low and back.',
        'Keep a fixed slight elbow bend. If the elbow angle opens and closes it becomes a press, which shortens the path.',
        'Pull your shoulder blades back and down before the first rep. That carries the shoulder joint back, so the arm opens further across the chest and the pec lengthens more. They draw slightly further together as the arms open. As the hands meet, keep them from sliding forward. Letting them go all the way turns the finish into front delt and serratus work.',
      ],
    },
  },
  exercises: {
    'cable-high-crossover-fly': 'flyHigh',
    'cable-mid-crossover-fly': 'flyMid',
    'cable-low-crossover-fly': 'flyLow',
  },
};
