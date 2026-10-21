/**
 * Drawing steps onto a 2D canvas, in box units.
 *
 * Colors are opaque mixes rather than faint strokes, so a grey leg in front of
 * another hides it the way a solid thing would, and two faint lines crossing do
 * not darken where they meet.
 */
import type { Op, P2, Tone } from './scene';

export interface Palette {
  move: string;
  body: string;
  equip: string;
  cable: string;
  surface: string;
}

/** A canvas color string as [r, g, b], resolved through the canvas so CSS names and var values both work. */
function rgb(ctx: CanvasRenderingContext2D, c: string): [number, number, number] {
  ctx.fillStyle = '#000';
  ctx.fillStyle = c.trim();
  const s = String(ctx.fillStyle);
  if (s.startsWith('#')) {
    const n = parseInt(s.slice(1, 7), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/[\d.]+/g) ?? ['0', '0', '0'];
  return [Number(m[0]), Number(m[1]), Number(m[2])];
}

const mix = (a: [number, number, number], b: [number, number, number], k: number): string =>
  `rgb(${a.map((v, i) => Math.round(v * k + b[i] * (1 - k))).join(',')})`;

/*
 * The old SVG figures drew the body at half strength in the muted color over
 * the modal's surface, cables at 0.6 and pulleys at 0.7. These are those same
 * strengths, mixed ahead of time.
 */
export function paletteFrom(ctx: CanvasRenderingContext2D, accent: string, muted: string, surface: string): Palette {
  const m = rgb(ctx, muted);
  const s = rgb(ctx, surface);
  return { move: mix(rgb(ctx, accent), s, 1), body: mix(m, s, 0.5), equip: mix(m, s, 0.55), cable: mix(m, s, 0.6), surface: mix(s, s, 1) };
}

/** A convex outline with each corner cut back along its edges and rounded through it. */
function roundedPath(ctx: CanvasRenderingContext2D, pts: P2[], r: number[]) {
  const n = pts.length;
  if (n < 3 || r.every((x) => x <= 0)) {
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    return;
  }
  const cut = (a: P2, b: P2, ri: number): P2 => {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = l < 1e-9 ? 0 : Math.min(ri, l * 0.4) / l;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  };
  for (let i = 0; i < n; i++) {
    const v = pts[i];
    const a = cut(v, pts[(i - 1 + n) % n], r[i]);
    const b = cut(v, pts[(i + 1) % n], r[i]);
    if (i === 0) ctx.moveTo(a[0], a[1]);
    else ctx.lineTo(a[0], a[1]);
    ctx.quadraticCurveTo(v[0], v[1], b[0], b[1]);
  }
  ctx.closePath();
}

export function drawOps(ctx: CanvasRenderingContext2D, ops: Op[], pal: Palette, W: number) {
  const col = (t: Tone) => pal[t];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const o of ops) {
    if (o.op === 'floor') {
      // Nearly the box's full width: at 12 to 88% of it, as the old figures
      // drew it, a low pulley at the edge of a side view sat past its end.
      ctx.strokeStyle = pal.equip;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W * 0.03, o.y + 1);
      ctx.lineTo(W * 0.97, o.y + 1);
      ctx.stroke();
    } else if (o.op === 'seg') {
      ctx.strokeStyle = col(o.tone);
      ctx.lineWidth = o.w;
      ctx.beginPath();
      ctx.moveTo(o.a[0], o.a[1]);
      ctx.lineTo(o.b[0], o.b[1]);
      ctx.stroke();
    } else if (o.op === 'dot') {
      ctx.beginPath();
      ctx.arc(o.c[0], o.c[1], o.r, 0, Math.PI * 2);
      if (o.ring) {
        ctx.fillStyle = pal.surface;
        ctx.fill();
        ctx.strokeStyle = col(o.tone);
        ctx.lineWidth = 1.6;
        ctx.stroke();
      } else {
        ctx.fillStyle = col(o.tone);
        ctx.fill();
      }
    } else if (o.op === 'ball') {
      // Stroked twice as wide and then filled, so the outline that shows is
      // all outside the shape; the group case below needs that, and the head
      // matches it.
      ctx.beginPath();
      ctx.arc(o.c[0], o.c[1], o.r, 0, Math.PI * 2);
      ctx.strokeStyle = col(o.tone);
      ctx.lineWidth = o.w * 2;
      ctx.stroke();
      ctx.fillStyle = pal.surface;
      ctx.fill();
    } else {
      // Union of the parts: every part stroked at twice the width, then every
      // part filled. Fills cover the strokes inside the union, so only its
      // outer edge is left, each stretch in the color of the part it belongs to.
      for (const p of o.parts) {
        ctx.beginPath();
        roundedPath(ctx, p.pts, p.round);
        ctx.strokeStyle = col(p.tone);
        ctx.lineWidth = p.w * 2;
        ctx.stroke();
      }
      // One path for all the fills: filled one by one, the antialiased edges
      // where two parts meet each let half the stroke under them through, and
      // the seam shows as a hairline. Every hull winds the same way, so the
      // nonzero fill of the combined path is the union.
      ctx.fillStyle = pal.surface;
      ctx.beginPath();
      for (const p of o.parts) roundedPath(ctx, p.pts, p.round);
      ctx.fill();
    }
  }
}
