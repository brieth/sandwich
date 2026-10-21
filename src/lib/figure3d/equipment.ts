/**
 * Equipment as primitives. Everything here is drawn in the body's faint color
 * whether it moves or not, since teal is for body parts.
 *
 * Attachments return where the cable meets them, so a figure runs its cable
 * from the pulley to that point and the analysis takes the force there.
 */
import type { Q, V3 } from './math';
import { Q_ID, add, cross, dist, len, mul, norm, qRot, sub } from './math';
import type { PDot, PFloor, PLine, PSolid, Prim } from './scene';
import { HEXA_FACES, perpTo, prismFaces } from './scene';

export interface Attached {
  prims: Prim[];
  /** Where the cable pulls. */
  attach: V3;
}

export const floor = (y: number): PFloor => ({ k: 'floor', part: 'eq.floor', y, tone: 'equip' });

export const pulley = (p: V3, opts: { fit?: boolean; part?: string } = {}): PDot => ({
  k: 'dot',
  part: opts.part ?? 'eq.pulley',
  p,
  r: 4,
  ring: true,
  tone: 'equip',
  fit: opts.fit,
  lift: 0,
});

export const cable = (from: V3, to: V3, opts: { fit?: boolean; part?: string } = {}): PLine => ({
  k: 'line',
  part: opts.part ?? 'eq.cable',
  pts: [from, to],
  w: 1.4,
  tone: 'cable',
  fit: opts.fit,
});

/** A plain line of equipment: a frame, a rail, a lever arm. */
export const rail = (pts: V3[], opts: { w?: number; part?: string; fit?: boolean } = {}): PLine => ({
  k: 'line',
  part: opts.part ?? 'eq.frame',
  pts,
  w: opts.w ?? 2,
  tone: 'equip',
  fit: opts.fit,
});

/**
 * A box: center, full size along its own x, y and z, and a turn. Benches,
 * seats, pads, foot plates.
 */
export function box(c: V3, size: V3, opts: { rot?: Q; group?: string; part?: string; round?: number } = {}): PSolid {
  const r = opts.rot ?? Q_ID;
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  // Bottom ring at +y, top ring at -y, matching the torso's corner order.
  const local: V3[] = [
    [-hx, hy, -hz],
    [hx, hy, -hz],
    [hx, hy, hz],
    [-hx, hy, hz],
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, -hy, hz],
    [-hx, -hy, hz],
  ];
  const part = opts.part ?? 'eq.box';
  return {
    k: 'solid',
    part,
    group: opts.group ?? part,
    verts: local.map((v) => add(c, qRot(r, v))),
    faces: HEXA_FACES,
    round: opts.round ?? 3,
    w: 2,
    tone: 'equip',
  };
}

/** A cylinder between two points: a roller pad, a weight plate, a bar sleeve. */
export function cylinder(a: V3, b: V3, r: number, opts: { group?: string; part?: string; sides?: number } = {}): PSolid {
  const n = opts.sides ?? 16;
  const ax = sub(b, a);
  const u = perpTo(ax, [0, 1, 0]);
  const v = norm(cross(ax, u));
  const ring = (c: V3): V3[] =>
    Array.from({ length: n }, (_, i) => {
      const t = (i / n) * Math.PI * 2;
      return add(c, add(mul(u, r * Math.cos(t)), mul(v, r * Math.sin(t))));
    });
  const part = opts.part ?? 'eq.cyl';
  return {
    k: 'solid',
    part,
    group: opts.group ?? part,
    verts: [...ring(a), ...ring(b)],
    faces: prismFaces(n),
    round: 0,
    w: 2,
    tone: 'equip',
  };
}

/** A weight plate or wheel: a short cylinder about a center and an axis. */
export function disc(c: V3, axis: V3, r: number, thick: number, opts: { group?: string; part?: string } = {}): PSolid {
  const h = mul(norm(axis), thick / 2);
  return cylinder(sub(c, h), add(c, h), r, { ...opts, sides: 24 });
}

/**
 * A D handle in one hand. The grip runs square to the cable and the forearm,
 * and the two sides of the D meet 9 out from the grip along the cable, where
 * it clips on.
 */
export function handle(hand: V3, toward: V3, forearm: V3, part = 'eq.handle'): Attached {
  const c = norm(sub(toward, hand));
  const g = perpTo(cross(c, forearm), [1, 0, 0]);
  const a = add(hand, mul(c, 9));
  const e0 = add(hand, mul(g, -6));
  const e1 = add(hand, mul(g, 6));
  return {
    prims: [{ k: 'line', part, pts: [e0, e1, a], closed: true, w: 2, tone: 'equip' }],
    attach: a,
  };
}

/**
 * A rope in two hands. The cable clips to the middle and each strand runs 30
 * to a knob just past the hand. The junction sits toward the pulley from the
 * point between the hands, as far as taut strands allow.
 */
export function rope(handR: V3, handL: V3, toward: V3, part = 'eq.rope'): Attached {
  const strand = 30;
  const m = mul(add(handR, handL), 0.5);
  const half = dist(handR, handL) / 2;
  const reach = Math.sqrt(Math.max(0, strand * strand - half * half));
  const j = add(m, mul(norm(sub(toward, m)), reach));
  const knob = (h: V3): V3 => add(h, mul(norm(sub(h, j)), 4));
  return {
    prims: [
      { k: 'line', part, pts: [knob(handR), j, knob(handL)], w: 2.5, tone: 'equip' },
      { k: 'dot', part: `${part}.knob`, p: knob(handR), r: 3, tone: 'equip', lift: 0 },
      { k: 'dot', part: `${part}.knob`, p: knob(handL), r: 3, tone: 'equip', lift: 0 },
    ],
    attach: j,
  };
}

export type BarKind = 'straight' | 'cambered' | 'lat' | 'barbell';

/**
 * A bar in two hands, centered between them, which is where the cable clips.
 *
 * Straight is a 50 short cable bar. Cambered is the same length with the EZ
 * bends, which lie square to the forearms. Lat is the 120 pulldown bar with its
 * last 22 at each end bent 25 degrees away from the pulley. Barbell is a 220
 * Olympic bar with 45 cm plates.
 */
export function bar(kind: BarKind, handR: V3, handL: V3, opts: { toward?: V3; forearm?: V3; part?: string } = {}): Attached {
  const part = opts.part ?? 'eq.bar';
  const m = mul(add(handR, handL), 0.5);
  const ax = norm(sub(handR, handL));
  const half = { straight: 25, cambered: 26, lat: 60, barbell: 110 }[kind];
  const at = (k: number): V3 => add(m, mul(ax, k));
  const prims: Prim[] = [];
  if (kind === 'straight') {
    prims.push({ k: 'line', part, pts: [at(-half), at(half)], w: 2.5, tone: 'equip' });
  } else if (kind === 'cambered') {
    const n = perpTo(cross(ax, opts.forearm ?? [0, 1, 0]), [0, 0, 1]);
    const off = (k: number, z: number): V3 => add(at(k), mul(n, z));
    // Grips sit where the hands are; the bends either side of each grip
    // step 3 forward and back.
    const g = Math.max(8, dist(handR, handL) / 2);
    prims.push({
      k: 'line',
      part,
      pts: [at(-half), off(-g - 5, 0), off(-g - 2, 3), off(-g + 3, -3), off(-g + 6, 0), off(g - 6, 0), off(g - 3, -3), off(g + 2, 3), off(g + 5, 0), at(half)],
      w: 2.5,
      tone: 'equip',
    });
  } else if (kind === 'lat') {
    const away = opts.toward ? mul(norm(sub(opts.toward, m)), -1) : ([0, 1, 0] as V3);
    const down = perpTo(ax, away);
    const bend = (s: number): V3 => add(at(s * (half - 22)), add(mul(ax, s * 22 * Math.cos(0.436)), mul(down, 22 * Math.sin(0.436))));
    prims.push({ k: 'line', part, pts: [bend(-1), at(-(half - 22)), at(half - 22), bend(1)], w: 2.5, tone: 'equip' });
  } else {
    prims.push({ k: 'line', part, pts: [at(-half), at(half)], w: 2.5, tone: 'equip' });
    for (const s of [-1, 1]) prims.push(disc(at(s * 75), ax, 22.5, 5, { part: `${part}.plate`, group: `${part}.plate${s}` }));
  }
  return { prims, attach: m };
}

/** Length along a polyline, for checking a rope or bar did not stretch. */
export const pathLength = (pts: V3[]): number => pts.slice(1).reduce((s, p, i) => s + len(sub(p, pts[i])), 0);
