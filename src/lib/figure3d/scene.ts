/**
 * What gets drawn: primitives in the room, the cameras that look at them, and
 * the order that puts the nearer thing on top.
 *
 * Bodies and benches are convex solids. Limbs, cables and bars are lines, cut
 * into short pieces, and each piece goes behind exactly the solids that hide
 * it. A ray from the piece toward the camera decides that: if it passes through
 * a solid, the solid is in front. Solids among themselves are ordered the same
 * way, by where rays through both meet each one first.
 */
import type { V3 } from './math';
import { add, cross, dist, dot, len, lerp, mul, norm, sub } from './math';
import type { Body } from './body';

/**
 * move and body are decided by whether the part moves through the rep, so a
 * body part leaves tone unset. equip and cable are for equipment, which is
 * never teal.
 */
export type Tone = 'move' | 'body' | 'equip' | 'cable';

interface Base {
  /** Names the thing for the moving test and for hiding by view. */
  part: string;
  tone?: Tone;
  /** Left out of the auto-fit, for a pulley far enough away that the cable can run off the edge. */
  fit?: boolean;
}

/** A polyline, drawn w wide in box units. */
export interface PLine extends Base {
  k: 'line';
  pts: V3[];
  w?: number;
  closed?: boolean;
  /** Drawn before everything else, for the floor. */
  under?: boolean;
}

/** A dot, r in box units. A ring is drawn as an outline, for a pulley. */
export interface PDot extends Base {
  k: 'dot';
  p: V3;
  r: number;
  ring?: boolean;
  /** Teal when any of these parts moves. A joint dot follows the segments that meet at it. */
  movesWith?: string[];
  /** Pulls the dot toward the camera in the sort, so a hand draws over the bar it holds. */
  lift?: number;
  /**
   * Where to test whether the dot is hidden, in place of the dot itself. A
   * shoulder joint sits a few centimeters inside the torso's corner, more with
   * the blade pulled back, so its own position reads as hidden from the front
   * and from above. Its dot marks where the arm hangs on, so it is tested a
   * little way out along the upper arm: it shows wherever the arm can be seen
   * leaving the body, and hides with the arm on the far side.
   */
  probe?: V3;
}

/** A convex solid. Every part in a group is drawn as one outline. */
export interface PSolid extends Base {
  k: 'solid';
  group: string;
  verts: V3[];
  /** Each face as vertex indices. Winding does not matter. */
  faces: number[][];
  /**
   * Corner rounding of the drawn outline, in box units, for every corner or
   * per vertex. Where two parts of a group meet, their shared corners take 0,
   * so the joined outline runs straight through instead of pinching in.
   */
  round?: number | number[];
  w?: number;
  /**
   * Cuts this much off each upright edge for the hiding test only, so a limb
   * passing a corner the outline draws rounded is not hidden by the square
   * corner of the box behind it. For prisms made by prismFaces.
   */
  chamfer?: number;
  /**
   * Per face, how far inside it a point still counts as on the surface; see
   * INSET. A face where two parts of a group meet takes -INSET, which pushes
   * it out instead, so the parts overlap for the hiding test and nothing shows
   * through the join.
   */
  inset?: number[];
}

export interface PBall extends Base {
  k: 'ball';
  group: string;
  c: V3;
  r: number;
  w?: number;
}

/** The floor, at a height in the room. Drawn across the whole box from any angle that has it level. */
export interface PFloor extends Base {
  k: 'floor';
  y: number;
}

export type Prim = PLine | PDot | PSolid | PBall | PFloor;

/** dir points from the scene toward the camera. Screen x runs along right, screen y down along -up. */
export interface Camera {
  dir: V3;
  up: V3;
  right: V3;
}

/*
 * Standard angles on a person standing and facing +z. Front is drawn as in a
 * mirror, so the person's right is on the right in both front and back views.
 * Side looks at the left side with the person facing screen left, which is
 * how the side views have always been drawn; sideRight looks at the right side
 * for single-arm work done with the right arm, facing screen right.
 */
export const CAM = {
  front: { dir: [0, 0, 1], up: [0, -1, 0], right: [1, 0, 0] } as Camera,
  back: { dir: [0, 0, -1], up: [0, -1, 0], right: [1, 0, 0] } as Camera,
  side: { dir: [-1, 0, 0], up: [0, -1, 0], right: [0, 0, -1] } as Camera,
  sideRight: { dir: [1, 0, 0], up: [0, -1, 0], right: [0, 0, 1] } as Camera,
  top: { dir: [0, -1, 0], up: [0, 0, 1], right: [1, 0, 0] } as Camera,
};

export type P2 = [number, number];

export const project = (cam: Camera, p: V3): P2 => [dot(p, cam.right), -dot(p, cam.up)];
export const depthOf = (cam: Camera, p: V3): number => dot(p, cam.dir);

/* ---------- solids ---------- */

/** Faces of a solid made by solid(): bottom ring, top ring, then the sides. */
export function prismFaces(n: number): number[][] {
  const faces = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => n + i)];
  for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
  return faces;
}

export const HEXA_FACES = prismFaces(4);

interface Plane {
  n: V3;
  d: number;
  inset?: number;
}

/** Outward face planes of a convex solid: inside where n . x <= d. */
function planesOf(verts: V3[], faces: number[][], insets?: number[], chamfer = 0): Plane[] {
  const c = mul(verts.reduce((s, v) => add(s, v), [0, 0, 0] as V3), 1 / verts.length);
  const out: Plane[] = [];
  const normals: (V3 | null)[] = faces.map(() => null);
  for (const [fi, f] of faces.entries()) {
    // Newell's method, so a face with a slightly bent or tiny edge still gets a normal.
    let n: V3 = [0, 0, 0];
    for (let i = 0; i < f.length; i++) {
      const a = verts[f[i]];
      const b = verts[f[(i + 1) % f.length]];
      n = add(n, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
    }
    if (len(n) < 1e-9) continue;
    n = norm(n);
    const p0 = verts[f[0]];
    // A face through the middle belongs to a flat solid, such as a joint
    // filler on a straight torso, and has no inside to point away from.
    const side = dot(n, sub(c, p0));
    if (Math.abs(side) < 1e-3) continue;
    if (side > 0) n = mul(n, -1);
    normals[fi] = n;
    out.push({ n, d: dot(n, p0), inset: insets?.[fi] });
  }
  if (chamfer > 0 && faces.length > 4) {
    // Side faces follow the two rings, each sharing an upright edge with the
    // next. The bevel through that edge cuts chamfer off both faces.
    const sides = faces.length - 2;
    for (let k = 0; k < sides; k++) {
      const fa = 2 + k;
      const fb = 2 + ((k + 1) % sides);
      const nA = normals[fa];
      const nB = normals[fb];
      const shared = faces[fa].filter((i) => faces[fb].includes(i));
      if (!nA || !nB || shared.length !== 2) continue;
      const e0 = verts[shared[0]];
      const e1 = verts[shared[1]];
      const n = norm(add(nA, nB));
      let tA = norm(cross(norm(sub(e1, e0)), nA));
      if (dot(tA, nB) > 0) tA = mul(tA, -1);
      const mid = mul(add(e0, e1), 0.5);
      out.push({ n, d: dot(n, mid) + chamfer * dot(n, tA), inset: insets?.[fa] });
    }
  }
  // Fewer than four planes cannot close a solid; treat it as having no inside.
  return out.length >= 4 ? out : [];
}

/** Where a ray o + s dir is inside a convex solid, as [enter, exit], or null. */
function clipRay(planes: Plane[], o: V3, d: V3, inset: number): [number, number] | null {
  if (!planes.length) return null;
  let s0 = -Infinity;
  let s1 = Infinity;
  for (const pl of planes) {
    const den = dot(pl.n, d);
    // A face's own inset wins unless the caller asks for more, so a joint
    // filler's pushed-out faces stay pushed out.
    const num = pl.d - (inset ? (pl.inset !== undefined && pl.inset < 0 ? pl.inset : Math.max(pl.inset ?? inset, inset)) : 0) - dot(pl.n, o);
    if (Math.abs(den) < 1e-12) {
      if (num < 0) return null;
      continue;
    }
    const s = num / den;
    if (den < 0) s0 = Math.max(s0, s);
    else s1 = Math.min(s1, s);
    if (s0 > s1) return null;
  }
  return [s0, s1];
}

function clipBall(c: V3, r: number, o: V3, d: V3): [number, number] | null {
  const oc = sub(o, c);
  const b = dot(oc, d);
  const q = dot(oc, oc) - r * r;
  const disc = b * b - q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

/**
 * How far inside its surface a point may sit and still count as on top, and
 * how far a ray must then travel through the solid to count as hidden. A limb
 * running along the side of the body shows. A blade sits 2 under the back, so
 * from behind its ray crosses 0.5 of the inset solid and it shows, while from
 * the side or above the ray crosses the whole torso and it does not. At 0.75,
 * an elbow resting 1.3 into a row's torso box went missing from the back.
 */
const INSET = 1.5;
const THROUGH = 1;

interface Occluder {
  group: string;
  parts: ({ planes: Plane[] } | { c: V3; r: number })[];
}

function occluderOf(group: string, prims: (PSolid | PBall)[]): Occluder {
  return {
    group,
    parts: prims.map((p) => (p.k === 'solid' ? { planes: planesOf(p.verts, p.faces, p.inset, p.chamfer) } : { c: p.c, r: p.r })),
  };
}

/** Whether something solid in the group lies between a point and the camera. */
function hides(o: Occluder, p: V3, dir: V3, inset = INSET): boolean {
  for (const part of o.parts) {
    const hit = 'planes' in part ? clipRay(part.planes, p, dir, inset) : clipBall(part.c, part.r - inset, p, dir);
    if (hit && hit[1] - Math.max(hit[0], 0) > THROUGH) return true;
  }
  return false;
}

/** Depth at which a ray from the camera through a screen point first meets the group. */
function firstHit(o: Occluder, cam: Camera, s: P2): number | null {
  const far = 1e4;
  const origin = add(add(mul(cam.right, s[0]), mul(cam.up, -s[1])), mul(cam.dir, far));
  const d = mul(cam.dir, -1);
  let best: number | null = null;
  for (const part of o.parts) {
    const hit = 'planes' in part ? clipRay(part.planes, origin, d, 0) : clipBall(part.c, part.r, origin, d);
    if (!hit || hit[1] < Math.max(hit[0], 0)) continue;
    const depth = far - Math.max(hit[0], 0);
    if (best === null || depth > best) best = depth;
  }
  return best;
}

/* ---------- 2D helpers ---------- */

/** Convex hull by monotone chain, counterclockwise, as indices into pts. */
export function hullIdx(pts: P2[]): number[] {
  const p = pts.map((_, i) => i).sort((a, b) => pts[a][0] - pts[b][0] || pts[a][1] - pts[b][1]);
  if (p.length < 3) return p;
  const cr = (o: number, a: number, b: number) =>
    (pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0]);
  const lower: number[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cr(lower[lower.length - 2], lower[lower.length - 1], q) <= 1e-9) lower.pop();
    lower.push(q);
  }
  const upper: number[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cr(upper[upper.length - 2], upper[upper.length - 1], q) <= 1e-9) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export const hull2 = (pts: P2[]): P2[] => hullIdx(pts).map((i) => pts[i]);

/* ---------- layout ---------- */

/** A drawing step on screen, in cm before scaling. Widths and radii are in box units. */
export type Op =
  | { op: 'group'; parts: { pts: P2[]; round: number[]; w: number; tone: Tone }[] }
  | { op: 'ball'; c: P2; r: number; w: number; tone: Tone }
  | { op: 'seg'; a: P2; b: P2; w: number; tone: Tone }
  | { op: 'dot'; c: P2; r: number; tone: Tone; ring: boolean }
  | { op: 'floor'; y: number };

/** Whether a camera holds the room level, so a floor is a line across it. */
export const level = (cam: Camera): boolean => Math.abs(cam.up[1]) > 0.99;

/** Line pieces are at most this long, so one that crosses a body edge splits close to it. */
const PIECE = 1.5;

/** Whether a part is left out by a view's hide list, matched by prefix. */
export function hidden(part: string, hide: string[] | undefined): boolean {
  return !!hide && hide.some((h) => part.startsWith(h));
}

/**
 * The draw order for one frame from one camera.
 *
 * toneOf gives a body part's color from the moving test. Solids are ordered
 * among themselves first; each line piece then goes just before the first
 * solid that hides it, or after all of them, and pieces in the same gap go
 * far to near.
 */
export function layout(prims: Prim[], cam: Camera, toneOf: (p: Prim) => Tone, hide?: string[]): Op[] {
  const shown = prims.filter((p) => !hidden(p.part, hide));
  const groups = new Map<string, (PSolid | PBall)[]>();
  for (const p of shown) {
    if (p.k === 'solid' || p.k === 'ball') {
      const g = groups.get(p.group) ?? [];
      g.push(p);
      groups.set(p.group, g);
    }
  }
  const names = [...groups.keys()];
  const occ = names.map((n) => occluderOf(n, groups.get(n)!));
  const proj = (p: V3) => project(cam, p);

  // Screen boxes and sample points per group.
  const info = names.map((n) => {
    const pts: P2[] = [];
    const centers: P2[] = [];
    let depth = 0;
    let count = 0;
    for (const p of groups.get(n)!) {
      if (p.k === 'solid') {
        const sp = p.verts.map(proj);
        pts.push(...sp);
        centers.push([sp.reduce((s, q) => s + q[0], 0) / sp.length, sp.reduce((s, q) => s + q[1], 0) / sp.length]);
        for (const v of p.verts) {
          depth += depthOf(cam, v);
          count++;
        }
      } else {
        const c = proj(p.c);
        pts.push([c[0] - p.r, c[1] - p.r], [c[0] + p.r, c[1] + p.r]);
        centers.push(c);
        depth += depthOf(cam, p.c);
        count++;
      }
    }
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    return {
      box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      centers,
      depth: depth / Math.max(1, count),
    };
  });

  // Pairwise: which of two overlapping groups is in front, by rays through
  // points where both are.
  const before: Set<number>[] = names.map(() => new Set());
  for (let a = 0; a < names.length; a++)
    for (let b = a + 1; b < names.length; b++) {
      const A = info[a].box;
      const B = info[b].box;
      const ix0 = Math.max(A[0], B[0]);
      const iy0 = Math.max(A[1], B[1]);
      const ix1 = Math.min(A[2], B[2]);
      const iy1 = Math.min(A[3], B[3]);
      if (ix0 >= ix1 || iy0 >= iy1) continue;
      const samples: P2[] = [...info[a].centers, ...info[b].centers, [(ix0 + ix1) / 2, (iy0 + iy1) / 2]];
      for (let gx = 1; gx < 4; gx++)
        for (let gy = 1; gy < 4; gy++) samples.push([ix0 + ((ix1 - ix0) * gx) / 4, iy0 + ((iy1 - iy0) * gy) / 4]);
      let vote = 0;
      for (const s of samples) {
        const da = firstHit(occ[a], cam, s);
        const db = firstHit(occ[b], cam, s);
        if (da === null || db === null) continue;
        vote += da > db + 1e-6 ? 1 : db > da + 1e-6 ? -1 : 0;
      }
      if (vote > 0) before[a].add(b); // b is drawn before a
      else if (vote < 0) before[b].add(a);
    }
  // Topological order, far first, ties broken by mean depth.
  const order: number[] = [];
  const done = new Set<number>();
  while (order.length < names.length) {
    const ready = names
      .map((_, i) => i)
      .filter((i) => !done.has(i) && [...before[i]].every((j) => done.has(j)));
    const pool = ready.length ? ready : names.map((_, i) => i).filter((i) => !done.has(i));
    pool.sort((x, y) => info[x].depth - info[y].depth);
    order.push(pool[0]);
    done.add(pool[0]);
  }

  // Line pieces and dots, each assigned to the gap before its first hider.
  interface Piece {
    slot: number;
    depth: number;
    op: Op;
  }
  const pieces: Piece[] = [];
  const unders: Op[] = [];
  const slotOf = (p: V3): number => {
    let s = order.length;
    for (let k = 0; k < order.length; k++)
      if (hides(occ[order[k]], p, cam.dir)) {
        s = k;
        break;
      }
    return s;
  };
  for (const p of shown) {
    if (p.k === 'line') {
      const tone = toneOf(p);
      // A limb that holds still is drawn a little thinner, as the old static
      // legs were, so the moving ones lead the eye.
      const w = p.w ?? (tone === 'move' ? 3 : 2.5);
      const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const n = Math.max(1, Math.ceil(dist(a, b) / PIECE));
        for (let k = 0; k < n; k++) {
          const pa = lerp(a, b, k / n);
          const pb = lerp(a, b, (k + 1) / n);
          const op: Op = { op: 'seg', a: proj(pa), b: proj(pb), w, tone };
          if (p.under) {
            unders.push(op);
            continue;
          }
          const m = lerp(pa, pb, 0.5);
          pieces.push({ slot: slotOf(m), depth: depthOf(cam, m), op });
        }
      }
    } else if (p.k === 'dot') {
      pieces.push({
        slot: slotOf(p.probe ?? p.p),
        depth: depthOf(cam, p.p) + (p.lift ?? 0.5),
        op: { op: 'dot', c: proj(p.p), r: p.movesWith && toneOf(p) !== 'move' ? 3.4 : p.r, tone: toneOf(p), ring: !!p.ring },
      });
    }
  }

  const ops: Op[] = [];
  for (const p of shown) if (p.k === 'floor' && level(cam)) ops.push({ op: 'floor', y: project(cam, [0, p.y, 0])[1] });
  ops.push(...unders);
  const groupOp = (gi: number): Op => {
    const g = groups.get(names[gi])!;
    if (g.length === 1 && g[0].k === 'ball') {
      const b = g[0];
      return { op: 'ball', c: proj(b.c), r: b.r, w: b.w ?? 2.5, tone: toneOf(b) };
    }
    return {
      op: 'group',
      parts: g.map((s) => {
        if (s.k === 'ball') {
          const c = proj(s.c);
          const pts: P2[] = [];
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            pts.push([c[0] + s.r * Math.cos(a), c[1] + s.r * Math.sin(a)]);
          }
          return { pts, round: pts.map(() => 0), w: s.w ?? 2.5, tone: toneOf(s) };
        }
        const sp = s.verts.map(proj);
        const idx = hullIdx(sp);
        const r = s.round ?? 0;
        return { pts: idx.map((i) => sp[i]), round: idx.map((i) => (typeof r === 'number' ? r : r[i])), w: s.w ?? 2.5, tone: toneOf(s) };
      }),
    };
  };
  for (let k = 0; k <= order.length; k++) {
    pieces
      .filter((p) => p.slot === k)
      .sort((a, b) => a.depth - b.depth)
      .forEach((p) => ops.push(p.op));
    if (k < order.length) ops.push(groupOp(order[k]));
  }
  return ops;
}

/** Every point a primitive puts on screen, with the margin its width or radius adds in box units. */
export function extentOf(p: Prim, cam: Camera): { pts: P2[]; pad: number; cm: number } | null {
  if (p.k === 'floor') return null;
  if (p.k === 'line') return { pts: p.pts.map((q) => project(cam, q)), pad: (p.w ?? 3) / 2, cm: 0 };
  if (p.k === 'dot') return { pts: [project(cam, p.p)], pad: p.r, cm: 0 };
  if (p.k === 'solid') return { pts: p.verts.map((q) => project(cam, q)), pad: (p.w ?? 2.5) / 2, cm: 0 };
  return { pts: [project(cam, p.c)], pad: (p.w ?? 2.5) / 2, cm: p.r };
}

/** Points a primitive is made of, for telling whether it moved. */
export function pointsOf(p: Prim): V3[] {
  if (p.k === 'floor') return [];
  if (p.k === 'line') return p.pts;
  if (p.k === 'dot') return [p.p];
  if (p.k === 'solid') return p.verts;
  return [p.c];
}

/* ---------- the body as primitives ---------- */

const torsoPart = (name: string, verts: V3[], round: number | number[], rings: [number, number]): PSolid => ({
  k: 'solid',
  part: `torso.${name}`,
  group: 'torso',
  verts,
  faces: HEXA_FACES,
  round,
  // About the outline's corner rounding, in cm at the usual scale.
  chamfer: 5,
  inset: [...rings, INSET, INSET, INSET, INSET],
});

/**
 * Arms and legs as lines with dots at the joints, the torso as three solids
 * drawn as one outline, the head as a ball, and the shoulder blades as arcs on
 * the back.
 */
export function bodyPrims(b: Body): Prim[] {
  const j = b.j;
  const out: Prim[] = [
    // Corners 0 to 3 are each part's lower ring, 4 to 7 its upper ring, and
    // faces 0 and 1 are those rings. Only the outer ends round: the seat end
    // of the pelvis and the shoulder end of the upper torso.
    torsoPart('pelvis', b.torso.pelvis, [6, 6, 6, 6, 0, 0, 0, 0], [INSET, -INSET]),
    torsoPart('lumbar', b.torso.lumbar, 0, [-INSET, -INSET]),
    torsoPart('lower', b.torso.lower, 0, [-INSET, -INSET]),
    torsoPart('thoracic', b.torso.thoracic, 0, [-INSET, -INSET]),
    torsoPart('upper', b.torso.upper, [0, 0, 0, 0, 7, 7, 7, 7], [-INSET, INSET]),
    { k: 'ball', part: 'head', group: 'head', c: b.head.c, r: b.head.r },
    { k: 'line', part: 'scapR', pts: b.blade.R, w: 2.5 },
    { k: 'line', part: 'scapL', pts: b.blade.L, w: 2.5 },
  ];
  for (const s of ['R', 'L'] as const) {
    const arm = `arm${s}`;
    const leg = `leg${s}`;
    out.push(
      { k: 'line', part: `${arm}.upper`, pts: [j[`shoulder${s}`], j[`elbow${s}`]] },
      { k: 'line', part: `${arm}.lower`, pts: [j[`elbow${s}`], j[`hand${s}`]] },
      {
        k: 'dot',
        part: `${arm}.shoulder`,
        p: j[`shoulder${s}`],
        r: 4.4,
        movesWith: [`${arm}.upper`],
        probe: add(j[`shoulder${s}`], mul(norm(sub(j[`elbow${s}`], j[`shoulder${s}`])), 4)),
      },
      { k: 'dot', part: `${arm}.elbow`, p: j[`elbow${s}`], r: 4.4, movesWith: [`${arm}.upper`, `${arm}.lower`] },
      { k: 'dot', part: `${arm}.hand`, p: j[`hand${s}`], r: 4.8, movesWith: [`${arm}.lower`], lift: 2 },
      { k: 'line', part: `${leg}.thigh`, pts: [j[`hip${s}`], j[`knee${s}`]] },
      { k: 'line', part: `${leg}.shin`, pts: [j[`knee${s}`], j[`ankle${s}`]] },
      { k: 'line', part: `${leg}.foot`, pts: [j[`ankle${s}`], j[`heel${s}`], j[`toe${s}`]], closed: true, w: 2.5 },
      { k: 'dot', part: `${leg}.knee`, p: j[`knee${s}`], r: 4.4, movesWith: [`${leg}.thigh`, `${leg}.shin`] },
      { k: 'dot', part: `${leg}.ankle`, p: j[`ankle${s}`], r: 4.4, movesWith: [`${leg}.shin`, `${leg}.foot`] },
    );
  }
  return out;
}

/** Unit vector square to a, preferring the direction of hint. */
export function perpTo(a: V3, hint: V3): V3 {
  const u = norm(a);
  let w = sub(hint, mul(u, dot(hint, u)));
  if (len(w) < 1e-6) w = cross(u, Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  return norm(w);
}
