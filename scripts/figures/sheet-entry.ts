/**
 * Contact sheet of figures for review: one block per figure, a row per view,
 * a column per moment in the rep. Bundled by render.mjs and opened in a
 * headless browser.
 */
// @ts-expect-error bound by bundle.mjs
import { CUES, FIGS } from '__figs__';
import type { FigureDef } from '../../src/lib/figure3d/figure';
import type { Cue } from '../../src/lib/figures/kit';
import { opsAt, prepare } from '../../src/lib/figure3d/figure';
import { drawOps, paletteFrom } from '../../src/lib/figure3d/draw';

declare global {
  interface Window {
    SHEET: { keys: string[]; ts: number[]; zoom: number };
    DONE?: boolean;
  }
}

const { keys: keyArg, ts, zoom } = window.SHEET;
const keys = keyArg[0] === 'all' ? Object.keys(FIGS) : keyArg;
const root = document.getElementById('root')!;
for (const key of keys) {
  const def = (FIGS as Record<string, FigureDef>)[key];
  const block = document.createElement('div');
  block.className = 'block';
  const h = document.createElement('h2');
  if (!def) {
    h.textContent = `${key}: no such figure`;
    block.appendChild(h);
    root.appendChild(block);
    continue;
  }
  const prep = prepare(def);
  h.textContent = `${key}  box ${prep.W}x${prep.H}  scale ${prep.scale.toFixed(3)}  moving: ${[...prep.moving].sort().join(' ')}`;
  block.appendChild(h);
  def.views.forEach((v, vi) => {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('div');
    lab.className = 'lab';
    lab.textContent = v.label;
    row.appendChild(lab);
    for (const t of ts) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const c = document.createElement('canvas');
      c.width = prep.W * zoom;
      c.height = prep.H * zoom;
      const ctx = c.getContext('2d')!;
      const pal = paletteFrom(ctx, '#2dd4bf', '#8a93a3', '#181b22');
      ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
      drawOps(ctx, opsAt(prep, vi, t), pal, prep.W);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.strokeStyle = '#2a3038';
      ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
      cell.appendChild(c);
      const tl = document.createElement('div');
      tl.className = 't';
      tl.textContent = `t=${t}`;
      cell.appendChild(tl);
      row.appendChild(cell);
    }
    block.appendChild(row);
  });
  const cue = (CUES as Record<string, Cue>)[key];
  if (cue) {
    const p = document.createElement('div');
    p.className = 'cue';
    p.innerHTML = `<b>${cue.reach}</b>` + cue.points.map(([l, x]) => `<p><b>${l}:</b> ${x}</p>`).join('');
    block.appendChild(p);
  }
  root.appendChild(block);
}
window.DONE = true;
