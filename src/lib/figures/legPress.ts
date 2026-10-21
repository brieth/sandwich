/**
 * Seated leg press and leg extension.
 *
 * Both sit the person on a reclined seat with the hips held still, so only the
 * legs move. The pelvis and torso recline together as one straight line, the
 * flat low back the back pad holds. The seat's rear part follows the pelvis
 * block's bottom face and its front runs on under the thighs, the shape of a
 * contoured cushion, so the block sits on the seat along most of its
 * underside.
 *
 * The drawn pelvis sits 3 off the back pad's face and the waist 2: the box
 * body has no buttocks or lumbar curve to reach it. The pad is placed against
 * the upper back, which the box body does reach.
 */
import type { FigureDef } from '../figure3d/figure';
import type { Body } from '../figure3d/body';
import type { Q, V3 } from '../figure3d/math';
import { add, dist, dot, mul, norm, pitchFwd, qRot, rad, sub } from '../figure3d/math';
import type { PSolid } from '../figure3d/scene';
import { prismFaces } from '../figure3d/scene';
import { box, cylinder, disc, floor, rail } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, key } from './kit';

/* ---------- shared ---------- */

/** A direction in the side plane: degrees from straight down toward forward. */
const sag = (deg: number): V3 => [0, Math.cos(rad(deg)), Math.sin(rad(deg))];

/** Distance from a point to the segment a-b. */
function toSeg(p: V3, a: V3, b: V3): number {
  const d = sub(b, a);
  const k = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d)));
  return dist(p, add(a, mul(d, k)));
}

/** A pad lying in the torso's back plane: from body height y0 to y1, its front face at body depth z. */
function backPad(pos: V3, rot: Q, y0: number, y1: number, z: number, part: string) {
  const thick = 7;
  const c = add(pos, qRot(rot, [0, (y0 + y1) / 2, z - thick / 2]));
  return box(c, [38, y1 - y0, thick], { rot, part });
}

/** The thighs' underside below the hip joints: the check models a thigh as a tube of radius 7. */
const THIGH_UNDER = 7;

/**
 * Seat under a pelvis block reclined by rot, 42 wide. Its top runs along the
 * block's bottom face from the back pad's face until it is kinkY below the
 * hips, then straight on to the front edge at (z, y) = front, under the
 * thighs. The underside runs straight from 8 under the back end to 8 under the
 * front end, which keeps the solid convex.
 */
function reclinedSeat(rot: Q, kinkY: number, front: [number, number], part: string) {
  const back = qRot(rot, [0, DIM.pelvis.y1, -DIM.top.b]);
  const along = qRot(rot, [0, 0, 1]);
  const kink = add(back, mul(along, (kinkY - back[1]) / along[1]));
  const [frontZ, frontY] = front;
  const profile: [number, number][] = [
    [back[2], back[1]],
    [kink[2], kinkY],
    [frontZ, frontY],
    [frontZ, frontY + 8],
    [back[2], back[1] + 8],
  ];
  const prim: PSolid = {
    k: 'solid',
    part,
    group: part,
    verts: [-21, 21].flatMap((x) => profile.map(([z, y]): V3 => [x, y, z])),
    faces: prismFaces(profile.length),
    round: 3,
    w: 2,
    tone: 'equip',
  };
  const lerpY = (z: number, [z0, y0]: [number, number], [z1, y1]: [number, number]) => y0 + ((z - z0) / (z1 - z0)) * (y1 - y0);
  const top = (z: number) => (z <= kink[2] ? lerpY(z, profile[0], profile[1]) : lerpY(z, profile[1], profile[2]));
  const bottom = (z: number) => lerpY(z, profile[4], profile[3]);
  return { prim, back, slopeUp: qRot(rot, [0, -1, 0]), top, bottom };
}

/** A handle along z at h, 12 long, and a strut from its back end down to the seat's side. */
function seatHandle(h: V3, s: number, seat: ReturnType<typeof reclinedSeat>, part: string) {
  const z = h[2] - 6;
  return [
    rail([[h[0], h[1], z], add(h, [0, 0, 6])], { part, w: 3 }),
    rail([[h[0], h[1], z], [s * 21, (seat.top(z) + seat.bottom(z)) / 2, z]], { part: `${part}Mount` }),
  ];
}

/* ---------- leg press ---------- */

/*
 * The plate moves and the seat stays put. Both kinds of machine exist and the
 * joints go through the same angles on either; with a moving seat the whole
 * body would travel and draw teal, which would hide that only the legs work.
 * The plate slides straight along its base, so the feet keep one height.
 *
 * Angles at the bottom, solved in the side plane:
 *   hip flexion against the pelvis 105: about the end of the hip joint's own
 *     range with the pelvis held on the seat. Deeper than this the pelvis has
 *     to tuck under and the lower back rounds off the pad.
 *   ankle dorsiflexion 35: the shin 35 degrees below level with the foot flat
 *     on the upright plate, inside the usual range for an ankle with the knee
 *     bent and the heel down.
 * With the plate upright the knee bend left over is hip flexion + recline -
 * 90 + dorsiflexion. So the back pad's recline sets how far the knees can bend
 * before the pelvis tucks, and so do lower feet, which take more dorsiflexion:
 *   back pad 30 from upright: knees 80
 *   back pad 40: knees 90
 *   back pad 50: knees 100
 * 40 is a usual setting and is what is drawn. The feet are drawn mid-plate.
 *
 * The thigh points 10 degrees out of the pelvis's midline plane at the bottom
 * and 4 at the top (the check's hip abd row). The knees' pole is solved so
 * that the foot, turned out 10, lies 0.9 to 1.0 degrees off the plane of the
 * thigh and shin all rep: the knees track over the toes. With the pole 0.25
 * out it was 3.8 degrees off, and with it 0.15 out 2.0.
 *
 * The plate pushes square to its face, straight back along the base. The
 * check puts the push 5 toward the toes from under the ankle, about halfway
 * from the heel, 4 behind the ankle, to the ball of the foot, 13 ahead of it.
 * Where on the foot it really acts changes the numbers. The cue claims only
 * what holds for any contact point, except at the end of the rep, where it
 * gives the mid-foot push its setup asks for (push through the whole foot).
 * Moment arms per unit of push, at knee bends 90 / 63 / 10 (t = 0 / 0.5 / 1),
 * measured:
 *   knee, push at the heel:        27.6 / 20.1 /   1.6
 *   knee, under the ankle:         23.6 / 16.1 /  -2.4
 *   knee, mid-foot (the check's):  18.7 / 11.1 /  -7.4
 *   knee, ball of the foot:        10.7 /  3.1 / -15.4
 *   hip: 8.6 at the heel to 25.6 at the ball, 17.6 mid-foot, all rep long
 * The knee's arm falls through the rep wherever the push acts. At mid-foot it
 * reaches 0 at about 30 degrees of knee bend (t = 0.89, sampled every 0.05);
 * above that the push would straighten the knees, which the table shows as
 * resists -1 at t = 1. The feet keep one height above the hips, so the hips'
 * arm, and with a steady push the torque on them, stays the same. The check's hip share falls from
 * 26 to 19 only because the feet move farther from the hips.
 */
const LP = {
  recline: 40,
  hip0: 105,
  dorsi0: 35,
  /** Knee bend at the top, just short of locked. Solved in the side plane; with the feet wider than the hip joints the check reads 10. */
  knee1: 12,
  /** Heels out from the midline, and toes turned out. */
  heelX: 14,
  toeOut: 10,
  /** Hip joints above the floor. */
  floor: 50,
};
const LP_ROT = pitchFwd(-LP.recline);
const LP_K0 = LP.hip0 + LP.recline - 90 + LP.dorsi0;

/** Foot pointing up the plate with its toes turned out, for the side s (+1 right). */
const lpFootDir = (s: number): V3 => norm([s * Math.sin(rad(LP.toeOut)), -Math.cos(rad(LP.toeOut)), 0]);

/** Ankle at the bottom, from the hip joint, in the side plane. */
const LP_ANKLE0: V3 = add(mul(sag(LP.hip0 + LP.recline), DIM.thigh), mul(sag(LP.hip0 + LP.recline - LP_K0), DIM.shin));
/** How far the plate travels so the knees finish at knee1. */
const LP_TRAVEL = (() => {
  const reach = Math.sqrt(DIM.thigh ** 2 + DIM.shin ** 2 + 2 * DIM.thigh * DIM.shin * Math.cos(rad(LP.knee1)));
  return Math.sqrt(reach ** 2 - LP_ANKLE0[1] ** 2) - LP_ANKLE0[2];
})();
/** The plate's face at t, where the soles sit. */
const lpPlateZ = (t: number) => LP_ANKLE0[2] + DIM.ankle + LP_TRAVEL * t;
/** Heel on the plate for side s at t. */
const lpHeel = (s: number, t: number): V3 => {
  const f = lpFootDir(s);
  const ankle: V3 = [s * LP.heelX + DIM.heel * f[0], LP_ANKLE0[1], lpPlateZ(t) - DIM.ankle];
  return add(add(ankle, [0, 0, DIM.ankle]), mul(f, -DIM.heel));
};
/** Middle of the foot's pressure on the plate: 5 toward the toes from under the ankle, halfway from the heel to the ball. */
const lpPress = (b: Body, s: 'R' | 'L'): V3 => add(add(b.j[`ankle${s}`], [0, 0, DIM.ankle]), mul(lpFootDir(s === 'R' ? 1 : -1), 5));

/*
 * Seat: up the pelvis block's bottom face to 3 below the hips, then on under
 * the thighs to 19 forward, 2 below the hips. Solved against the check, which
 * flags a limb more than 2 into equipment. At the top of the rep the thighs,
 * which the check models as tubes of radius 7 right up to the hip joint, read
 * 2.5 into the seat with the bend at 2 below the hips, 2.2 at 2.5 and 1.8 at
 * 3: the soft underside of a real thigh presses that far into a cushion. With
 * the bend at 3 the pelvis block's front corner sits 1.6 above the seat,
 * where a real body has the top of the thigh. A bend at 4 takes the thighs to
 * 1.1 into the seat but lifts the corner 2.2 off it, past the 2 its contact
 * allows.
 */
const LP_SEAT = reclinedSeat(LP_ROT, 3, [19, 2], 'eq.seat');
/** Handles on the sides of the seat, just ahead of the hips. */
const LP_HANDLE = (s: number): V3 => [s * 27, 9, 5];

const legPress: FigureDef = {
  // Side shows the depth and the plate's travel; top shows the stance width
  // and the knees tracking out over the feet.
  views: [{ ...VIEW.side }, { ...VIEW.top, turn: -90 }],
  pose: (t) => ({
    pos: [0, 0, 0],
    rot: LP_ROT,
    neck: { flex: 22 },
    armR: { ik: LP_HANDLE(1), pole: [0.6, 0.6, -0.6] },
    armL: { ik: LP_HANDLE(-1), pole: [-0.6, 0.6, -0.6] },
    legR: { foot: { heel: lpHeel(1, t), dir: lpFootDir(1), up: [0, 0, -1] }, pole: [0.2, -1, 0.2] },
    legL: { foot: { heel: lpHeel(-1, t), dir: lpFootDir(-1), up: [0, 0, -1] }, pole: [-0.2, -1, 0.2] },
  }),
  equipment: (_b, t) => {
    const pz = lpPlateZ(t);
    const postZ = 4;
    return [
      floor(LP.floor),
      LP_SEAT.prim,
      backPad([0, 0, 0], LP_ROT, -64, 10, -DIM.top.b, 'eq.backpad'),
      rail([[0, LP_SEAT.bottom(postZ), postZ], [0, LP.floor, postZ]], { part: 'eq.post' }),
      // The base lies on the floor under the plate's whole travel and the
      // carriage post rides it. From above it shows the plate's track; from
      // the side it lies along the floor line, which is drawn 1 box unit
      // below the floor, 0.75 at this figure's scale of 1.35, so the base
      // sits that much lower to lie on it.
      rail([[0, LP.floor + 0.75, postZ - 12], [0, LP.floor + 0.75, lpPlateZ(1) + 8]], { part: 'eq.base' }),
      rail([[0, LP_ANKLE0[1] + 14, pz + 4], [0, LP.floor, pz + 4]], { part: 'eq.carriage' }),
      box([0, LP_ANKLE0[1] - 10, pz + 2], [64, 48, 4], { part: 'eq.plate' }),
      ...seatHandle(LP_HANDLE(1), 1, LP_SEAT, 'eq.handleR'),
      ...seatHandle(LP_HANDLE(-1), -1, LP_SEAT, 'eq.handleL'),
    ];
  },
  check: {
    muscles: [
      { m: 'quadsVasti', side: 'R' },
      { m: 'quadsVasti', side: 'L' },
      { m: 'gluteMax', side: 'R' },
      { m: 'gluteMax', side: 'L' },
    ],
    load: (b) => [
      { at: lpPress(b, 'R'), dir: [0, 0, -1] },
      { at: lpPress(b, 'L'), dir: [0, 0, -1] },
      { at: lpPress(b, 'R'), dir: [0, 0, -1] },
      { at: lpPress(b, 'L'), dir: [0, 0, -1] },
    ],
    lever: [
      { joint: 'kneeR', end: 'ankleR' },
      { joint: 'kneeL', end: 'ankleL' },
      { joint: 'hipR', end: 'kneeR' },
      { joint: 'hipL', end: 'kneeL' },
    ],
    contacts: (b, t) => {
      const pz = lpPlateZ(t);
      return [
        { name: 'heelR on plate', gap: pz - b.j.heelR[2] },
        { name: 'toeR on plate', gap: pz - b.j.toeR[2] },
        { name: 'heelL on plate', gap: pz - b.j.heelL[2] },
        { name: 'toeL on plate', gap: pz - b.j.toeL[2] },
        { name: 'upper back on pad', gap: dot(b.at('upper', [0, DIM.top.y, -DIM.top.b]), qRot(LP_ROT, [0, 0, 1])) + DIM.top.b },
        { name: 'pelvis back on seat', gap: dot(sub(b.at('pelvis', [0, DIM.pelvis.y1, -DIM.pelvis.b]), LP_SEAT.back), LP_SEAT.slopeUp) },
        { name: 'pelvis front over seat', gap: (() => { const c = b.at('pelvis', [0, DIM.pelvis.y1, DIM.pelvis.f]); return LP_SEAT.top(c[2]) - c[1]; })(), tol: 2 },
        { name: 'handR in hand', gap: dist(b.j.handR, LP_HANDLE(1)) },
      ];
    },
  },
};

/* ---------- leg extension ---------- */

/*
 * The back pad's recline sets the hip angle with the thigh level on the seat:
 * hip flexion is 90 minus the recline. The rectus femoris crosses the hip, so
 * a smaller hip angle lengthens it. Its proxy at the bottom (knees bent 110)
 * and the top (knees straight):
 *   back pad upright: hip 90, rectus femoris 42.9 / 35.2
 *   back pad 15:      hip 75, 44.6 / 36.9
 *   back pad 30:      hip 60, 46.7 / 39.0
 * The vasti are the same in all three. 30 puts the rectus femoris at the
 * bottom 3.8 longer than sitting upright, half what the knee bend itself adds,
 * and is about as far as a leg extension's back pad reclines.
 */
const LE = {
  recline: 30,
  knee0: 110,
  knee1: 0,
  /** Pad center along the shin from the knee, and the roller's radius. */
  padAlong: 33,
  roller: 5.5,
  /**
   * Front of the lower shin in front of the knee-to-ankle line: the tibia
   * under thin skin, about 3 to 4. The roller sits on it.
   */
  shinFront: 3.5,
  /** Hip joints above the floor. */
  floor: 60,
  /** Pivot out from the midline, on the right. */
  pivotX: 26,
  /** Seat front edge behind the knee joint, so the calf clears it at the bottom. */
  seatFront: 13,
};
const LE_KNEE: V3 = [0, 0, DIM.thigh];
/** Shin direction at knee bend k, thigh level and forward. */
const leShin = (k: number): V3 => [0, Math.sin(rad(k)), Math.cos(rad(k))];
/** The front of the shin, square to it and facing forward or up. */
const leFront = (k: number): V3 => [0, -Math.cos(rad(k)), Math.sin(rad(k))];
const leKnee = (t: number) => key(t, [[0, LE.knee0], [1, LE.knee1]]);
/** Roller center relative to a knee. */
const leRoller = (k: number): V3 => add(mul(leShin(k), LE.padAlong), mul(leFront(k), LE.shinFront + LE.roller));
/** Handles on the sides of the seat, beside the hips. */
const LE_HANDLE = (s: number): V3 => [s * 27, 11, 2];

function legExtension(recline: number): FigureDef {
  const rot = pitchFwd(-recline);
  // The seat's top runs up the pelvis block's bottom face until it meets the
  // level thighs' underside, then level to its front edge.
  const seat = reclinedSeat(rot, THIGH_UNDER, [DIM.thigh - LE.seatFront, THIGH_UNDER], 'eq.seat');
  const pivot: V3 = [LE.pivotX, LE_KNEE[1], LE_KNEE[2]];
  const postZ = 14;
  return {
    // Side shows the recline, the knee bend and the pivot ringing the knee.
    // Top shows the roller across both shins, the lever beside the right knee
    // and the handles beside the seat. From the front the shins swing toward
    // the camera and shrink to dots, and the right hand, pivot and lever line
    // up, so there is no front view.
    views: [{ ...VIEW.side }, { ...VIEW.top, turn: -90 }],
    pose: (t) => {
      const k = leKnee(t);
      const s = leShin(k);
      const foot = { dir: leFront(k), up: mul(s, -1) };
      return {
        pos: [0, 0, 0],
        rot,
        neck: { flex: 18 },
        armR: { ik: LE_HANDLE(1), pole: [1, 0.3, -0.6] },
        armL: { ik: LE_HANDLE(-1), pole: [-1, 0.3, -0.6] },
        legR: { dirs: [[0, 0, 1], s], frame: 'world' },
        legL: { dirs: [[0, 0, 1], s], frame: 'world' },
        footR: foot,
        footL: foot,
      };
    },
    equipment: (_b, t) => {
      const rc = leRoller(leKnee(t));
      return [
        floor(LE.floor),
        seat.prim,
        backPad([0, 0, 0], rot, -62, 9, -DIM.top.b, 'eq.backpad'),
        rail([[0, seat.bottom(postZ), postZ], [0, LE.floor, postZ]], { part: 'eq.post' }),
        disc(pivot, [1, 0, 0], 6, 4, { part: 'eq.pivot' }),
        rail([pivot, add(pivot, rc)], { part: 'eq.lever', w: 3 }),
        cylinder(add(LE_KNEE, add(rc, [-17, 0, 0])), add(LE_KNEE, add(rc, [LE.pivotX + 2, 0, 0])), LE.roller, { part: 'eq.roller' }),
        ...seatHandle(LE_HANDLE(1), 1, seat, 'eq.handleR'),
        ...seatHandle(LE_HANDLE(-1), -1, seat, 'eq.handleL'),
      ];
    },
    check: {
      muscles: [
        { m: 'quadsVasti', side: 'R' },
        { m: 'quadsVasti', side: 'L' },
        { m: 'rectusFemoris', side: 'R' },
        { m: 'rectusFemoris', side: 'L' },
      ],
      // The roller presses on the front of each shin, square to it.
      load: (b, t) => {
        const k = leKnee(t);
        return (['R', 'L'] as const).map((s) => ({
          at: add(b.j[`knee${s}`], add(mul(leShin(k), LE.padAlong), mul(leFront(k), LE.shinFront))),
          dir: mul(leFront(k), -1),
        }));
      },
      lever: [
        { joint: 'kneeR', end: 'ankleR' },
        { joint: 'kneeL', end: 'ankleL' },
      ],
      contacts: (b, t) => {
        const rc = add(LE_KNEE, leRoller(leKnee(t)));
        const axis = (x: number): V3 => [x, rc[1], rc[2]];
        // The thigh's underside where it crosses the seat's front edge.
        const thighAtEdge = (s: 'R' | 'L') => {
          const h = b.j[`hip${s}`];
          const kn = b.j[`knee${s}`];
          return add(h, mul(sub(kn, h), (DIM.thigh - LE.seatFront - h[2]) / (kn[2] - h[2])))[1] + THIGH_UNDER;
        };
        return [
          { name: 'shinR on roller', gap: toSeg(axis(b.j.kneeR[0]), b.j.kneeR, b.j.ankleR) - LE.shinFront - LE.roller },
          { name: 'shinL on roller', gap: toSeg(axis(b.j.kneeL[0]), b.j.kneeL, b.j.ankleL) - LE.shinFront - LE.roller },
          { name: 'kneeR on the pivot axis', gap: Math.hypot(b.j.kneeR[1] - pivot[1], b.j.kneeR[2] - pivot[2]) },
          { name: 'upper back on pad', gap: dot(b.at('upper', [0, DIM.top.y, -DIM.top.b]), qRot(rot, [0, 0, 1])) + DIM.top.b },
          { name: 'pelvis back on seat', gap: dot(sub(b.at('pelvis', [0, DIM.pelvis.y1, -DIM.pelvis.b]), seat.back), seat.slopeUp) },
          { name: 'thighR on seat edge', gap: THIGH_UNDER - thighAtEdge('R') },
          { name: 'handR in hand', gap: dist(b.j.handR, LE_HANDLE(1)) },
        ];
      },
    },
  };
}

export const group: Group = {
  figures: { legPress, legExtension: legExtension(LE.recline) },
  cues: {
    legPress: {
      reach: 'Knees bent as far as they go before your pelvis starts to tuck off the seat.',
      points: [
        'Sit with your hips on the seat and your back flat on the back pad, the back pad reclined about 40 degrees from upright. Put your feet flat in the middle of the plate, about hip width apart, with the toes turned out about 10 degrees. Keep your knees in line with your toes through the rep. Push through the whole foot with the heels down. Hold the handles at the sides of the seat.',
        'The quads are longest with the knees bent the most, and the glutes are longest with the hips bent the most. Bend your knees and let the plate come toward you, and stop just before your pelvis starts to tuck under and roll up off the seat. Going deeper tucks the pelvis and rounds the lower back without bending the hips much further.',
        'Set the seat so you can reach that depth without the weight stack touching down. Placing your feet lower on the plate lets the knees bend further before the pelvis tucks, which lengthens the quads. Keep your heels flat when you do. If the back pad adjusts, more recline also lets the knees bend further before the pelvis tucks.',
        'Stop with the knees just short of locked. The plate resists the knees most at the stretch and less as they straighten. When you push through the whole foot, the plate stops loading the knees once they are bent less than about 30 degrees, and after that it pushes them toward locked. Your feet are above your hips, so the plate resists the hips all the way to the finish and the glutes keep working.',
      ],
    },
    legExtension: {
      reach: 'Knees bent as far as the machine allows at the bottom, with the back pad reclined about 30 degrees from upright.',
      points: [
        'Sit back against the back pad and move it forward or back until your knees line up with the pivot of the moving arm. Set the shin pad on the front of your lower shins, just above the ankles. With your knees on the pivot, the shin pad stays in one place on your shins and presses square to them through the whole rep. Hold the handles at the sides of the seat.',
        'If the back pad adjusts, recline it about 30 degrees from upright, or as far as it goes if that is less. With your thighs level on the seat, your hips are then bent about 60 degrees. The rectus femoris crosses both the hip and the knee, so it is longer with the hip less bent. Sitting upright bends the hips about 90 degrees and shortens it.',
        'All four quad muscles get longer the more the knees bend. Set the start position so your knees are bent as far as the machine allows, and straighten them fully at the finish.',
        'Keep your back on the pad as you lift. Leaning forward bends the hips and shortens the rectus femoris.',
      ],
    },
  },
  exercises: {
    'machine-leg-press': 'legPress',
    'machine-leg-extension': 'legExtension',
  },
};
