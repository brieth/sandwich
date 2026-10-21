/**
 * Small 3D vector and rotation helpers for the figure engine.
 *
 * World and body frames share one convention: x to the person's right, y down,
 * z forward. Lengths are centimeters.
 */

export type V3 = [number, number, number];
/** Unit quaternion, [w, x, y, z]. */
export type Q = [number, number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: V3, b: V3): number => len(sub(a, b));
export const norm = (a: V3): V3 => {
  const l = len(a);
  return l < 1e-9 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const lerpN = (a: number, b: number, t: number): number => a + (b - a) * t;
export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;

/** Angle between two vectors, degrees. */
export function angleBetween(a: V3, b: V3): number {
  const c = dot(norm(a), norm(b));
  return deg(Math.acos(Math.max(-1, Math.min(1, c))));
}

/**
 * Spherical interpolation between directions. Past t = 1 it carries on around
 * the same great circle, which the fly uses to keep the forearm a fixed angle
 * ahead of the upper arm.
 */
export function slerpDir(a: V3, b: V3, t: number): V3 {
  const na = norm(a);
  const nb = norm(b);
  const om = Math.acos(Math.max(-1, Math.min(1, dot(na, nb))));
  if (om < 1e-6) return na;
  const so = Math.sin(om);
  return add(mul(na, Math.sin((1 - t) * om) / so), mul(nb, Math.sin(t * om) / so));
}

export const Q_ID: Q = [1, 0, 0, 0];

export function qAxis(axis: V3, degrees: number): Q {
  const n = norm(axis);
  const h = rad(degrees) / 2;
  const s = Math.sin(h);
  return [Math.cos(h), n[0] * s, n[1] * s, n[2] * s];
}

/** Product a then b applied to a vector is qMul(b, a); qMul(a, b) applies b first. */
export function qMul(a: Q, b: Q): Q {
  return [
    a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
    a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
    a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
    a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
  ];
}

export function qRot(q: Q, v: V3): V3 {
  const [w, x, y, z] = q;
  // v' = v + 2w(u x v) + 2u x (u x v), u = (x, y, z)
  const u: V3 = [x, y, z];
  const uv = cross(u, v);
  const uuv = cross(u, uv);
  return add(v, add(mul(uv, 2 * w), mul(uuv, 2)));
}

export function qSlerp(a: Q, b: Q, t: number): Q {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) {
    d = -d;
    bb = [-b[0], -b[1], -b[2], -b[3]];
  }
  if (d > 0.9995) {
    const r: Q = [
      a[0] + (bb[0] - a[0]) * t,
      a[1] + (bb[1] - a[1]) * t,
      a[2] + (bb[2] - a[2]) * t,
      a[3] + (bb[3] - a[3]) * t,
    ];
    const l = Math.hypot(...r);
    return [r[0] / l, r[1] / l, r[2] / l, r[3] / l];
  }
  const om = Math.acos(d);
  const so = Math.sin(om);
  const ka = Math.sin((1 - t) * om) / so;
  const kb = Math.sin(t * om) / so;
  return [ka * a[0] + kb * bb[0], ka * a[1] + kb * bb[1], ka * a[2] + kb * bb[2], ka * a[3] + kb * bb[3]];
}

/*
 * Named body rotations, in the frame they are applied in. x right, y down, z
 * forward is right-handed, so a positive turn about +y carries forward toward
 * the right, while tipping up toward forward is a negative turn about +x.
 */

/** Tip forward about the x axis: up, (0, -1, 0), goes toward +z. */
export const pitchFwd = (degrees: number): Q => qAxis([1, 0, 0], -degrees);
/** Turn toward the person's right about the vertical: forward, +z, goes toward +x. */
export const turnRight = (degrees: number): Q => qAxis([0, 1, 0], degrees);
/** Bend sideways toward the person's right: up goes toward +x. */
export const bendRight = (degrees: number): Q => qAxis([0, 0, 1], degrees);
