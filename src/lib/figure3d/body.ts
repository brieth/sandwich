/**
 * The body: its dimensions, how a pose is written, and solving a pose into
 * points in the room.
 *
 * Every landmark is written in standard body coordinates: standing upright,
 * origin at the center between the hip joints, x to the person's right, y down,
 * z forward, centimeters. Each landmark belongs to one segment, and the segment
 * carries it into the room. A figure only says how the segments are turned.
 */
import type { Q, V3 } from './math';
import {
  Q_ID,
  add,
  bendRight,
  cross,
  dist,
  dot,
  len,
  mul,
  norm,
  pitchFwd,
  qMul,
  qRot,
  sub,
  turnRight,
} from './math';

/** One cross-section of the torso: half width, and depth in front of and behind the spine line. */
export interface Section {
  y: number;
  w: number;
  f: number;
  b: number;
}

/*
 * Proportions of a 178 cm person. The torso is three sections tapering from
 * the shoulders to the waist, the same shape the crossover fly figures were
 * drawn and checked with. The pelvis block reaches 9 below the hip joints,
 * which is where the seat is when sitting, so a seated figure rests on it.
 * Legs come to 93 from hip joint to floor when straight, about 0.52 of height.
 */
export const DIM = {
  hipHalf: 10,
  waist: { y: 0, w: 14, f: 13, b: 13 } as Section,
  mid: { y: -29, w: 17, f: 14, b: 14 } as Section,
  top: { y: -58, w: 20, f: 15, b: 15 } as Section,
  /** Hips down to the seat. Its top ring is the waist, so it joins the lower torso without a step. */
  pelvis: { y1: 9, w: 15, f: 9, b: 12 },
  /** Right shoulder joint, at the torso's top corner, 5 below its top edge. */
  shoulder: [20, -53, 0] as V3,
  /** Where the head turns on the torso. */
  neck: [0, -60, 0] as V3,
  head: { c: [0, -76, 3] as V3, r: 11 },
  upperArm: 34,
  /** Elbow to the middle of the grip. */
  forearm: 32,
  thigh: 44,
  shin: 42,
  /** Ankle joint above the sole, heel behind it, toe ahead of it. */
  ankle: 7,
  heel: 4,
  toe: 18,
  /*
   * Inner border of the right shoulder blade, as a quadratic arc on the back
   * surface: top, control, bottom. The border bows toward the spine, which is
   * the shape it has. Mirrored for the left blade.
   */
  blade: [
    [9, -50, -15],
    [4, -41, -15],
    [9, -31, -14],
  ] as V3[],
};

/** Degrees. Flex tips the top of the segment forward, side bends it to the right, twist turns its front to the right. */
export interface Rot3 {
  flex?: number;
  side?: number;
  twist?: number;
}

/**
 * Where a shoulder blade sits, as an offset of the shoulder joint in the upper
 * torso's coordinates, written for the right side: x out from the spine, y
 * down, z forward. rot is upward rotation in degrees, which swings the bottom
 * of the blade out; it turns the drawn blade and leaves the joint where x, y, z
 * put it.
 */
export interface Scap {
  x?: number;
  y?: number;
  z?: number;
  rot?: number;
}

/**
 * How a limb is placed.
 *
 * dirs: the direction of each segment, as unit vectors, in the frame named.
 * The torso frame is the upper torso for an arm and the pelvis for a leg.
 *
 * ik: the end of the limb goes to target, in the room, and the middle joint
 * points toward pole. Out of reach, the limb straightens toward the target and
 * the gap is reported.
 *
 * foot: a leg only. The heel goes to heel and the foot points along dir with
 * its sole facing away from up, and the leg reaches the ankle that implies.
 *
 * pts: the middle joint and the end, in the room. Lengths are checked.
 */
export type Limb =
  | { dirs: [V3, V3]; frame?: 'torso' | 'world' }
  | { ik: V3; pole: V3 }
  | { foot: { heel: V3; dir: V3; up?: V3 }; pole: V3 }
  | { pts: [V3, V3] };

/** Foot direction from heel to toe, and the direction from the sole up into the ankle. */
export interface Foot {
  dir: V3;
  up: V3;
}

export interface BodySpec {
  /** Center between the hip joints, in the room. */
  pos: V3;
  /** Pelvis orientation before the hinge. Identity is standing and facing +z. */
  rot?: Q;
  /** Pelvis against rot. A hip hinge is pelvis.flex. */
  pelvis?: Rot3;
  /** Lower torso against the pelvis. */
  lumbar?: Rot3;
  /** Upper torso against the lower torso. Negative flex is the chest lifted. */
  thoracic?: Rot3;
  /** Head against the upper torso. */
  neck?: Rot3;
  scapR?: Scap;
  scapL?: Scap;
  armR: Limb;
  armL: Limb;
  legR: Limb;
  legL: Limb;
  /** Feet for legs not placed by foot. Defaults to flat and facing the pelvis's way. */
  footR?: Foot;
  footL?: Foot;
}

/** A segment's placement: world = o + r (p - pivot), for p in body coordinates. */
export interface Xf {
  o: V3;
  r: Q;
  pivot: V3;
}

export const applyXf = (x: Xf, p: V3): V3 => add(x.o, qRot(x.r, sub(p, x.pivot)));

export type SegName = 'pelvis' | 'lower' | 'upper' | 'head';

export type JointName =
  | 'hipR'
  | 'hipL'
  | 'kneeR'
  | 'kneeL'
  | 'ankleR'
  | 'ankleL'
  | 'heelR'
  | 'heelL'
  | 'toeR'
  | 'toeL'
  | 'shoulderR'
  | 'shoulderL'
  | 'elbowR'
  | 'elbowL'
  | 'handR'
  | 'handL'
  | 'neck'
  | 'head'
  | 'mid';

export interface Body {
  spec: BodySpec;
  xf: Record<SegName, Xf>;
  j: Record<JointName, V3>;
  /**
   * Eight corners per torso part: the bottom section's four, then the top's,
   * each back-left, back-right, front-right, front-left. lumbar and thoracic
   * join the rings either side of a bend, so a bent torso still draws as one
   * piece instead of opening a notch at the hinge.
   */
  torso: { pelvis: V3[]; lumbar: V3[]; lower: V3[]; thoracic: V3[]; upper: V3[] };
  head: { c: V3; r: number };
  /** Inner border of each shoulder blade, as points along the arc. */
  blade: { R: V3[]; L: V3[] };
  /**
   * Bottom corner of each blade where it really is, for the muscle measures.
   * The drawn arc above is kept off the torso's sides, which this is not.
   */
  bladeTip: { R: V3; L: V3 };
  /** How far each limb end fell short of where it was sent, or a length was off. */
  gaps: Record<'armR' | 'armL' | 'legR' | 'legL', number>;
  /** A body-coordinate point on a segment, in the room. */
  at: (seg: SegName, p: V3) => V3;
  /** A body-coordinate direction on a segment, in the room. */
  dirOf: (seg: SegName, d: V3) => V3;
}

export function rot3(r: Rot3 | undefined): Q {
  if (!r) return Q_ID;
  return qMul(turnRight(r.twist ?? 0), qMul(bendRight(r.side ?? 0), pitchFwd(r.flex ?? 0)));
}

/** Corners of the torso part between two sections, in body coordinates. */
function hexa(s0: Section, s1: Section): V3[] {
  const ring = (s: Section): V3[] => [
    [-s.w, s.y, -s.b],
    [s.w, s.y, -s.b],
    [s.w, s.y, s.f],
    [-s.w, s.y, s.f],
  ];
  return [...ring(s0), ...ring(s1)];
}

const PELVIS_CORNERS = hexa({ y: DIM.pelvis.y1, w: DIM.pelvis.w, f: DIM.pelvis.f, b: DIM.pelvis.b }, DIM.waist);
const LOWER_CORNERS = hexa(DIM.waist, DIM.mid);
const UPPER_CORNERS = hexa(DIM.mid, DIM.top);

/** Depth of the back surface at a height on the upper torso, for the blades. */
function backAt(y: number): number {
  const k = (y - DIM.mid.y) / (DIM.top.y - DIM.mid.y);
  return -(DIM.mid.b + k * (DIM.top.b - DIM.mid.b));
}

/** Half width of the upper torso at a height. */
function halfWidthAt(y: number): number {
  const k = (y - DIM.mid.y) / (DIM.top.y - DIM.mid.y);
  return DIM.mid.w + k * (DIM.top.w - DIM.mid.w);
}

interface LimbOut {
  mid: V3;
  end: V3;
  gap: number;
  foot?: Foot;
}

/**
 * Two segments from a root to a target, bent toward a pole, by the law of
 * cosines. Out of reach it straightens along the line to the target.
 */
export function twoBone(root: V3, target: V3, pole: V3, l1: number, l2: number): { mid: V3; end: V3; gap: number } {
  const to = sub(target, root);
  const d0 = len(to);
  const u = d0 < 1e-9 ? norm(pole) : mul(to, 1 / d0);
  const d = Math.max(Math.abs(l1 - l2) + 1e-6, Math.min(l1 + l2 - 1e-6, d0));
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sa = Math.sqrt(Math.max(0, 1 - ca * ca));
  let w = sub(pole, mul(u, dot(pole, u)));
  if (len(w) < 1e-6) {
    // Pole along the line: any perpendicular will do, so take one off x or y.
    w = cross(u, Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  }
  w = norm(w);
  const mid = add(root, add(mul(u, l1 * ca), mul(w, l1 * sa)));
  const end = add(mid, mul(norm(sub(add(root, mul(u, d)), mid)), l2));
  return { mid, end, gap: dist(end, target) };
}

function solveLimb(root: V3, l1: number, l2: number, limb: Limb, frame: Q): LimbOut {
  if ('dirs' in limb) {
    const r = limb.frame === 'world' ? Q_ID : frame;
    const mid = add(root, mul(norm(qRot(r, limb.dirs[0])), l1));
    const end = add(mid, mul(norm(qRot(r, limb.dirs[1])), l2));
    return { mid, end, gap: 0 };
  }
  if ('ik' in limb) return twoBone(root, limb.ik, limb.pole, l1, l2);
  if ('foot' in limb) {
    const up = norm(limb.foot.up ?? [0, -1, 0]);
    // Toe direction made square to the sole's normal, so a slightly tilted
    // dir still gives a flat foot.
    const fd = norm(sub(limb.foot.dir, mul(up, dot(limb.foot.dir, up))));
    const ankle = add(limb.foot.heel, add(mul(up, DIM.ankle), mul(fd, DIM.heel)));
    return { ...twoBone(root, ankle, limb.pole, l1, l2), foot: { dir: fd, up } };
  }
  const [mid, end] = limb.pts;
  return { mid, end, gap: Math.max(Math.abs(dist(root, mid) - l1), Math.abs(dist(mid, end) - l2)) };
}

export function solveBody(spec: BodySpec): Body {
  const base = spec.rot ?? Q_ID;
  const rPel = qMul(base, rot3(spec.pelvis));
  const rLow = qMul(rPel, rot3(spec.lumbar));
  const rUp = qMul(rLow, rot3(spec.thoracic));
  const rHead = qMul(rUp, rot3(spec.neck));
  const midPivot: V3 = [0, DIM.mid.y, 0];
  const pelvis: Xf = { o: spec.pos, r: rPel, pivot: [0, 0, 0] };
  const lower: Xf = { o: spec.pos, r: rLow, pivot: [0, 0, 0] };
  const upper: Xf = { o: applyXf(lower, midPivot), r: rUp, pivot: midPivot };
  const head: Xf = { o: applyXf(upper, DIM.neck), r: rHead, pivot: DIM.neck };
  const xf: Record<SegName, Xf> = { pelvis, lower, upper, head };
  const at = (seg: SegName, p: V3) => applyXf(xf[seg], p);
  const dirOf = (seg: SegName, d: V3) => qRot(xf[seg].r, d);

  const sR = spec.scapR ?? {};
  const sL = spec.scapL ?? sR;
  const shoulderR = at('upper', add(DIM.shoulder, [sR.x ?? 0, sR.y ?? 0, sR.z ?? 0]));
  const shoulderL = at('upper', add([-DIM.shoulder[0], DIM.shoulder[1], DIM.shoulder[2]], [-(sL.x ?? 0), sL.y ?? 0, sL.z ?? 0]));
  const armR = solveLimb(shoulderR, DIM.upperArm, DIM.forearm, spec.armR, rUp);
  const armL = solveLimb(shoulderL, DIM.upperArm, DIM.forearm, spec.armL, rUp);

  const hipR = at('pelvis', [DIM.hipHalf, 0, 0]);
  const hipL = at('pelvis', [-DIM.hipHalf, 0, 0]);
  const legR = solveLimb(hipR, DIM.thigh, DIM.shin, spec.legR, rPel);
  const legL = solveLimb(hipL, DIM.thigh, DIM.shin, spec.legL, rPel);

  // A foot not placed by its leg lies flat, pointing the way the pelvis faces.
  const fwd = qRot(base, [0, 0, 1]);
  const flat: Foot = { dir: norm([fwd[0], 0, fwd[2]]), up: [0, -1, 0] };
  const feet = [legR.foot ?? spec.footR ?? flat, legL.foot ?? spec.footL ?? flat];
  const footPts = [legR.end, legL.end].map((a, i) => {
    const f = feet[i];
    const sole = sub(a, mul(norm(f.up), DIM.ankle));
    return { heel: sub(sole, mul(norm(f.dir), DIM.heel)), toe: add(sole, mul(norm(f.dir), DIM.toe)) };
  });

  /** The blade's three arc points in the back's plane, slid and turned. */
  const bladeArc = (s: Scap): [number, number][] => {
    const q = DIM.blade.map(([x, y]) => [x + (s.x ?? 0), y + (s.y ?? 0)] as [number, number]);
    const cx = q[1][0];
    const cy = q[1][1];
    const a = ((s.rot ?? 0) * Math.PI) / 180;
    return q.map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      // Upward rotation swings the bottom of the blade out, away from the spine.
      return [cx + dx * Math.cos(a) + dy * Math.sin(a), cy - dx * Math.sin(a) + dy * Math.cos(a)] as [number, number];
    });
  };
  const blade = (side: 1 | -1, s: Scap): V3[] => {
    // Slides with the joint across the back but stays on its surface, 2
    // under it so the torso hides it from every side but behind (see INSET
    // in scene.ts). Turning is about the arc's middle, in the plane of the
    // back.
    const turned = bladeArc(s);
    const pts: V3[] = [];
    for (let k = 0; k <= 8; k++) {
      const u = k / 8;
      const x = (1 - u) * (1 - u) * turned[0][0] + 2 * (1 - u) * u * turned[1][0] + u * u * turned[2][0];
      const y = (1 - u) * (1 - u) * turned[0][1] + 2 * (1 - u) * u * turned[1][1] + u * u * turned[2][1];
      // A blade pushed far forward and turned up would reach round the back
      // corner of the box torso and show from the side as a stray tick; a
      // real one wraps round the ribs. 7 short of the side keeps it clear of
      // the 5 the hiding test cuts off that corner (chamfer in scene.ts).
      pts.push(at('upper', [side * Math.min(x, halfWidthAt(y) - 7), y, backAt(y) + 2]));
    }
    return pts;
  };

  return {
    spec,
    xf,
    j: {
      hipR,
      hipL,
      kneeR: legR.mid,
      kneeL: legL.mid,
      ankleR: legR.end,
      ankleL: legL.end,
      heelR: footPts[0].heel,
      heelL: footPts[1].heel,
      toeR: footPts[0].toe,
      toeL: footPts[1].toe,
      shoulderR,
      shoulderL,
      elbowR: armR.mid,
      elbowL: armL.mid,
      handR: armR.end,
      handL: armL.end,
      neck: at('upper', DIM.neck),
      head: at('head', DIM.head.c),
      mid: at('lower', midPivot),
    },
    torso: {
      pelvis: PELVIS_CORNERS.map((p) => at('pelvis', p)),
      lumbar: [...PELVIS_CORNERS.slice(4).map((p) => at('pelvis', p)), ...LOWER_CORNERS.slice(0, 4).map((p) => at('lower', p))],
      lower: LOWER_CORNERS.map((p) => at('lower', p)),
      thoracic: [...LOWER_CORNERS.slice(4).map((p) => at('lower', p)), ...UPPER_CORNERS.slice(0, 4).map((p) => at('upper', p))],
      upper: UPPER_CORNERS.map((p) => at('upper', p)),
    },
    head: { c: at('head', DIM.head.c), r: DIM.head.r },
    blade: { R: blade(1, sR), L: blade(-1, sL) },
    bladeTip: {
      R: (([x, y]) => at('upper', [x, y, backAt(y) + 2]))(bladeArc(sR)[2]),
      L: (([x, y]) => at('upper', [-x, y, backAt(y) + 2]))(bladeArc(sL)[2]),
    },
    gaps: { armR: armR.gap, armL: armL.gap, legR: legR.gap, legL: legL.gap },
    at,
    dirOf,
  };
}
