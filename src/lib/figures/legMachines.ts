/**
 * Seated leg machines: the seated leg curl, the hip abductor and the hip
 * adductor.
 *
 * Leg curl: thighs level and clamped just above the knees, the lever's pivot
 * on the knee's axis, the lower pad behind the lower calves, the hips back
 * against the bottom of the back pad. The torso leans forward a little from
 * the hips and holds still; only the shins and feet move, from a straight
 * knee to a knee bent as far as the machine goes.
 *
 * Hip machines: the thighs level, the knees bent 90 degrees and the feet on
 * bars that swing with the knee pads, so each whole leg turns about a vertical
 * axis through its hip, over the pivot of its arm. The abductor's pads sit
 * outside the knees with the back reclined; the adductor's sit inside the
 * knees with the back upright.
 */
import type { Body } from '../figure3d/body';
import type { FigureDef, ViewDef } from '../figure3d/figure';
import type { Q, V3 } from '../figure3d/math';
import { add, deg, dist, dot, mul, pitchFwd, qRot, rad, sub, turnRight } from '../figure3d/math';
import { box, cylinder, disc, floor, rail } from '../figure3d/equipment';
import type { PDot, PSolid, Prim } from '../figure3d/scene';
import { prismFaces } from '../figure3d/scene';
import type { Group } from './kit';
import { DIM, VIEW, key } from './kit';

/* ---------- shared ---------- */

/** Bottom ring of the pelvis block, in body coordinates: what sits on a seat. */
const PELVIS_BOTTOM: V3[] = [
  [-DIM.pelvis.w, DIM.pelvis.y1, -DIM.pelvis.b],
  [DIM.pelvis.w, DIM.pelvis.y1, -DIM.pelvis.b],
  [DIM.pelvis.w, DIM.pelvis.y1, DIM.pelvis.f],
  [-DIM.pelvis.w, DIM.pelvis.y1, DIM.pelvis.f],
];

/** The lowest bottom corner of a pelvis turned by q, moved to the midline: where the seat top touches. */
function seatPoint(q: Q): V3 {
  const p = PELVIS_BOTTOM.map((c) => qRot(q, c)).reduce((a, c) => (c[1] > a[1] ? c : a));
  return [0, p[1], p[2]];
}

/** Distance from a point to a segment. */
function toSeg(p: V3, a: V3, b: V3): number {
  const d = sub(b, a);
  const k = Math.max(0, Math.min(1, dot(sub(p, a), d) / dot(d, d)));
  return dist(p, add(a, mul(d, k)));
}

/** How far the nearest of some points stands in front of a pad's face: the plane through `on` facing along `n`. */
const clearOf = (pts: V3[], on: V3, n: V3) => Math.min(...pts.map((p) => dot(sub(p, on), n)));

/** A machine's pivot, drawn as a ring. */
const pivot = (p: V3, part = 'eq.pivot'): PDot => ({ k: 'dot', part, p, r: 3, ring: true, tone: 'equip', lift: 0 });

const SIDES = ['R', 'L'] as const;
type Side = (typeof SIDES)[number];
const sgn = (s: Side) => (s === 'R' ? 1 : -1);

type Contact = { name: string; gap: number; tol?: number };

const pelvisOnSeat = (b: Body, seatY: number): Contact => ({
  name: 'pelvis on seat',
  gap: seatY - Math.max(...b.torso.pelvis.slice(0, 4).map((p) => p[1])),
});

/* ---------- seated leg curl ---------- */

/*
 * Torso lean, degrees forward of upright, as a hinge at the hips; the hip is
 * bent 90 plus this. The hamstrings proxy at the stretch (knees straight), by
 * lean, negative reclined:
 *
 *   -12: 50.2   -10: 50.4   0: 51.4   +10: 52.2   +20: 52.8
 *
 * Leaning back onto the pad's upper part is the -12 row. With the lean at 10,
 * rolling the pelvis back 12 and rounding the lower back 12 to keep the
 * torso where it was reads 51.3: about what leaning back the same 12 degrees
 * does, and about half the 2.0 that leaning back onto the pad costs.
 *
 * The knee's whole range, straight to bent 120 degrees, takes off about 6.3,
 * so a forward lean of 10 degrees adds 0.8 at the stretch, about an eighth of
 * the rep's range. The limit is flexibility: upright with the knees straight,
 * the hip and knee are already where a typical straight-leg raise stops,
 * about 80 to 90 degrees, so leaning further only helps someone whose knees
 * still straighten fully. The drawing shows a modest lean of 10 and the cue
 * makes it conditional on the knees straightening.
 */
const CURL_LEAN = 10;
/** Knee flexion at the finish, degrees: about as far as a seated curl's arm travels. */
const CURL_KNEE_END = 120;
/** Lower pad center along the shin from the knee: behind the lower calf, just above the ankle. */
const CURL_PAD_AT = 35;
const CURL_PAD_R = 5;
const CURL_THIGH_PAD_R = 5.5;
/** Thigh pad center along the thigh from the hip: just above the knee. */
const CURL_THIGH_PAD_AT = 36;
/** Back pad, reclined from vertical, degrees. The hips rest on its bottom; the torso leans forward off it. */
const CURL_BACK_RECLINE = 12;
/** Pivot and lever on the person's right, outside the knee, on the knee's axis. */
const CURL_PIVOT_X = 27;

function legCurl(): FigureDef {
  const qPel = pitchFwd(CURL_LEAN);
  const seatTop = seatPoint(qPel)[1];
  // Seat top 52 above the floor. The feet clear the floor by about 10 at their
  // lowest, near the finish (10.2 measured at t = 0.92).
  const floorY = seatTop + 52;
  const flexAt = (t: number) => rad(key(t, [[0, 0], [1, CURL_KNEE_END]]));
  // Shin from knee to ankle, and the front of the shin, which the pad pushes toward.
  const shin = (t: number): V3 => [0, Math.sin(flexAt(t)), Math.cos(flexAt(t))];
  const front = (t: number): V3 => [0, -Math.cos(flexAt(t)), Math.sin(flexAt(t))];
  const padCenter = (t: number): V3 =>
    add(add([0, 0, DIM.thigh], mul(shin(t), CURL_PAD_AT)), mul(front(t), -(5 + CURL_PAD_R)));
  const handle = (s: Side): V3 => [sgn(s) * 24, seatTop - 6, 14];
  const thighPad: V3 = [0, -(7 + CURL_THIGH_PAD_R), CURL_THIGH_PAD_AT];
  const pivotP: V3 = [CURL_PIVOT_X, 0, DIM.thigh];
  // Back pad: its face runs up and back from the seat and touches the back
  // bottom corner of the pelvis. The rigid pelvis block, leaned 10, rests on
  // its front bottom edge, and that back corner sits 3.6 above the seat top.
  const br = pitchFwd(-CURL_BACK_RECLINE);
  const padUp = qRot(br, [0, -1, 0]);
  const padBack = qRot(br, [0, 0, -1]);
  const pelvisBack = qRot(qPel, [0, DIM.pelvis.y1, -DIM.pelvis.b]);
  const backBase: V3 = [0, seatTop, pelvisBack[2] + (seatTop - pelvisBack[1]) * Math.tan(rad(CURL_BACK_RECLINE))];
  return {
    // The side shows everything that changes. The top shows what the side
    // stacks on top of itself: the thigh pad and the lower pad across both
    // legs, the lever outside the right knee and the handles beside the seat.
    // Past mid-rep the shins fold under the thighs and it shows little more
    // than the knees. From the front the legs point at the camera and the pads
    // hide the shins, which adds nothing.
    views: [VIEW.side, { ...VIEW.top, turn: -90 }],
    pose: (t) => {
      const sd = shin(t);
      const leg = { dirs: [[0, 0, 1], sd] as [V3, V3], frame: 'world' as const };
      // Ankle held at a right angle, so the foot turns with the shin.
      const foot = { dir: front(t), up: mul(sd, -1) };
      return {
        pos: [0, 0, 0],
        pelvis: { flex: CURL_LEAN },
        armR: { ik: handle('R'), pole: [0.6, 0, -1] },
        armL: { ik: handle('L'), pole: [-0.6, 0, -1] },
        legR: leg,
        legL: leg,
        footR: foot,
        footL: foot,
      };
    },
    equipment: (_b, t) => {
      const pc = padCenter(t);
      const prims: Prim[] = [
        floor(floorY),
        // Ends 19 short of the knee, so the shin clears it at the finish.
        box([0, seatTop + 4, 2], [36, 8, 46], { part: 'eq.seat' }),
        rail([[0, seatTop + 8, 2], [0, floorY, 2]], { part: 'eq.post' }),
        box(add(backBase, add(mul(padUp, 25), mul(padBack, 3.5))), [32, 50, 7], { rot: br, part: 'eq.backpad' }),
        cylinder([-20, thighPad[1], thighPad[2]], [20, thighPad[1], thighPad[2]], CURL_THIGH_PAD_R, { part: 'eq.thighpad' }),
        rail([[20, thighPad[1], thighPad[2]], [CURL_PIVOT_X, thighPad[1], thighPad[2]], [CURL_PIVOT_X, -4, DIM.thigh]], { part: 'eq.thighpost' }),
        // A disc wider than the knee dot, as on the leg extension, so the
        // knee reads as sitting on the pivot.
        disc(pivotP, [1, 0, 0], 6, 4, { part: 'eq.pivot' }),
        cylinder([-20, pc[1], pc[2]], [20, pc[1], pc[2]], CURL_PAD_R, { part: 'eq.calfpad' }),
        rail([pivotP, [CURL_PIVOT_X, pc[1], pc[2]], [20, pc[1], pc[2]]], { part: 'eq.lever' }),
      ];
      for (const s of SIDES) {
        const h = handle(s);
        prims.push(
          rail([add(h, [0, 0, -7]), add(h, [0, 0, 7])], { part: 'eq.handle', w: 3 }),
          rail([add(h, [0, 0, -7]), [sgn(s) * 18, seatTop + 4, h[2] - 7]], { part: 'eq.handlepost' }),
        );
      }
      return prims;
    },
    check: {
      muscles: [
        { m: 'hamstrings', side: 'R' },
        { m: 'hamstrings', side: 'L' },
      ],
      // A roller pad pushes along the normal to the shin wherever the pivot
      // is, so the share reads 100 by construction. What the pivot on the
      // knee's axis does is keep the pad at one place on the calf.
      load: (b, t) => SIDES.map((s) => ({ at: add(b.j[`knee${s}`], mul(shin(t), CURL_PAD_AT)), dir: front(t) })),
      lever: [
        { joint: 'kneeR', end: 'ankleR' },
        { joint: 'kneeL', end: 'ankleL' },
      ],
      contacts: (b, t) => {
        const pc = padCenter(t);
        const res: Contact[] = [
          pelvisOnSeat(b, seatTop),
          { name: 'hips against back pad', gap: clearOf(b.torso.pelvis, backBase, mul(padBack, -1)) },
        ];
        for (const s of SIDES) {
          const x = sgn(s) * DIM.hipHalf;
          res.push(
            { name: `thigh${s} under thigh pad`, gap: toSeg([x, thighPad[1], thighPad[2]], b.j[`hip${s}`], b.j[`knee${s}`]) - 7 - CURL_THIGH_PAD_R },
            { name: `calf${s} on lower pad`, gap: toSeg([x, pc[1], pc[2]], b.j[`knee${s}`], b.j[`ankle${s}`]) - 5 - CURL_PAD_R },
            { name: `knee${s} on pivot axis`, gap: Math.hypot(b.j[`knee${s}`][1] - pivotP[1], b.j[`knee${s}`][2] - pivotP[2]) },
            { name: `hand${s} on handle`, gap: dist(b.j[`hand${s}`], handle(s)) },
          );
        }
        return res;
      },
    },
  };
}

/* ---------- hip abductor and adductor ---------- */

/*
 * Back recline, degrees from vertical, with the thighs level: the hip is bent
 * 90 minus this. The proxies at the stretch and the finish, by recline, for
 * the widths drawn here (abductor knees together to 45 out, adductor the
 * reverse):
 *
 *   recline   hip bent   gluteMed           adductors
 *    0         90        11.4 to 11.4, 0%   23.9 to 16.7, 30%
 *   15         75        12.0 to 10.8, 10%  23.3 to 15.6, 33%
 *   30         60        12.5 to 10.3, 18%  23.1 to 15.2, 34%
 *   40         50        12.8 to 10.0, 22%  23.2 to 15.4, 34%
 *
 * With the hip bent 90 the glute medius barely changes length through the
 * rep; as the hip opens it starts longer and shortens more, so the abductor
 * is drawn reclined 30, the common build of the machine. The adductors run
 * the other way: upright they are longest at the stretch, by 0.8 against the
 * 7.2 the width gives. The proxy runs from the pubis, so it leaves out the
 * part of the adductor magnus that starts at the sit bone, which bending the
 * hip lengthens as it does the hamstrings. A path from the hamstrings' sit
 * bone landmark to the thigh bone 38 from the hip reads 45.6 upright, 44.5 at
 * 15, 43.2 at 30 and 42.2 at 40, and hardly changes through the rep, so it is
 * not a check proxy. The adductor is drawn upright on a flat seat.
 */
interface HipKind {
  recline: number;
  /** Tilt of the seat's rear part, front up, degrees: the slope under the pelvis. */
  seatTilt: number;
  /** Seat front edge, cm forward of the hip joints. */
  seatFront: number;
  /** Thigh heading out from straight ahead at t = 0 and t = 1, degrees. */
  phi: [number, number];
  /** Right handle, in the room, and where the right elbow points; the left mirrors both. */
  handle: V3;
  pole: V3;
}

/*
 * Thigh heading out from straight ahead at the widest, degrees, for the
 * abductor's finish and the adductor's start. Both machines open to about 45
 * per side, within what a hip bent 60 to 90 degrees allows. The knees are
 * then about 82 apart, center to center.
 */
const HIP_WIDE = 45;
/** Knee pad thickness, and how far the pad's center sits from the knee's center. */
const KNEE_PAD_T = 4;
const KNEE_PAD_OFF = 7 + KNEE_PAD_T / 2;
/** Knees together on the abductor: the thighs touching, knee centers 13 apart. */
const KNEES_TOUCH = deg(Math.asin((6.5 - DIM.hipHalf) / DIM.thigh));
/** Knees together on the adductor: the two pads meet between them. */
const PADS_MEET = deg(Math.asin((7 + KNEE_PAD_T - DIM.hipHalf) / DIM.thigh));

/** The thighs' underside below the hips: the check models a thigh as a tube of radius 7. */
const THIGH_UNDER = 7;

const HIP_KINDS: Record<'abd' | 'add', HipKind> = {
  /*
   * Reclined 30, the rigid pelvis block tips back onto its rear bottom edge,
   * 6.8 lower than the level thighs' underside. A flat seat cannot hold both:
   * tilted 10 through that edge it left the thighs 3.6 above it 12 forward of
   * the hips, meeting them only near 33 forward. So the seat's rear part
   * slopes up 25 degrees from that edge until it meets the thighs, 9 forward
   * of the hips, and the rest runs level under them, the shape of a contoured
   * seat cushion. The slope stays under the pelvis's bottom face, which is
   * tilted 30.
   */
  abd: { recline: 30, seatTilt: 25, seatFront: 30, phi: [KNEES_TOUCH, HIP_WIDE], handle: [27, 15.8, -7.9], pole: [1, 0, -0.4] },
  add: { recline: 0, seatTilt: 0, seatFront: 28, phi: [HIP_WIDE, PADS_MEET], handle: [27, 8, 4], pole: [0.3, 0, -1] },
};

/*
 * Front, raised 35 degrees. From level, the thighs point at the camera and the
 * knee pads hide them. From above, both thighs draw whole and the pads sit
 * beside the knees. The arms under the seat are left to the side view.
 */
const FRONT_HIGH: ViewDef = {
  label: 'Front',
  cam: { dir: [0, -Math.sin(rad(35)), Math.cos(rad(35))], up: [0, -Math.cos(rad(35)), -Math.sin(rad(35))], right: [1, 0, 0] },
  hide: ['eq.arm', 'eq.pivot'],
};

function hipMachine(kind: 'abd' | 'add'): FigureDef {
  const K = HIP_KINDS[kind];
  const qPel = pitchFwd(-K.recline);
  const low = seatPoint(qPel);
  const phi = (t: number) => key(t, [[0, K.phi[0]], [1, K.phi[1]]]);
  // The thigh's heading in the room, level, and the direction out from it toward its own side.
  const along = (s: Side, t: number): V3 => [sgn(s) * Math.sin(rad(phi(t))), 0, Math.cos(rad(phi(t)))];
  const out = (s: Side, t: number): V3 => [sgn(s) * Math.cos(rad(phi(t))), 0, -Math.sin(rad(phi(t)))];
  const turn = (s: Side, t: number): Q => turnRight(sgn(s) * phi(t));
  const hip = (s: Side): V3 => [sgn(s) * DIM.hipHalf, 0, 0];
  const knee = (s: Side, t: number): V3 => add(hip(s), mul(along(s, t), DIM.thigh));
  // Pads press on the side of the knee the movement pushes toward.
  const padSide = kind === 'abd' ? 1 : -1;
  const padCenter = (s: Side, t: number): V3 => add(knee(s, t), mul(out(s, t), padSide * KNEE_PAD_OFF));
  // Seat top about 60 above the floor, so the foot bars sit about 18 up.
  const floorY = 70;
  const handle = (s: Side): V3 => [sgn(s) * K.handle[0], K.handle[1], K.handle[2]];
  // Seat top: up the rear slope from the pelvis's lowest corner until it
  // meets the thighs' underside, then level to the front edge.
  const tanT = Math.tan(rad(K.seatTilt));
  const kinkZ = tanT > 0 ? Math.min(K.seatFront, low[2] + (low[1] - THIGH_UNDER) / tanT) : K.seatFront;
  const seatTopAt = (z: number) => low[1] - (Math.min(z, kinkZ) - low[2]) * tanT;
  const seatRear = low[2] - 7;
  const profile: [number, number][] = [
    [seatRear, seatTopAt(seatRear)],
    ...(kinkZ < K.seatFront ? [[kinkZ, seatTopAt(kinkZ)] as [number, number]] : []),
    [K.seatFront, seatTopAt(K.seatFront)],
    [K.seatFront, seatTopAt(K.seatFront) + 8],
    [seatRear, seatTopAt(seatRear) + 8],
  ];
  const seat: PSolid = {
    k: 'solid',
    part: 'eq.seat',
    group: 'eq.seat',
    verts: [-18, 18].flatMap((x) => profile.map(([z, y]): V3 => [x, y, z])),
    faces: prismFaces(profile.length),
    round: 3,
    w: 2,
    tone: 'equip',
  };
  const seatMid = (seatRear + K.seatFront) / 2;
  // Back pad square to the torso, from the top of the back down to 2 above the
  // pelvis's bottom, so it meets the seat as one pad. Its face touches the
  // upper back; the waist is 2 in front of it and the pelvis 3, the gap of
  // the lower back's curve. On the abductor's sloped seat its bottom edge
  // stays 1.5 to 2 above the seat top.
  const padFwd = qRot(qPel, [0, 0, 1]);
  const padTop = DIM.top.y;
  const padBottom = DIM.pelvis.y1 - 2;
  const backC = qRot(qPel, [0, (padTop + padBottom) / 2, -DIM.top.b - 3.5]);
  return {
    // Front shows the knees closing or opening; side shows the back angle,
    // the bent knees and the feet on the bars; top shows the thighs swinging
    // about the hips. The near pad would cover the knee from the side, and the
    // top view leaves out the arms and foot bars under the thighs.
    views: [FRONT_HIGH, { ...VIEW.side, hide: ['eq.kneepad.L'] }, { ...VIEW.top, hide: ['eq.arm', 'eq.footbar', 'eq.pivot'] }],
    pose: (t) => ({
      pos: [0, 0, 0],
      pelvis: { flex: -K.recline },
      // Eyes forward with the torso reclined.
      neck: { flex: K.recline * 0.6 },
      armR: { ik: handle('R'), pole: K.pole },
      armL: { ik: handle('L'), pole: [-K.pole[0], K.pole[1], K.pole[2]] },
      legR: { pts: [knee('R', t), add(knee('R', t), [0, DIM.shin, 0])] },
      legL: { pts: [knee('L', t), add(knee('L', t), [0, DIM.shin, 0])] },
      footR: { dir: along('R', t), up: [0, -1, 0] },
      footL: { dir: along('L', t), up: [0, -1, 0] },
    }),
    equipment: (b, t) => {
      const prims: Prim[] = [
        floor(floorY),
        seat,
        rail([[0, seatTopAt(seatMid) + 8, seatMid], [0, floorY, seatMid]], { part: 'eq.post' }),
        box(backC, [34, padBottom - padTop, 7], { rot: qPel, part: 'eq.backpad' }),
      ];
      for (const s of SIDES) {
        const sole = add(b.j[`ankle${s}`], [0, DIM.ankle, 0]);
        // Each foot bar sits under the middle of its foot, moved 2 out so the
        // two bars stay clear of each other with the knees together.
        const bar = add(add(add(sole, mul(along(s, t), 8)), mul(out(s, t), 2)), [0, 2.5, 0]);
        const pc = padCenter(s, t);
        // Each arm turns on a pivot under the hip, runs under its knee pad and
        // rises to the pad's rear end; a strut from halfway along it carries
        // the foot bar. Rising from the pad's rear and leaving from halfway,
        // they cross the shin in the side view instead of running beside it.
        // Under the pad, the two adductor arms stop short of each other where
        // the pads meet.
        const armOff = mul(out(s, t), padSide * KNEE_PAD_OFF);
        const p0 = add(hip(s), [0, 24, 0]);
        const padRear = add(pc, mul(along(s, t), -7));
        const p1 = add(padRear, [0, 24, 0]);
        const pm = mul(add(add(p0, armOff), p1), 0.5);
        const h = handle(s);
        prims.push(
          box(pc, [KNEE_PAD_T, 14, 15], { rot: turn(s, t), part: `eq.kneepad.${s}` }),
          cylinder(add(bar, mul(out(s, t), -6)), add(bar, mul(out(s, t), 6)), 2, { part: `eq.footbar.${s}` }),
          rail([p0, add(p0, armOff), p1, add(padRear, [0, 7, 0])], { part: `eq.arm.${s}` }),
          rail([pm, add(bar, mul(out(s, t), padSide * 6))], { part: `eq.arm.${s}` }),
          pivot(p0),
          rail([add(h, [0, 0, -6]), add(h, [0, 0, 6])], { part: 'eq.handle', w: 3 }),
          rail([add(h, [0, 0, -6]), [sgn(s) * 18, seatTopAt(h[2]) + 4, h[2]]], { part: 'eq.handlepost' }),
        );
      }
      return prims;
    },
    check: {
      muscles: SIDES.map((side) => ({ m: kind === 'abd' ? ('gluteMed' as const) : ('adductors' as const), side })),
      // The pad turns about the hip, so it pushes square to the thigh, back
      // toward the stretch. The share reads 99 by construction; what the hip
      // over the pivot does is keep the pad at the knee.
      load: (b, t) =>
        SIDES.map((s) => ({ at: add(b.j[`knee${s}`], mul(out(s, t), padSide * 7)), dir: mul(out(s, t), -padSide) })),
      lever: [
        { joint: 'hipR', end: 'kneeR' },
        { joint: 'hipL', end: 'kneeL' },
      ],
      contacts: (b, t) => {
        const res: Contact[] = [
          pelvisOnSeat(b, low[1]),
          { name: 'upper back against back pad', gap: clearOf(b.torso.upper, add(backC, mul(padFwd, 3.5)), padFwd) },
        ];
        for (const s of SIDES) {
          // The thigh's underside over the seat top, where they come closest.
          // Upright on the flat seat this reads 2, the pelvis block's 9 below
          // the hips against the thigh's radius of 7.
          const over: number[] = [];
          for (let k = 0; k <= DIM.thigh; k++) {
            const p = add(b.j[`hip${s}`], mul(sub(b.j[`knee${s}`], b.j[`hip${s}`]), k / DIM.thigh));
            if (p[2] >= low[2] && p[2] <= K.seatFront && Math.abs(p[0]) <= 18) over.push(seatTopAt(p[2]) - p[1] - THIGH_UNDER);
          }
          res.push(
            { name: `knee${s} on pad`, gap: dist(b.j[`knee${s}`], padCenter(s, t)) - KNEE_PAD_OFF },
            { name: `thigh${s} on seat`, gap: Math.min(...over), tol: 2.5 },
            { name: `foot${s} flat on its bar`, gap: b.j[`heel${s}`][1] - b.j[`toe${s}`][1] },
            { name: `hand${s} on handle`, gap: dist(b.j[`hand${s}`], handle(s)) },
          );
        }
        return res;
      },
    },
  };
}

/* ---------- the group ---------- */

export const group: Group = {
  figures: {
    legCurl: legCurl(),
    hipAbduction: hipMachine('abd'),
    hipAdduction: hipMachine('add'),
  },
  cues: {
    legCurl: {
      reach: 'Knees fully straight at the top, leaning forward from the hips as far as the knees still straighten.',
      points: [
        'Sit with your hips back against the bottom of the back pad, and move the pad until your knees line up with the pivot of the moving arm. Lower the thigh pad onto your thighs just above the knees, and set the lower pad behind your lower calves, just above the heels. With your knees on the pivot, the lower pad stays in one place on your calves through the whole rep. Hold the handles at the sides of the seat.',
        'Three of the four hamstring muscles cross the back of the hip and the back of the knee. Sitting bends the hip, so those three are longer at the stretch than in the lying leg curl. Maeo and colleagues found more hamstring growth from the seated leg curl than from the lying one.',
        'Lean forward from the hips as far as you can while your knees still straighten fully at the stretch. Leaning forward bends the hips further and makes the hamstrings longer there. A lean of about 10 degrees bends the hips to about 100 degrees. If your knees stop short of straight, sit more upright. Keep your lower back from rounding. Rounding it rolls the pelvis back, which shortens the hamstrings at the stretch. Leaning back onto the upper part of the back pad shortens them the same way.',
        'Let your knees straighten fully at the start of each rep, which is where the hamstrings are longest. Curl as far as the machine allows and keep your hips on the seat.',
      ],
    },
    hipAbduction: {
      reach: 'Knees together at the start, with your back against the pad.',
      points: [
        'Set the pads on the outside of your knees and rest your feet on the foot bars. Sit all the way back against the back pad so each hip is over the pivot of its moving arm. The pads then stay at your knees through the rep. Keep your knees bent about 90 degrees so all the movement is at the hip. Hold the handles at the sides of the seat.',
        'The glute medius runs from the side of the pelvis to the outside of the top of the thigh bone. It is longest with the knees together and shortens as they move apart. Let the pads bring your knees all the way together before each rep, and push your knees apart as far as the machine allows.',
        'If the back pad adjusts, recline it about 30 degrees from upright. With your thighs level, that leaves the hip bent about 60 degrees. With the hip bent 90 degrees, as when sitting upright, opening the knees changes the length of the glute medius very little. With the hip bent less, it is longer at the stretch and shortens more through the rep. Keep your back on the pad as the knees open.',
      ],
    },
    hipAdduction: {
      reach: 'Knees as wide as you can control at the start.',
      points: [
        'Set the pads on the inside of your knees and rest your feet on the foot bars. Sit all the way back, upright against the back pad, so each hip is over the pivot of its moving arm. The pads then stay at your knees through the rep. If the back pad reclines, keep your hips back and sit up off it. Keep your knees bent about 90 degrees so all the movement is at the hip. Hold the handles at the sides of the seat.',
        'The adductors run from the bottom of the pelvis to the inside and back of the thigh bone. They are longest with the knees wide and shorten as the knees come together, until the pads meet in the middle.',
        "Set the machine's range so your knees start as wide as you can control. That width sets how far the adductors stretch. Let the knees return to the wide position slowly at the end of each rep.",
        'Sitting upright bends the hip about 90 degrees, which makes the adductors a little longer at the stretch than with the back reclined. The back angle changes their length much less than the width does.',
      ],
    },
  },
  exercises: {
    'machine-leg-curl': 'legCurl',
    'machine-hip-abductor': 'hipAbduction',
    'machine-hip-adductor': 'hipAdduction',
  },
};
