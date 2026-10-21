// Renders figures to a PNG contact sheet for review, with each figure's cue
// under it.
//
//   node scripts/figures/render.mjs <out.png> [key,key,...|all] [t,t,...] [zoom] [--file src/lib/figures/<group>.ts]
//
// Rows are views, columns are moments in the rep (t = 0 is the stretch).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { bundle, here, takeFile } from './bundle.mjs';

const require = createRequire(import.meta.url);
const pw = require('/opt/node22/lib/node_modules/playwright/index.js');

const { file, rest } = takeFile(process.argv.slice(2));
const [out, keyArg = 'all', tArg = '0,0.25,0.5,0.75,1', zoomArg = '1.5'] = rest;
if (!out) {
  console.error('usage: render.mjs <out.png> [keys|all] [ts] [zoom] [--file group.ts]');
  process.exit(2);
}
const js = await bundle(join(here, 'sheet-entry.ts'), file, 'iife');
const keys = keyArg.split(',');
const ts = tArg.split(',').map(Number);
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;background:#0f1115;color:#8a93a3;font:12px system-ui,sans-serif;padding:12px}
.block{margin-bottom:18px}.row{display:flex;gap:8px;align-items:flex-start;margin:4px 0}
.lab{width:44px;padding-top:6px}.cell{background:#181b22}.t{text-align:center;padding:2px}
h2{font-size:13px;color:#e8ebf0;margin:6px 0}.cue{max-width:1100px;font-size:13px;line-height:1.4}.cue b{color:#e8ebf0}.cue p{margin:4px 0}
</style></head><body><div id="root"></div>
<script>window.SHEET=${JSON.stringify({ keys, ts, zoom: Number(zoomArg) })}</script>
<script>${readFileSync(js, 'utf8')}</script></body></html>`;
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.setContent(html);
await page.waitForFunction(() => window.DONE === true, null, { timeout: 60000 }).catch(() => errors.push('sheet did not finish'));
await page.screenshot({ path: out, fullPage: true });
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(out);
