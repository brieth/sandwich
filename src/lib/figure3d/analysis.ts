/**
 * Checks on a figure, run by scripts/figures/check.mjs and never by the app:
 * muscle lengths through the rep, how hard the load turns the working joint,
 * joint ranges, and whether anything passes through anything else.
 *
 * Muscle lengths are straight-line paths between landmarks, wrapped through a
 * via point where the real muscle bends round the body, plus a term per joint
 * angle where it wraps a joint. They are proxies: good for which way a length
 * changes and roughly how much, not for absolute centimeters.
 */
import type { Body, SegName } from './body';
import { DIM } from './body';
import type { FigureDef, MuscleName } from './figure';
import { frameAt } from './figure';
import type { V3 } from './math';
import { add, angleBetween, cross, deg, dist, dot, len, mul, norm, rad, sub } from './math';
import type { PSolid, Prim } from './scene';
import { perpTo } from './scene';

/* ---------- joint angles ---------- */

const segDir = (a: V3, b: V3) => norm(sub(b, a));

export function elbowFlex(b: Body, s: 'R' | 'L'): number {
  return angleBetween(sub(b.j[`elbow${s}`], b.j[`shoulder${s}`]), sub(b.j[`hand${s}`], b.j[`elbow${s}`]));
}

export function kneeFlex(b: Body, s: 'R' | 'L'): number {
  return angleBetween(sub(b.j[`knee${s}`], b.j[`hip${s}`]), sub(b.j[`ankle${s}`], b.j[`knee${s}`]));
}

/** Hip flexion: thigh forward of the pelvis's down axis, degrees, negative behind it. */
export function hipFlex(b: Body, s: 'R' | 'L'): number {
  const th = segDir(b.j[`hip${s}`], b.j[`knee${s}`]);
  const down = b.dirOf('pelvis', [0, 1, 0]);
  const fwd = b.dirOf('pelvis', [0, 0, 1]);
  return deg(Math.atan2(dot(th, fwd), dot(th, down)));
}

/** Hip abduction: thigh out from the pelvis's down axis toward its own side, degrees. */
export function hipAbd(b: Body, s: 'R' | 'L'): number {
  const th = segDir(b.j[`hip${s}`], b.j[`knee${s}`]);
  const down = b.dirOf('pelvis', [0, 1, 0]);
  const out = b.dirOf('pelvis', [s === 'R' ? 1 : -1, 0, 0]);
  return deg(Math.atan2(dot(th, out), dot(th, down)));
}

/** Upper arm against the upper torso: elevation from hanging, and how far forward of the side it points. */
export function shoulderAngles(b: Body, s: 'R' | 'L') {
  const ua = segDir(b.j[`shoulder${s}`], b.j[`elbow${s}`]);
  const down = b.dirOf('upper', [0, 1, 0]);
  const out = b.dirOf('upper', [s === 'R' ? 1 : -1, 0, 0]);
  const fwd = b.dirOf('upper', [0, 0, 1]);
  return {
    elevation: angleBetween(ua, down),
    /** Degrees of the arm's horizontal direction forward of straight out to the side; negative is behind. */
    forward: deg(Math.atan2(dot(ua, fwd), dot(ua, out))),
  };
}

/** Knee bends the right way: the shin folds behind the thigh about the pelvis's left-right axis. */
function kneeBendsBack(b: Body, s: 'R' | 'L'): boolean {
  const th = sub(b.j[`knee${s}`], b.j[`hip${s}`]);
  const sh = sub(b.j[`ankle${s}`], b.j[`knee${s}`]);
  return dot(cross(th, sh), b.dirOf('pelvis', [1, 0, 0])) < 0;
}

/* ---------- muscles ---------- */

const pathLen = (pts: V3[]) => pts.slice(1).reduce((s, p, i) => s + dist(p, pts[i]), 0);

/** Point k along the upper arm from the shoulder. */
const humerus = (b: Body, s: 'R' | 'L', k: number) =>
  add(b.j[`shoulder${s}`], mul(segDir(b.j[`shoulder${s}`], b.j[`elbow${s}`]), k));
const femur = (b: Body, s: 'R' | 'L', k: number) => add(b.j[`hip${s}`], mul(segDir(b.j[`hip${s}`], b.j[`knee${s}`]), k));

/** A body-coordinate landmark on the right, mirrored for the left. */
const lm = (b: Body, seg: SegName, s: 'R' | 'L', p: V3) => b.at(seg, s === 'R' ? p : [-p[0], p[1], p[2]]);

/** A point that rides with the shoulder blade: the shoulder joint plus an offset in the upper torso's axes. */
const onBlade = (b: Body, s: 'R' | 'L', off: V3) =>
  add(b.j[`shoulder${s}`], b.dirOf('upper', s === 'R' ? off : [-off[0], off[1], off[2]]));

export function muscleLength(b: Body, m: MuscleName, s: 'R' | 'L'): number {
  const o: 'R' | 'L' = s === 'R' ? 'L' : 'R';
  const ef = rad(elbowFlex(b, s));
  const kf = rad(kneeFlex(b, s));
  // Inferior angle of the blade, from the blade's own drawn arc.
  const inferior = s === 'R' ? b.blade.R[8] : b.blade.L[8];
  const lateralOfThigh = () => {
    const th = segDir(b.j[`hip${s}`], b.j[`knee${s}`]);
    return perpTo(th, b.dirOf('pelvis', [s === 'R' ? 1 : -1, 0, 0]));
  };
  switch (m) {
    case 'pecSternal':
      return dist(b.at('upper', [0, -40, 15]), humerus(b, s, 10));
    case 'pecClavicular':
      return dist(lm(b, 'upper', s, [8, -56, 12]), humerus(b, s, 10));
    case 'lat':
      return pathLen([lm(b, 'lower', s, [7, -10, -12]), inferior, humerus(b, s, 8)]);
    case 'teresMajor':
      return dist(inferior, humerus(b, s, 6));
    case 'rearDelt':
      return dist(onBlade(b, s, [-3, -3, -6]), humerus(b, s, 12));
    case 'sideDelt':
      return dist(onBlade(b, s, [2, -4, 0]), humerus(b, s, 12));
    case 'frontDelt':
      return dist(onBlade(b, s, [-3, -3, 4]), humerus(b, s, 12));
    case 'midTrap':
      return dist(b.at('upper', [0, -45, -14]), onBlade(b, s, [-16, 12, -14]));
    case 'upperTrap':
      return dist(b.at('head', [0, -70, -6]), onBlade(b, s, [2, -4, 0]));
    case 'tricepsLong':
      return dist(onBlade(b, s, [0, 3, -3]), b.j[`elbow${s}`]) + 2 * ef;
    case 'tricepsShort':
      return 30 + 2 * ef;
    case 'bicepsLong':
      return dist(onBlade(b, s, [0, -1, 2.5]), b.j[`elbow${s}`]) + 4 - 3.5 * ef;
    case 'bicepsShort':
      return dist(onBlade(b, s, [-3, -2, 5]), b.j[`elbow${s}`]) + 4 - 3.5 * ef;
    case 'brachialis':
      return 30 - 2.5 * ef;
    case 'brachioradialis':
      return 30 - 4 * ef;
    case 'quadsVasti':
      return 40 + 4 * kf;
    case 'rectusFemoris':
      return dist(lm(b, 'pelvis', s, [9, -4, 9]), b.j[`knee${s}`]) + 4 * kf;
    case 'hamstrings':
      return dist(lm(b, 'pelvis', s, [7, 6, -7]), b.j[`knee${s}`]) - 3 * kf;
    case 'gluteMax':
      return dist(lm(b, 'pelvis', s, [5, -6, -11]), femur(b, s, 10));
    case 'gluteMed':
      return dist(lm(b, 'pelvis', s, [13, -11, 0]), add(femur(b, s, 2), mul(lateralOfThigh(), 5)));
    case 'adductors':
      return dist(lm(b, 'pelvis', s, [3, 4, 7]), add(femur(b, s, 22), mul(lateralOfThigh(), -1.5)));
    case 'rectusAbdominis':
      return pathLen([b.at('upper', [0, -38, 14]), b.at('lower', [0, -20, 13]), b.at('pelvis', [0, -4, 10]), b.at('pelvis', [0, 6, 8])]);
    case 'obliqueExt':
      // Right external oblique: right lower ribs down and across to the left
      // of the pelvis, round the front of the waist.
      return pathLen([lm(b, 'upper', s, [14, -35, 8]), b.at('lower', [0, -15, 13.5]), lm(b, 'pelvis', o, [6, 3, 9])]);
    case 'obliqueInt':
      // Right internal oblique: right iliac crest up and across to the left ribs.
      return pathLen([lm(b, 'pelvis', s, [12, -8, 2]), b.at('lower', [0, -18, 13.5]), lm(b, 'upper', o, [10, -32, 10])]);
  }
}

/* ---------- leverage ---------- */

/**
 * Share of a force's full leverage that turns the joint the way the limb
 * moves: the torque about the motion's axis over the force times its distance
 * from the joint. 1 is a force square to the limb in the plane it moves in; 0
 * is a force along the limb, or one that only twists it.
 */
function leverShare(def: FigureDef, t: number, li: number): { share: number; sine: number; sign: number } | null {
  const lev = def.check?.lever?.[li];
  const load = def.check?.load;
  if (!lev || !load) return null;
  const dt = 0.01;
  const f0 = frameAt(def, t);
  const f1 = frameAt(def, Math.min(1, t + dt));
  const fm = frameAt(def, Math.max(0, t - dt));
  const forces = load(f0.body, t);
  const F = forces[Math.min(li, forces.length - 1)];
  const J = f0.body.j[lev.joint];
  const v0 = sub(fm.body.j[lev.end], fm.body.j[lev.joint]);
  const v1 = sub(f1.body.j[lev.end], f1.body.j[lev.joint]);
  const axis = cross(v0, v1);
  const r = sub(F.at, J);
  const fh = norm(F.dir);
  const sine = len(cross(norm(r), fh));
  if (len(axis) < 1e-9) return { share: 0, sine, sign: 0 };
  const ax = norm(axis);
  const tau = dot(cross(r, fh), ax);
  // Positive when the force turns the limb back toward the stretch, which is
  // what a load resisting the contraction does.
  return { share: Math.abs(tau) / Math.max(1e-9, len(r)), sine, sign: -Math.sign(tau) };
}

/* ---------- collisions ---------- */

interface Capsule {
  part: string;
  a: V3;
  b: V3;
  r: number;
}

/** Signed distance to a convex solid, by its face planes: negative inside. Outside, it can read a little short at edges. */
function sdSolid(s: PSolid, p: V3): number {
  const c = mul(s.verts.reduce((acc, v) => add(acc, v), [0, 0, 0] as V3), 1 / s.verts.length);
  let best = -Infinity;
  let planes = 0;
  for (const f of s.faces) {
    let n: V3 = [0, 0, 0];
    for (let i = 0; i < f.length; i++) {
      const a = s.verts[f[i]];
      const bb = s.verts[f[(i + 1) % f.length]];
      n = add(n, [(a[1] - bb[1]) * (a[2] + bb[2]), (a[2] - bb[2]) * (a[0] + bb[0]), (a[0] - bb[0]) * (a[1] + bb[1])]);
    }
    if (len(n) < 1e-9) continue;
    n = norm(n);
    const p0 = s.verts[f[0]];
    const side = dot(n, sub(c, p0));
    if (Math.abs(side) < 1e-3) continue;
    if (side > 0) n = mul(n, -1);
    planes++;
    best = Math.max(best, dot(n, sub(p, p0)));
  }
  // A flat solid, like a joint filler on a straight torso, has no inside.
  return planes >= 4 ? best : Infinity;
}

function segSeg(p1: V3, q1: V3, p2: V3, q2: V3): number {
  // Closest distance between two segments, sampled finely enough for a check.
  let best = Infinity;
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const a = add(p1, mul(sub(q1, p1), i / n));
    const d = sub(q2, p2);
    const l2 = dot(d, d);
    const k = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, dot(sub(a, p2), d) / l2));
    best = Math.min(best, dist(a, add(p2, mul(d, k))));
  }
  return best;
}

const allowed = (allow: string[] | undefined, a: string, b: string) =>
  !!allow?.some((pair) => {
    const [x, y] = pair.split('~');
    return (a.startsWith(x) && b.startsWith(y)) || (a.startsWith(y) && b.startsWith(x));
  });

/* ---------- report ---------- */

export interface Issue {
  t: number;
  what: string;
}

export interface Report {
  issues: Issue[];
  muscles: { name: string; lengths: number[]; maxAt: number; drop: number }[];
  lever: { name: string; share: number[]; sine: number[]; sign: number[] }[];
  angles: Record<string, number[]>;
  ts: number[];
}

const SAMPLE_TS = Array.from({ length: 21 }, (_, i) => i / 20);
export const TABLE_TS = [0, 0.25, 0.5, 0.75, 1];

export function analyze(def: FigureDef): Report {
  const issues: Issue[] = [];
  const allow = def.check?.allow;
  const flag = (t: number, what: string) => issues.push({ t, what });

  for (const t of SAMPLE_TS) {
    const { body: b, prims } = frameAt(def, t);
    for (const [k, g] of Object.entries(b.gaps)) if (g > 0.5) flag(t, `${k} misses its target by ${g.toFixed(1)}`);
    for (const s of ['R', 'L'] as const) {
      const e = elbowFlex(b, s);
      if (e > 150) flag(t, `elbow${s} flexed ${e.toFixed(0)}, past 150`);
      const kf = kneeFlex(b, s);
      if (kf > 155) flag(t, `knee${s} flexed ${kf.toFixed(0)}, past 155`);
      if (kf > 5 && !kneeBendsBack(b, s)) flag(t, `knee${s} bends forward`);
      const hf = hipFlex(b, s);
      if (hf > 135) flag(t, `hip${s} flexed ${hf.toFixed(0)}, past 135`);
      if (hf < -25) flag(t, `hip${s} extended ${(-hf).toFixed(0)}, past 25`);
      const ha = hipAbd(b, s);
      if (ha > 50) flag(t, `hip${s} abducted ${ha.toFixed(0)}, past 50`);
      if (ha < -30) flag(t, `hip${s} adducted ${(-ha).toFixed(0)}, past 30`);
      const sa = shoulderAngles(b, s);
      if (sa.elevation > 182) flag(t, `shoulder${s} elevated ${sa.elevation.toFixed(0)}`);
    }
    const sp = b.spec;
    for (const [name, r, lim] of [
      ['lumbar', sp.lumbar, { flex: [-25, 50], side: 25, twist: 15 }],
      ['thoracic', sp.thoracic, { flex: [-25, 40], side: 25, twist: 40 }],
      ['neck', sp.neck, { flex: [-40, 50], side: 30, twist: 60 }],
    ] as const) {
      if (!r) continue;
      if ((r.flex ?? 0) < lim.flex[0] || (r.flex ?? 0) > lim.flex[1]) flag(t, `${name} flex ${r.flex} outside ${lim.flex.join(' to ')}`);
      if (Math.abs(r.side ?? 0) > lim.side) flag(t, `${name} side bend ${r.side} past ${lim.side}`);
      if (Math.abs(r.twist ?? 0) > lim.twist) flag(t, `${name} twist ${r.twist} past ${lim.twist}`);
    }

    // Body capsules. The first stretch of each limb starts inside the torso,
    // so it is left out of the torso test.
    const caps: (Capsule & { skipTorso: number })[] = [];
    for (const s of ['R', 'L'] as const) {
      caps.push(
        { part: `arm${s}.upper`, a: b.j[`shoulder${s}`], b: b.j[`elbow${s}`], r: 4.5, skipTorso: 7 },
        { part: `arm${s}.lower`, a: b.j[`elbow${s}`], b: b.j[`hand${s}`], r: 3.5, skipTorso: 0 },
        // 22 of thigh is the groin crease, where a seated thigh meets the belly.
        { part: `leg${s}.thigh`, a: b.j[`hip${s}`], b: b.j[`knee${s}`], r: 7, skipTorso: 22 },
        { part: `leg${s}.shin`, a: b.j[`knee${s}`], b: b.j[`ankle${s}`], r: 5, skipTorso: 0 },
      );
    }
    const torso = prims.filter((p): p is PSolid => p.k === 'solid' && p.group === 'torso');
    const equipSolids = prims.filter((p): p is PSolid => p.k === 'solid' && p.part.startsWith('eq.'));
    const head = b.head;
    for (const c of caps) {
      const L = dist(c.a, c.b);
      const steps = Math.max(2, Math.ceil(L));
      let worstTorso = Infinity;
      let worstHead = Infinity;
      const worstEq = new Map<string, number>();
      for (let i = 0; i <= steps; i++) {
        const along = (i / steps) * L;
        const p = add(c.a, mul(sub(c.b, c.a), i / steps));
        // A thigh meets the pelvis block at the groin crease whenever the hip
        // bends, so thighs are tested against the torso above it only.
        if (along >= c.skipTorso)
          for (const s of torso) if (!(c.part.includes('.thigh') && s.part === 'torso.pelvis')) worstTorso = Math.min(worstTorso, sdSolid(s, p) - c.r);
        worstHead = Math.min(worstHead, dist(p, head.c) - head.r - c.r);
        for (const s of equipSolids) worstEq.set(s.part, Math.min(worstEq.get(s.part) ?? Infinity, sdSolid(s, p) - c.r));
      }
      // 2.5 of give: an arm pressed across the chest, or a thigh against the
      // belly, squashes that much soft tissue on a real body.
      if (worstTorso < -2.5 && !allowed(allow, c.part, 'torso')) flag(t, `${c.part} into torso by ${(-worstTorso).toFixed(1)}`);
      if (worstHead < -1 && !allowed(allow, c.part, 'head')) flag(t, `${c.part} into head by ${(-worstHead).toFixed(1)}`);
      for (const [part, w] of worstEq)
        if (w < -2 && !allowed(allow, c.part, part)) flag(t, `${c.part} into ${part} by ${(-w).toFixed(1)}`);
    }
    // Limb against limb, skipping segments that share a joint.
    for (let i = 0; i < caps.length; i++)
      for (let k = i + 1; k < caps.length; k++) {
        const A = caps[i];
        const B = caps[k];
        if (A.part.slice(0, 4) === B.part.slice(0, 4)) continue;
        const d = segSeg(A.a, A.b, B.a, B.b) - A.r - B.r;
        if (d < -2 && !allowed(allow, A.part, B.part)) flag(t, `${A.part} into ${B.part} by ${(-d).toFixed(1)}`);
      }
    // Torso and head against equipment solids.
    for (const s of equipSolids) {
      for (const tp of torso)
        for (const v of tp.verts) {
          const d = sdSolid(s, v);
          if (d < -2 && !allowed(allow, tp.part, s.part)) {
            flag(t, `${tp.part} into ${s.part} by ${(-d).toFixed(1)}`);
            break;
          }
        }
      const hd = sdSolid(s, head.c) - head.r;
      if (hd < -1.5 && !allowed(allow, 'head', s.part)) flag(t, `head into ${s.part} by ${(-hd).toFixed(1)}`);
    }
    // Cables and bars against the body, leaving out the 6 nearest the hands.
    const lines = prims.filter((p) => p.k === 'line' && (p.tone === 'cable' || p.part.startsWith('eq.bar') || p.part.startsWith('eq.rope')));
    for (const ln of lines) {
      if (ln.k !== 'line') continue;
      for (let i = 0; i + 1 < ln.pts.length; i++) {
        const a = ln.pts[i];
        const e = ln.pts[i + 1];
        const L = dist(a, e);
        const steps = Math.max(2, Math.ceil(L / 1.5));
        for (let k = 0; k <= steps; k++) {
          const p = add(a, mul(sub(e, a), k / steps));
          const nearHand = ['handR', 'handL'].some((h) => dist(p, b.j[h as 'handR']) < 8);
          if (nearHand) continue;
          const tIn = Math.min(...torso.map((s) => sdSolid(s, p)));
          const hIn = dist(p, head.c) - head.r;
          if ((tIn < -0.5 && !allowed(allow, ln.part, 'torso')) || (hIn < -0.5 && !allowed(allow, ln.part, 'head'))) {
            flag(t, `${ln.part} through the ${tIn < -0.5 ? 'torso' : 'head'}`);
            k = steps + 1;
            i = ln.pts.length;
          }
          for (const c of caps) {
            if (allowed(allow, ln.part, c.part)) continue;
            const d = segSeg(p, p, c.a, c.b) - c.r;
            if (d < -1) {
              flag(t, `${ln.part} through ${c.part}`);
              k = steps + 1;
              i = ln.pts.length;
              break;
            }
          }
        }
      }
    }
    for (const c of def.check?.contacts?.(b, t) ?? [])
      if (Math.abs(c.gap) > (c.tol ?? 1.5)) flag(t, `${c.name} off by ${c.gap.toFixed(1)}`);
  }

  // Muscles: longest at the stretch, and shorter at the finish.
  const proxies = [
    ...(def.check?.muscles ?? []).map(({ m, side }) => ({ name: `${m}${side}`, len: (b: Body) => muscleLength(b, m, side) })),
    ...(def.check?.custom ?? []),
  ];
  const muscles = proxies.map(({ name, len: lenOf }) => {
    const all = SAMPLE_TS.map((t) => lenOf(frameAt(def, t).body));
    const maxI = all.indexOf(Math.max(...all));
    const drop = 1 - all[all.length - 1] / all[0];
    if (all[maxI] > all[0] * 1.002) flag(SAMPLE_TS[maxI], `${name} is longest at t=${SAMPLE_TS[maxI]}, not at the stretch`);
    if (drop < 0.05) flag(1, `${name} only ${(drop * 100).toFixed(1)}% shorter at the finish`);
    return { name, lengths: TABLE_TS.map((t) => lenOf(frameAt(def, t).body)), maxAt: SAMPLE_TS[maxI], drop };
  });

  const lever = (def.check?.lever ?? []).map((l, li) => {
    const rows = TABLE_TS.map((t) => leverShare(def, t, li));
    return {
      name: `${l.joint}->${l.end}`,
      share: rows.map((r) => r?.share ?? NaN),
      sine: rows.map((r) => r?.sine ?? NaN),
      sign: rows.map((r) => r?.sign ?? 0),
    };
  });

  const angles: Record<string, number[]> = {};
  const rec = (k: string, v: number) => (angles[k] ??= []).push(Math.round(v));
  for (const t of TABLE_TS) {
    const b = frameAt(def, t).body;
    for (const s of ['R', 'L'] as const) {
      const sa = shoulderAngles(b, s);
      rec(`shoulder${s} elevation`, sa.elevation);
      rec(`shoulder${s} forward`, sa.forward);
      rec(`elbow${s} flex`, elbowFlex(b, s));
      rec(`hip${s} flex`, hipFlex(b, s));
      rec(`hip${s} abd`, hipAbd(b, s));
      rec(`knee${s} flex`, kneeFlex(b, s));
    }
  }
  return { issues, muscles, lever, angles, ts: TABLE_TS };
}

/** Prims of one frame, for a script that wants to look at equipment directly. */
export const primsAt = (def: FigureDef, t: number): Prim[] => frameAt(def, t).prims;

export { DIM };
