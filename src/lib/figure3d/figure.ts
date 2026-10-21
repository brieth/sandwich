/**
 * A figure: a pose through the rep, the equipment around it, and the angles
 * it is drawn from. prepare() works out once what moves and how big to draw
 * it; opsAt() gives one frame's drawing steps.
 *
 * t runs from 0, the stretch, to 1, fully contracted. The renderer feeds it
 * through the tempo curve, so a figure only says where things are at each t.
 */
import type { Body, BodySpec, JointName } from './body';
import { solveBody } from './body';
import type { V3 } from './math';
import { dist } from './math';
import type { Camera, Op, P2, Prim, Tone } from './scene';
import { bodyPrims, extentOf, hidden, layout, level, pointsOf, project } from './scene';

export interface ViewDef {
  /** Button text: Front, Back, Side or Top. */
  label: string;
  cam: Camera;
  /** Parts not drawn from this angle, matched by prefix, e.g. 'leg' for both legs. */
  hide?: string[];
  /** Turns the drawing clockwise on screen, in degrees, for a figure that lies along the room. */
  turn?: number;
}

export type MuscleName =
  | 'pecSternal'
  | 'pecClavicular'
  | 'lat'
  | 'teresMajor'
  | 'rearDelt'
  | 'sideDelt'
  | 'frontDelt'
  | 'midTrap'
  | 'upperTrap'
  | 'tricepsLong'
  | 'tricepsShort'
  | 'bicepsLong'
  | 'bicepsShort'
  | 'brachialis'
  | 'brachioradialis'
  | 'quadsVasti'
  | 'rectusFemoris'
  | 'hamstrings'
  | 'gluteMax'
  | 'gluteMed'
  | 'adductors'
  | 'rectusAbdominis'
  | 'obliqueExt'
  | 'obliqueInt';

export interface Force {
  /** Where the force acts. */
  at: V3;
  /** Its direction, any length. */
  dir: V3;
}

export interface CheckDef {
  /** What the exercise trains. Each should be longest at t = 0 and clearly shorter at t = 1. */
  muscles: { m: MuscleName; side: 'R' | 'L' }[];
  /** Further length proxies a figure defines for itself, checked the same way. */
  custom?: { name: string; len: (b: Body) => number }[];
  /** The external force on the body at t, for the leverage table. */
  load?: (b: Body, t: number) => Force[];
  /** Joints the load turns, each with the end of the moving limb that sets its axis. */
  lever?: { joint: JointName; end: JointName }[];
  /** Places the body should touch the equipment or the floor. gap is the distance, tol what counts as touching (default 1.5). */
  contacts?: (b: Body, t: number) => { name: string; gap: number; tol?: number }[];
  /** Part pairs allowed to touch, as 'a~b' prefixes: 'armR.lower~head' for a hand that finishes by the face. */
  allow?: string[];
}

export interface FigureDef {
  views: ViewDef[];
  pose: (t: number) => BodySpec;
  equipment?: (b: Body, t: number) => Prim[];
  check?: CheckDef;
}

export interface Frame {
  body: Body;
  prims: Prim[];
}

export function frameAt(def: FigureDef, t: number): Frame {
  const body = solveBody(def.pose(t));
  return { body, prims: [...bodyPrims(body), ...(def.equipment?.(body, t) ?? [])] };
}

export interface Prepared {
  def: FigureDef;
  /** Body parts that move more than MOVE_CM through the rep. */
  moving: Set<string>;
  /** Box size in box units, the same for every view so switching angles keeps the drawing still. */
  W: number;
  H: number;
  /** Box units per centimeter, the same for every view. */
  scale: number;
  /** Center of each view's drawing, in rotated screen centimeters. */
  centers: P2[];
}

/** Moving means some point of the part travels farther than this, in cm. */
export const MOVE_CM = 0.75;
export const BOX_W = 240;
/** Tallest box. A standing figure under a high pulley needs about this much. */
const MAX_H = 250;
/** Clear space round the drawing, in box units, enough for a hand's dot. */
const MARGIN = 10;
/** Upper bound on the scale, so a small figure is not drawn larger than a person elsewhere. */
const MAX_SCALE = 1.35;
const SAMPLES = 24;

const turnP = (p: P2, deg: number): P2 => {
  if (!deg) return p;
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

export function toneFor(moving: Set<string>) {
  return (p: Prim): Tone => {
    if (p.tone) return p.tone;
    if (p.k === 'dot' && p.movesWith) return p.movesWith.some((m) => moving.has(m)) ? 'move' : 'body';
    return moving.has(p.part) ? 'move' : 'body';
  };
}

export function prepare(def: FigureDef): Prepared {
  const frames = Array.from({ length: SAMPLES + 1 }, (_, i) => frameAt(def, i / SAMPLES));

  // Body parts are matched by name, which is unique among them.
  const moving = new Set<string>();
  const start = new Map<string, Prim>();
  for (const p of frames[0].prims) if (!p.tone && !start.has(p.part)) start.set(p.part, p);
  for (const f of frames.slice(1))
    f.prims.forEach((p) => {
      if (p.tone) return;
      const p0 = start.get(p.part);
      if (!p0) return;
      const a = pointsOf(p0);
      const b = pointsOf(p);
      for (let k = 0; k < Math.min(a.length, b.length); k++)
        if (dist(a[k], b[k]) > MOVE_CM) {
          moving.add(p.part);
          break;
        }
    });

  // Extent of each view across the whole rep, in rotated screen cm, plus the
  // largest pad any primitive adds in box units.
  const ext = def.views.map((v) => {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const f of frames)
      for (const p of f.prims) {
        if (p.fit === false || hidden(p.part, v.hide)) continue;
        if (p.k === 'floor') {
          if (!level(v.cam)) continue;
          const y = project(v.cam, [0, p.y, 0])[1];
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
          continue;
        }
        const e = extentOf(p, v.cam);
        if (!e) continue;
        for (const q of e.pts) {
          const r = turnP(q, v.turn ?? 0);
          x0 = Math.min(x0, r[0] - e.cm);
          y0 = Math.min(y0, r[1] - e.cm);
          x1 = Math.max(x1, r[0] + e.cm);
          y1 = Math.max(y1, r[1] + e.cm);
        }
      }
    return { x0, y0, x1, y1 };
  });

  let scale = MAX_SCALE;
  for (const e of ext) {
    scale = Math.min(scale, (BOX_W - 2 * MARGIN) / Math.max(1, e.x1 - e.x0), (MAX_H - 2 * MARGIN) / Math.max(1, e.y1 - e.y0));
  }
  const H = Math.ceil(Math.max(...ext.map((e) => (e.y1 - e.y0) * scale + 2 * MARGIN)));
  return {
    def,
    moving,
    W: BOX_W,
    H,
    scale,
    centers: ext.map((e) => [(e.x0 + e.x1) / 2, (e.y0 + e.y1) / 2] as P2),
  };
}

/** One frame's drawing steps for one view, in box units. */
export function opsAt(prep: Prepared, view: number, t: number): Op[] {
  const v = prep.def.views[view];
  const f = frameAt(prep.def, t);
  const ops = layout(f.prims, v.cam, toneFor(prep.moving), v.hide);
  const c = prep.centers[view];
  const s = prep.scale;
  const to = (p: P2): P2 => {
    const r = turnP(p, v.turn ?? 0);
    return [(r[0] - c[0]) * s + prep.W / 2, (r[1] - c[1]) * s + prep.H / 2];
  };
  return ops.map((o): Op => {
    switch (o.op) {
      case 'group':
        return { ...o, parts: o.parts.map((p) => ({ ...p, pts: p.pts.map(to) })) };
      case 'ball':
        return { ...o, c: to(o.c), r: o.r * s };
      case 'seg':
        return { ...o, a: to(o.a), b: to(o.b) };
      case 'dot':
        return { ...o, c: to(o.c) };
      case 'floor':
        return { op: 'floor', y: to([c[0], o.y])[1] };
    }
  });
}
