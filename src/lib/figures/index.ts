/**
 * Every figure and cue, and which exercise shows which. Each file holds the
 * variants of one movement.
 */
import type { FigureDef } from '../figure3d/figure';
import type { Cue, Group } from './kit';
import { group as bench } from './bench';
import { group as pulldown } from './pulldown';
import { group as fly } from './fly';
import { group as row } from './row';
import { group as overheadExt } from './overheadExt';
import { group as triceps } from './triceps';
import { group as curl } from './curl';
import { group as delts } from './delts';
import { group as upperBack } from './upperBack';
import { group as legPress } from './legPress';
import { group as legMachines } from './legMachines';
import { group as abs } from './abs';
import { group as woodchopper } from './woodchopper';

const GROUPS: Group[] = [bench, pulldown, fly, row, overheadExt, triceps, curl, delts, upperBack, legPress, legMachines, abs, woodchopper];

export const FIGS: Record<string, FigureDef> = Object.assign({}, ...GROUPS.map((g) => g.figures));
export const CUES: Record<string, Cue> = Object.assign({}, ...GROUPS.map((g) => g.cues));
export const FIGURE_FOR: Record<string, string> = Object.assign({}, ...GROUPS.map((g) => g.exercises));
