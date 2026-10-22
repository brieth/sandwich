/**
 * Shared pieces for writing figures: interpolation across the rep, the
 * standard angles, and directions written the way a coach would say them.
 */
import { CAM } from '../figure3d/scene';
import type { FigureDef, ViewDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { norm, rad, slerpDir } from '../figure3d/math';

export { DIM } from '../figure3d/body';

/** What the modal says under a figure. */
export interface Cue {
  /** The position to reach, in one line. */
  reach: string;
  /**
   * Each point as [label, text]: a word or two naming the step (Setup,
   * Stretch, the movement, Avoid) and what to do there. The label lets a
   * reader find the step at a glance, and every point says which way to go.
   */
  points: [string, string][];
}

/**
 * One file's worth of figures: usually the variants of one movement. Each
 * figure key has a cue, and each exercise id that shows a figure names its key.
 */
export interface Group {
  figures: Record<string, FigureDef>;
  cues: Record<string, Cue>;
  exercises: Record<string, string>;
}

/**
 * Piecewise linear through keys [t, value], t from 0 (stretch) to 1
 * (contracted). Numbers, vectors and flat objects of numbers all work. Linear
 * is enough because t itself already follows the tempo's ease.
 */
export function key<T extends number | V3 | Record<string, number>>(t: number, keys: [number, T][]): T {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const k = (t - t0) / (t1 - t0);
      return blend(v0, v1, k) as T;
    }
  }
  return keys[keys.length - 1][1];
}

function blend(a: unknown, b: unknown, k: number): unknown {
  if (typeof a === 'number') return a + ((b as number) - a) * k;
  if (Array.isArray(a)) return a.map((v, i) => v + ((b as number[])[i] - v) * k);
  const out: Record<string, number> = {};
  const ao = a as Record<string, number>;
  const bo = b as Record<string, number>;
  for (const n of new Set([...Object.keys(ao), ...Object.keys(bo)])) out[n] = (ao[n] ?? 0) + ((bo[n] ?? 0) - (ao[n] ?? 0)) * k;
  return out;
}

/** Directions through keys by spherical interpolation, so a limb swings rather than shortening. */
export function keyDir(t: number, keys: [number, V3][]): V3 {
  if (t <= keys[0][0]) return norm(keys[0][1]);
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      return slerpDir(v0, v1, (t - t0) / (t1 - t0));
    }
  }
  return norm(keys[keys.length - 1][1]);
}

/**
 * A direction from a heading and an elevation, in the body frame.
 *
 * Heading is degrees in the horizontal plane measured from straight out to the
 * right, positive toward the back: 0 is out to the side, 90 straight back, -90
 * straight forward, 180 out to the left. It is the angle a top view draws,
 * where down the page is backward. Elevation is degrees above horizontal.
 */
export function dirHE(heading: number, elevation: number): V3 {
  const h = rad(heading);
  const e = rad(elevation);
  return [Math.cos(h) * Math.cos(e), -Math.sin(e), -Math.sin(h) * Math.cos(e)];
}

/** Mirror across the body's midline, for the left side of a symmetric movement. */
export const mx = (v: V3): V3 => [-v[0], v[1], v[2]];

export const VIEW: Record<'front' | 'back' | 'side' | 'sideRight' | 'top', ViewDef> = {
  front: { label: 'Front', cam: CAM.front },
  back: { label: 'Back', cam: CAM.back },
  side: { label: 'Side', cam: CAM.side },
  sideRight: { label: 'Side', cam: CAM.sideRight },
  top: { label: 'Top', cam: CAM.top },
};
