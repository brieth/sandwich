/**
 * Cable woodchoppers, high to low and low to high, standing side-on to the
 * station with the pulley on the right and one D handle in both hands.
 *
 * The target is the pair of obliques that turns the chest away from the
 * pulley: with the pulley on the right, the right external oblique and the
 * left internal oblique. Both proxies run from the ribcage around the front of
 * the waist to the pelvis, so only the ribcage turning on the pelvis changes
 * them. Turning the pelvis on the legs carries the handle further and leaves
 * them as they are. The opposite pair, left external and right internal,
 * lengthens through the rep (40.3 to 48.4 and 32.9 to 41.3 in the high chop,
 * 40.3 to 49.6 and 32.9 to 42.7 in the low), which confirms the proxies turn
 * the right way.
 *
 * The turn is split three ways, in degrees, positive toward the pulley: the
 * pelvis on planted feet, which the hips allow without a foot pivot; the
 * lumbar spine, kept to its small real range; and the thoracic spine.
 *
 *                stretch   finish, high   finish, low
 *   pelvis          15           0            -5
 *   lumbar           5          -3            -5
 *   thoracic        35         -27           -35
 *   chest           55         -30           -45
 *
 * The low chop's ribcage turns as far from the pulley at the finish as toward
 * it at the stretch, 40 each way. The high chop's stops at 30. With the hands
 * on the chest's midline its cable runs along the right arm at the finish, and
 * turning the chest any further, 5 more at the pelvis or 5 more at the
 * ribcage, ran the cable into the chest at t = 1. Moving the hands toward the
 * far hip, off the midline, ran the cable and the right upper arm into the
 * chest sooner. So the high chop's hips come back to square at the finish and
 * the ribcage takes all of the room: the pelvis turn does not change the
 * obliques. That gives oblique proxies 17.0 and 21.3 percent shorter at the
 * finish, against 15.0 and 19.2 with the hips turning 10 away and the ribcage
 * 20.
 *
 * The spine only twists. Twisted and bent together, the torso's filler
 * between two sections becomes a solid whose face planes enclose space outside
 * the body, and the collision check found the right thigh 9 inside the chest
 * at 35 of thoracic twist and 5 of lumbar extension. Bending is at the hips
 * and knees instead, which is also how the chop is done: they lower the hands
 * while the back stays straight.
 *
 * The arms hold the handle on the chest's midline with a fixed 20 degree elbow
 * bend and swing only up or down against the chest, so the handle's travel
 * across the body is the chest turning.
 */
import type { Body, BodySpec, Limb, Scap } from '../figure3d/body';
import { twoBone } from '../figure3d/body';
import type { FigureDef, ViewDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, dot, mul, norm, qRot, qSlerp, sub, turnRight } from '../figure3d/math';
import { cable, floor, pulley } from '../figure3d/equipment';
import type { Camera, PLine, PSolid, Prim } from '../figure3d/scene';
import { HEXA_FACES, perpTo } from '../figure3d/scene';
import type { Group } from './kit';
import { DIM, VIEW, key } from './kit';

/*
 * Hip joints to floor, with the ankles 22 either side of center: feet about
 * shoulder width, and soft knees at 18 degrees.
 */
const FLOOR = 91;
const STANCE = 22;

/*
 * Pulley 110 right of center, so 88 from the near foot, a little over one step
 * of 75, and 20 behind the ankles, 16 behind the heels. The cable's moment arm
 * about the spine, cm of torque per unit of cable force, stretch / finish, at
 * 110 out, with the pulley in line with the heels or behind them:
 *
 *              in line   16 behind   36 behind
 *   high        47/22      50/19       53/16
 *   low         17/21      21/18       25/13
 *
 * Further behind the heels the stretch gets heavier and the finish lighter.
 * At 36 behind both cables ran into the chest at the finish, and at 16 behind
 * and 80 out the high one did. At 140 out the high chop reads 48/24 and the
 * low 23/21, the heaviest of the check's five points rises from 57 to 60 and
 * from 45 to 50, and the high cable runs through the right forearm from t =
 * 0.8. 110 keeps the drawing large.
 */
const PULLEY_X = 110;
const PULLEY_Z = -20;

/** A D handle's grip is 12 wide. The second hand wraps over the first, so the hands' centers sit 6 apart. */
const GRIP = 6;

interface ChopDef {
  views: ViewDef[];
  /** A Side view's camera that sees the cable pass behind the head; see cableBehind. */
  behindHead?: Camera;
  pulleyY: number;
  pos: [number, V3][];
  hinge: [number, number][];
  /** turn: pelvis on the legs; lt, tt: lumbar and thoracic twist. Degrees, positive toward the pulley. */
  spine: [number, Record<string, number>][];
  scap: [number, Record<string, number>][];
  /** e: arm elevation above the chest's horizontal, degrees; f: elbow bend, degrees. */
  handle: [number, Record<string, number>][];
  allow: string[];
}

/*
 * Elbows point out to the sides. Pointed down, the upper arms crossed the
 * chest's front corners on the way to the middle, up to 3.7 into it in both
 * chops, past the check's 2.5 of give.
 */
const POLE_R: V3 = [1, 0.4, -0.2];
const POLE_L: V3 = [-1, 0.4, -0.2];

function arm(shoulder: V3, hand: V3, pole: V3): Limb {
  const { mid, end } = twoBone(shoulder, hand, pole, DIM.upperArm, DIM.forearm);
  return { dirs: [norm(sub(mid, shoulder)), norm(sub(end, mid))] };
}

const shoulderAt = (s: 1 | -1, sc: Scap): V3 => [s * (DIM.shoulder[0] + (sc.x ?? 0)), DIM.shoulder[1] + (sc.y ?? 0), DIM.shoulder[2] + (sc.z ?? 0)];

/** Feet flat and pointing forward, knees over the toes. */
const legs: Pick<BodySpec, 'legR' | 'legL'> = {
  legR: { foot: { heel: [STANCE, FLOOR, -DIM.heel], dir: [0, 0, 1] }, pole: [0.15, 0, 1] },
  legL: { foot: { heel: [-STANCE, FLOOR, -DIM.heel], dir: [0, 0, 1] }, pole: [-0.15, 0, 1] },
};

/**
 * One D handle in both hands. The engine's handle is for one hand; this one
 * centers on the two and runs its grip between them, square to the cable.
 */
function dHandle(b: Body, toward: V3): { prims: Prim[]; attach: V3 } {
  const m = mul(add(b.j.handR, b.j.handL), 0.5);
  const c = norm(sub(toward, m));
  const g = perpTo(c, sub(b.j.handR, b.j.handL));
  const a = add(m, mul(c, D_APEX));
  const line: PLine = { k: 'line', part: 'eq.handle', pts: [add(m, mul(g, -6)), add(m, mul(g, 6)), a], closed: true, w: 2, tone: 'equip' };
  return { prims: [line], attach: a };
}

/*
 * Grip to the clip, along the cable. At 9, as on the one-hand handle, the D
 * showed only as a nub past the two hand dots, which cover about 14 of the
 * grip between them, and the cable seemed to clip onto the hands.
 */
const D_APEX = 13;

/*
 * The trunk is drawn here and the engine's torso is hidden in every view; the
 * check still runs on the engine's. The engine turns the lumbar twist at the
 * waist ring and the whole thoracic twist at the mid ring, so a ribcage turned
 * 40 degrees on the pelvis drew as two boxes 35 degrees apart: steps in the
 * Side outline at both rings, an octagon from above, and a hairline across
 * the waist from the front. Here each of SLICES sections between the waist
 * and the top of the chest takes a share of the turn in proportion to its
 * height, from the pelvis's facing at the waist to the upper torso's at the
 * top, so the shoulder corners stay where the arms hang. The spine only
 * twists, so every section turns about the same line and one quaternion blend
 * per ring places it.
 */
const SLICES = 6;
/**
 * The engine's INSET in scene.ts: faces where two parts of a group meet push
 * out by this much, so nothing shows through the join. Raised from 0.75 with
 * the engine's: sampled every 0.01 in t, that hid 1 to 3 line pieces behind
 * the trunk, inside its outline, in 26 of 606 view frames (feet from above,
 * the thighs and an upper arm in the low chop), and showed none it had hidden.
 */
const JOIN = 1.5;

function trunk(b: Body): Prim[] {
  const o = b.xf.pelvis.o;
  const rP = b.xf.pelvis.r;
  const rU = b.xf.upper.r;
  // Waist, mid and top sections widen and deepen evenly with height, so one
  // straight blend from the waist to the top passes through the mid section.
  const ring = (k: number): V3[] => {
    const y = DIM.top.y * k;
    const w = DIM.waist.w + (DIM.top.w - DIM.waist.w) * k;
    const f = DIM.waist.f + (DIM.top.f - DIM.waist.f) * k;
    const bk = DIM.waist.b + (DIM.top.b - DIM.waist.b) * k;
    const q = qSlerp(rP, rU, k);
    const pts: V3[] = [
      [-w, y, -bk],
      [w, y, -bk],
      [w, y, f],
      [-w, y, f],
    ];
    return pts.map((p) => add(o, qRot(q, p)));
  };
  const solid = (part: string, verts: V3[], round: number[], rings: [number, number]): PSolid => ({
    k: 'solid',
    part,
    group: 'trunk',
    verts,
    faces: HEXA_FACES,
    round,
    inset: [...rings, JOIN, JOIN, JOIN, JOIN],
  });
  const out: Prim[] = [solid('trunk.pelvis', b.torso.pelvis, [6, 6, 6, 6, 0, 0, 0, 0], [JOIN, -JOIN])];
  for (let i = 0; i < SLICES; i++) {
    const top = i === SLICES - 1;
    out.push(
      solid(`trunk.s${i + 1}`, [...ring(i / SLICES), ...ring((i + 1) / SLICES)], top ? [0, 0, 0, 0, 7, 7, 7, 7] : [0, 0, 0, 0, 0, 0, 0, 0], [-JOIN, top ? JOIN : -JOIN]),
    );
  }
  return out;
}

/*
 * The cable as one camera should see it, for a view where it passes behind
 * the head: the stretch that crosses the head's circle on screen is left out,
 * and the view hides 'eq.cable' and draws this 'eq.sidecable' in its place.
 * The engine hides a 1.5 long piece of line only where the ray from its
 * midpoint runs more than 1 through the head shrunk by 1.5, so a cable
 * passing 9.5 to 11 from the head's center on screen, 50 or more behind it,
 * draws just inside the head's outline. In the high chop's Side view that is
 * up to 11 of cable where it grazes the head, at t = 0.50 to 0.54 and 0.91 to
 * 0.935, and 1 to 3 at each edge where it crosses the head in between. The
 * cut is the head's radius and 0.75 more, about half the cable's 1.4 wide
 * stroke at the scale of 1.122, so no part of the stroke reaches inside the
 * outline.
 */
const BEHIND_HEAD = 0.75;

function cableBehind(b: Body, from: V3, to: V3, cam: Camera): Prim[] {
  const c = b.head.c;
  const R = b.head.r + BEHIND_HEAD;
  // Across the camera's line of sight only: p(u) = from + u * d, and the
  // stretch where its distance from the head's center on screen is under R.
  const flat = (v: V3) => sub(v, mul(cam.dir, dot(v, cam.dir)));
  const o = flat(sub(from, c));
  const d = flat(sub(to, from));
  const qa = dot(d, d);
  const qb = 2 * dot(o, d);
  const disc = qb * qb - 4 * qa * (dot(o, o) - R * R);
  const whole = [cable(from, to, { part: 'eq.sidecable' })];
  if (qa < 1e-9 || disc <= 0) return whole;
  const u0 = Math.max(0, (-qb - Math.sqrt(disc)) / (2 * qa));
  const u1 = Math.min(1, (-qb + Math.sqrt(disc)) / (2 * qa));
  if (u0 >= u1) return whole;
  const at = (u: number): V3 => add(from, mul(sub(to, from), u));
  // Only where the cable is farther from the camera than the head's center.
  if (dot(sub(at((u0 + u1) / 2), c), cam.dir) > 0) return whole;
  const out: Prim[] = [];
  if (u0 > 0) out.push(cable(from, at(u0), { part: 'eq.sidecable' }));
  if (u1 < 1) out.push(cable(at(u1), to, { part: 'eq.sidecable' }));
  return out;
}

/*
 * Front shows the diagonal path, the cable and the planted stance; Side the
 * hinge and knee bend and the pulley behind the heels; Top the chest turning
 * against the feet and the handle's arc around the body. A back view repeated
 * the front. The blades are hidden: with the chest turned they showed through
 * the outline as stray ticks. From above only the feet are left of the legs,
 * as the fixed reference for forward.
 *
 * The low chop's Side view looks from the right, the side the hands start
 * on: from the left, the right arm reaching down was hidden behind the torso.
 * The high chop's looks from the left: from the right, the cable is drawn
 * across the face from t = 0.5 to 0.75. The far shoulder's dot is hidden in
 * both. Raised by the blade, the far shoulder sits just under the torso's
 * top, and its dot showed as a dot on the top edge with no arm on it, or
 * beside the near shoulder's dot as a doubled joint.
 */
const HIDE = ['torso', 'scap', 'eq.sidecable'];
const FRONT: ViewDef = { ...VIEW.front, hide: HIDE };
const TOP: ViewDef = {
  ...VIEW.top,
  hide: [...HIDE, ...['legR', 'legL'].flatMap((l) => ['thigh', 'shin', 'knee', 'ankle'].map((p) => `${l}.${p}`))],
};

function chop(d: ChopDef): FigureDef {
  const P: V3 = [PULLEY_X, d.pulleyY, PULLEY_Z];
  return {
    views: d.views,
    pose: (t) => {
      const sp = key(t, d.spine);
      const sc = key(t, d.scap) as Scap;
      const hk = key(t, d.handle);
      const e = (hk.e * Math.PI) / 180;
      const f = (hk.f * Math.PI) / 180;
      // How far in front of the shoulders the handle sits for each arm to
      // have elbow bend f, with the hands GRIP apart about the midline.
      const reach = Math.sqrt(DIM.upperArm ** 2 + DIM.forearm ** 2 + 2 * DIM.upperArm * DIM.forearm * Math.cos(f));
      const side = DIM.shoulder[0] + (sc.x ?? 0) - GRIP / 2;
      const r = Math.sqrt(reach ** 2 - side ** 2);
      const h: V3 = [0, DIM.shoulder[1] + (sc.y ?? 0) - r * Math.sin(e), (sc.z ?? 0) + r * Math.cos(e)];
      const half: V3 = [GRIP / 2, 0, 0];
      return {
        pos: key(t, d.pos),
        rot: turnRight(sp.turn),
        pelvis: { flex: key(t, d.hinge) },
        lumbar: { twist: sp.lt },
        thoracic: { twist: sp.tt },
        scapR: sc,
        armR: arm(shoulderAt(1, sc), add(h, half), POLE_R),
        armL: arm(shoulderAt(-1, sc), sub(h, half), POLE_L),
        ...legs,
      };
    },
    equipment: (b) => {
      const h = dHandle(b, P);
      const behind = d.behindHead ? cableBehind(b, P, h.attach, d.behindHead) : [];
      return [floor(FLOOR), pulley(P), cable(P, h.attach), ...behind, ...h.prims, ...trunk(b)];
    },
    check: {
      muscles: [
        { m: 'obliqueExt', side: 'R' },
        { m: 'obliqueInt', side: 'L' },
      ],
      /*
       * The table measures the cable turning the chest about the spine. The
       * engine turns a load about a named joint, and no joint sits on the
       * spine level with a point that circles it, so the shoulder line stands
       * in as the turning limb: its axis stays within 7 degrees of the spine's
       * through the high chop and 13 through the low, where the hips also
       * straighten. The force is given at the clip's offset from the spine,
       * square to it, laid off from the left shoulder, which makes the
       * engine's torque and distance those about the spine. Computed directly
       * about the spine, the shares agree to 1.3 points and the moment arms to
       * 0.7 cm.
       *
       * The clip's distance from the spine changes through the rep, 42 to 62
       * in the high chop and 50 to 60 in the low, so the moment arm compares
       * one point of the rep with another and the share does not. The cue's
       * load claims use the moment arm.
       *
       * Only the cable is counted. The arms' own weight also turns the chest
       * once the trunk leans: at the low chop's start, with the trunk 35
       * degrees forward and the arms hanging toward the pulley, it turns the
       * chest away from the pulley with about 54 kg cm, a quarter of what a 10
       * kg stack's cable gives there. At the high chop's finish, 15 degrees
       * forward, it resists the turn with about 24.
       */
      load: (b) => {
        const a = dHandle(b, P).attach;
        const n = b.dirOf('lower', [0, -1, 0]);
        const r = sub(a, b.j.mid);
        return [{ at: add(b.j.shoulderL, sub(r, mul(n, dot(r, n)))), dir: sub(P, a) }];
      },
      lever: [{ joint: 'shoulderL', end: 'shoulderR' }],
      allow: d.allow,
      contacts: (b) => [
        { name: 'heelR on floor', gap: Math.abs(b.j.heelR[1] - FLOOR) },
        { name: 'toeR on floor', gap: Math.abs(b.j.toeR[1] - FLOOR) },
        { name: 'heelL on floor', gap: Math.abs(b.j.heelL[1] - FLOOR) },
        { name: 'toeL on floor', gap: Math.abs(b.j.toeL[1] - FLOOR) },
      ],
    },
  };
}

/*
 * The blades sit out 5 and forward 5, protracted because both hands reach the
 * middle, and rise 6 and turn up with the arms overhead: upward rotation 35 at
 * 122 and 106 degrees of arm elevation, against 5 and 0 at the other end of
 * each rep. They are hidden in every view; their position moves the shoulder
 * joints. With the hands 6 apart the forearms stay clear of each other, so no
 * allow is needed for them.
 */

/*
 * Hands from 183 above the floor, 5 above the top of the head and 27 outside
 * the right shoulder, to 88, level with the left hip joint, 16 outside it and
 * 46 in front of it. The hips hinge 15 degrees and the knees bend from 18 to
 * 36 as the hands come down.
 *
 * The head stays in line with the back. Tipped down 15 at the finish to follow
 * the hands, it sat 3 further forward. Seen from above, the cable then passed
 * inside the head's radius of 11 from about t = 0.98, and 9.2 from its center
 * at t = 1, though 48 below it. The engine drew the stretch 9.5 to 11 from
 * the center, 6 to 10.5 of cable, just inside the outline of the crown, and
 * hid only the middle at t = 1 (see cableBehind). In line with the back, the
 * cable passes 11.0 from the head's center at t = 1, along its edge.
 */
const HIGH: ChopDef = {
  views: [FRONT, { ...VIEW.side, hide: ['torso', 'scap', 'eq.cable', 'armR.shoulder'] }, TOP],
  behindHead: VIEW.side.cam,
  pulleyY: FLOOR - 205,
  pos: [
    [0, [0, 0, 0]],
    [1, [0, 3, 0]],
  ],
  hinge: [
    [0, 0],
    [1, 15],
  ],
  spine: [
    [0, { turn: 15, lt: 5, tt: 35 }],
    [1, { turn: 0, lt: -3, tt: -27 }],
  ],
  scap: [
    [0, { x: 5, y: -4, z: 5, rot: 35 }],
    [1, { x: 5, y: 2, z: 5, rot: 5 }],
  ],
  handle: [
    [0, { e: 35, f: 20 }],
    [1, { e: -40, f: 20 }],
  ],
  // At the finish the right arm points within a few degrees of the pulley,
  // so the cable runs along it. Drawn straight, the cable passes up to 4.3
  // inside the upper arm's 4.5 radius, at t = 0.92, and up to 0.4 inside the
  // forearm's, which the check lets pass. On a station it rests on the arm
  // and bends over it there, so the leverage from about t = 0.85 on is
  // approximate. The Side view's copy of the cable is the same line.
  allow: ['eq.cable~armR.upper', 'eq.sidecable~armR.upper'],
};

/*
 * Hands from 56 above the floor, beside the right thigh, 13 outside the knee
 * joint and 11 above it, to 169, level with the head's center, 23 outside the
 * left shoulder and 58 in front of it. The start is a half squat, hips 18
 * lower and 12 back with a 35 degree hinge: the hips end 15 and 9 behind the
 * ankles, the shins lean 26 and 31 degrees, the knees bend 74 and 76, and
 * the left knee is 3 past its toes.
 * With the hips 4 back and a 30 degree hinge the knees went 5 to 8 past the
 * toes with the shins at 34 and 38. The legs straighten to 19 as the hands
 * rise. Lowering the hands further at the start, arm elevation -60 or below,
 * ran the left forearm into the right thigh.
 */
const LOW: ChopDef = {
  views: [FRONT, { ...VIEW.sideRight, hide: [...HIDE, 'armL.shoulder'] }, TOP],
  pulleyY: FLOOR - 15,
  pos: [
    [0, [0, 18, -12]],
    [1, [0, 0, 0]],
  ],
  hinge: [
    [0, 35],
    [1, 0],
  ],
  spine: [
    [0, { turn: 15, lt: 5, tt: 35 }],
    [1, { turn: -5, lt: -5, tt: -35 }],
  ],
  scap: [
    [0, { x: 5, y: 2, z: 5, rot: 0 }],
    [1, { x: 5, y: -4, z: 5, rot: 35 }],
  ],
  handle: [
    [0, { e: -55, f: 20 }],
    [1, { e: 20, f: 20 }],
  ],
  allow: [],
};

/*
 * Load sentences, from check.mjs's moment arm and a 21-point sweep of the
 * same torque computed directly about the spine.
 * High: 50.4 at the start, most 57.9 at t = 0.2, 19.2 at the finish, so the
 * start is 0.87 of the most and the finish 0.33. Low: 21.4 at the start, most
 * 46.0 at t = 0.4, 17.6 at the finish, so 0.47 and 0.38. With the heels in
 * line with the pulley the high chop reads 47/22 and the low 17/21.
 */
export const group: Group = {
  figures: {
    woodchopperHigh: chop(HIGH),
    woodchopperLow: chop(LOW),
  },
  cues: {
    woodchopperHigh: {
      reach: 'Chest turned fully toward the high pulley, arms long, hands a little above head height and outside the shoulder on that side.',
      points: [
        ['Setup', 'Set the pulley at the top and hold a D handle in both hands, one over the other. Stand side-on with your hips about one and a half steps from the pulley, feet about shoulder width apart and pointing forward, and the pulley a little behind your heels. The drawing has the pulley on your right. With it on your left, do everything mirrored.'],
        ['Stretch', 'Let the cable turn your chest fully toward the pulley, about 55 degrees, with your hips turning about 15 degrees of that. The obliques that turn you away from the pulley are longest here.'],
        ['Chop', 'Chop down and across until your hands are at hip height, outside your far hip. Bend your knees a little more and lean forward about 15 degrees as your hands come down, with your back flat. Keep your elbows bent about 20 degrees.'],
        ['Turn', 'Keep your feet flat and your hands in line with the middle of your chest. Most of the turn should come from your upper and middle back.'],
        ['Avoid', 'Turning mostly with your hips. The handle travels farther, but the obliques stay the same length. Turning more than about 30 degrees past forward at the finish, which presses the cable into your chest.'],
      ],
    },
    woodchopperLow: {
      reach: 'Chest turned fully toward the low pulley, arms long, hands down outside the near thigh, just above the knee.',
      points: [
        ['Setup', 'Set the pulley at the bottom and hold a D handle in both hands, one over the other. Stand side-on with your hips about one and a half steps from the pulley, feet about shoulder width apart and pointing forward, and the pulley a little behind your heels. The drawing has the pulley on your right. With it on your left, do everything mirrored.'],
        ['Stretch', 'Start in a half squat with your hips back, your knees bent about 75 degrees and your back flat, hands outside your near thigh just above the knee. Let the cable turn your chest fully toward the pulley, about 55 degrees, with your hips turning about 15 degrees of that. The obliques that turn you away from the pulley are longest here.'],
        ['Lift', 'Stand up as you lift the handle up and across until your hands are at about head height, outside your far shoulder. Keep your elbows bent about 20 degrees.'],
        ['Turn', 'Keep your feet flat and your hands in line with the middle of your chest. Most of the turn should come from your upper and middle back.'],
        ['Avoid', 'Turning mostly with your hips. The handle travels farther, but the obliques stay the same length.'],
      ],
    },
  },
  exercises: {
    'cable-high-woodchopper': 'woodchopperHigh',
    'cable-low-woodchopper': 'woodchopperLow',
  },
};
