/**
 * Cable curls. The bicep, hammer and reverse curls stand facing a low pulley
 * with both arms; the behind the back curl stands facing away from it with the
 * right arm. In every one the upper arm holds still against the torso and only
 * the forearm turns at the elbow, from straight at t = 0 to fully bent.
 */
import type { FigureDef } from '../figure3d/figure';
import type { V3 } from '../figure3d/math';
import { add, cross, dist, mul, norm, qAxis, qRot, rad, sub } from '../figure3d/math';
import type { Attached } from '../figure3d/equipment';
import { cable, floor, handle, pulley, rope } from '../figure3d/equipment';
import type { Group } from './kit';
import { DIM, VIEW, mx } from './kit';

/** v turned about axis by degrees. */
const turn = (v: V3, axis: V3, d: number): V3 => norm(qRot(qAxis(axis, d), v));

/** Right upper arm direction in the upper torso frame: degrees out from the side, and forward of hanging (negative is behind). */
const armDir = (out: number, fwd: number): V3 =>
  norm([Math.sin(rad(out)), Math.cos(rad(out)) * Math.cos(rad(fwd)), Math.cos(rad(out)) * Math.sin(rad(fwd))]);

/** Low pulley, this far above the floor. */
const PULLEY_UP = 15;

const footOn = (floorY: number, x: number, z: number) => ({
  foot: { heel: [x, floorY, z - DIM.heel] as V3, dir: [0, 0, 1] as V3 },
  pole: [0, 0, 1] as V3,
});

const feetOn = (floorY: number) => (b: { j: Record<'heelR' | 'toeR' | 'heelL' | 'toeL', V3> }) => [
  { name: 'heelR on floor', gap: Math.abs(b.j.heelR[1] - floorY) },
  { name: 'toeR on floor', gap: Math.abs(b.j.toeR[1] - floorY) },
  { name: 'heelL on floor', gap: Math.abs(b.j.heelL[1] - floorY) },
  { name: 'toeL on floor', gap: Math.abs(b.j.toeL[1] - floorY) },
];

/* ---------- facing the pulley, both arms ---------- */

/*
 * Square stance, feet under the hips, knees soft: 92.5 from hip joints to floor
 * bends them 12 degrees.
 */
const STAND_FLOOR = 92.5;

/*
 * The pulley is 30 in front of the hip joints, a little under half a step of
 * 75, which puts the toes 12 behind its center. Facing a low pulley, the cable
 * at the bottom pulls the bar forward as well as down, and a forward pull on
 * a hanging forearm turns it the way the curl goes. So at the bottom the
 * cable helps bend the elbow and the elbow flexors carry nothing; it starts
 * to resist once the forearm has swung past the line of the cable, at 6.6
 * degrees of elbow bend on the straight bar and the rope and 5.2 on the
 * cambered bar. Left alone, the forearm settles there, so getting the elbow
 * fully straight takes a push. The farther back the stance, the more the
 * cable leans forward. Measured on the straight bar and the rope as the share
 * of the cable's full leverage on the forearm, bottom (negative is helping the
 * curl) then top; the peak is 95 to 100 throughout:
 *
 *   25 in front: -10 / 55    45 in front: -36 / 68
 *   30 in front: -17 / 59    60 in front: -50 / 76
 *
 * The cambered bar's cable clips to its middle, which sits 2.5 forward of the
 * hands at the bottom, and reads 2 to 4 less at the bottom (-13 at 30). At 30
 * the cable leans forward of vertical by 18 at the bottom (16 on the cambered
 * bar) and by 5 or less from a quarter of the way up.
 *
 * Standing close keeps the bottom close to neutral. At 25 the toes would be
 * 7 behind the pulley's center, against its housing; 30 is about as close as a
 * real station allows.
 */
const FRONT_PULLEY = 30;

/*
 * Upper arm straight down from the shoulder and 8 degrees forward, with the
 * forearm in line with it at t = 0, so the elbow reads 0 and the hands hang
 * under the shoulder joints, 40 apart. The upper arm then sinks 3.3 into the
 * drawn torso's top corner, 0.8 past the check's 2.5 of give; a real upper
 * arm hangs against the side of the chest, so the check allows it. Angling
 * the upper arm out until the check passes takes 7 degrees, which puts
 * straight-arm hands 28 from center, past the ends of the 50 straight bar.
 * Angling the forearm back in to the grip from there would bend the elbow
 * toward the body, which an elbow does not do, and draws a kink at each
 * elbow in the Front view.
 *
 * At 7 forward the cambered bar's inner bends sat inside the thighs at the
 * bottom, and at 6 the straight bar did; at 8 the bar hangs just in front of
 * them. Putting the upper arm behind the torso, which would lengthen the
 * biceps at the shoulder, is not open to a bar or rope held in both hands:
 * with the elbows straight the hands would sit behind the thighs.
 */
const ARM_FWD = 8;

/**
 * Elbow bend at the top, degrees. The forearm then points 32 forward of
 * straight up and the hands sit 6.5 below the shoulder joints and 22 in front
 * of them.
 */
const FLEX_TOP = 140;

/*
 * The cambered bar is drawn here. The engine's cambered bar puts each angled
 * grip within 6 of the hand and 3 to either side of the bar's line, all under
 * the hand dot, so it read as a straight bar; its steps also run along the
 * forearm, where a turned grip steps square to it. Here each outer grip runs
 * 12 along the bar, centered on the hand, and steps CAMBER across it, about 23
 * degrees, so its bends at 14 and 26 from center show past the dot. The inner grips rise
 * back to a middle section level with the ends, where the cable clips on.
 * The steps lie square to the forearm, the plane the hand turns in, with each
 * grip's outer end stepped toward the palm side, so the palms turn slightly
 * in from flat. With the forearms hanging the bends lie in the horizontal
 * plane and show only from above; from about a quarter of the way up the
 * Front view shows the W.
 */
const CAMBER = 5;
const CAMBER_HALF = 29;

/** The cambered bar's line: sleeve, outer grip, inner grip, middle, as [along the bar from center, across it]. */
const camberProfile = (g: number): [number, number][] => [
  [CAMBER_HALF, CAMBER / 2],
  [g + 6, CAMBER / 2],
  [g - 6, -CAMBER / 2],
  [6, CAMBER / 2],
];

function camberedBar(handR: V3, handL: V3, forearm: V3): Attached {
  const m = mul(add(handR, handL), 0.5);
  const ax = norm(sub(handR, handL));
  // Square to the bar and the forearm: the plane the hand turns in when the
  // forearm rotates, so the grips angle the palms.
  const n = norm(cross(ax, forearm));
  const at = (k: number, off: number): V3 => add(add(m, mul(ax, k)), mul(n, off));
  const side = camberProfile(dist(handR, handL) / 2);
  const pts = [...side.map(([k, o]) => at(-k, o)), ...[...side].reverse().map(([k, o]) => at(k, o))];
  return { prims: [{ k: 'line', part: 'eq.bar', pts, w: BAR_W, tone: 'equip' }], attach: at(0, CAMBER / 2) };
}

/*
 * Bar line weight, above the body outline's 2.5, so in the Front view the bar
 * stands apart from the outline it lies against: 3.4 below the pelvis block's
 * lower edge at the bottom, and across the chest 6.5 below the shoulder
 * joints at the top.
 */
const BAR_W = 3.5;

/** The short straight bar, 50 long, drawn here at BAR_W. */
function straightBar(handR: V3, handL: V3): Attached {
  const m = mul(add(handR, handL), 0.5);
  const ax = norm(sub(handR, handL));
  return { prims: [{ k: 'line', part: 'eq.bar', pts: [add(m, mul(ax, -25)), add(m, mul(ax, 25))], w: BAR_W, tone: 'equip' }], attach: m };
}

type Kind = 'cambered' | 'rope' | 'straight';

/** Hands 20 either side of center, under the shoulder joints, with the arms straight. */
function facingCurl(kind: Kind): FigureDef {
  const pul: V3 = [0, STAND_FLOOR - PULLEY_UP, FRONT_PULLEY];
  const u = armDir(0, ARM_FWD);
  const attach = (b: { j: Record<'handR' | 'handL' | 'elbowR', V3> }): Attached => {
    const j = b.j;
    if (kind === 'rope') return rope(j.handR, j.handL, pul);
    if (kind === 'cambered') return camberedBar(j.handR, j.handL, sub(j.handR, j.elbowR));
    return straightBar(j.handR, j.handL);
  };
  return {
    views: [VIEW.front, VIEW.side],
    pose: (t) => {
      // The forearm turns about the room's left-right axis from in line with
      // the upper arm, so the hands keep their spacing all the way up.
      const f = turn(u, [1, 0, 0], FLEX_TOP * t);
      return {
        pos: [0, 0, 0],
        armR: { dirs: [u, f] },
        armL: { dirs: [mx(u), mx(f)] },
        legR: footOn(STAND_FLOOR, 11, 0),
        legL: footOn(STAND_FLOOR, -11, 0),
      };
    },
    equipment: (b) => {
      const a = attach(b);
      return [floor(STAND_FLOOR), pulley(pul), cable(pul, a.attach), ...a.prims];
    },
    check: {
      muscles: (kind === 'cambered'
        ? (['bicepsLong', 'bicepsShort'] as const)
        : kind === 'rope'
          ? (['brachioradialis', 'brachialis'] as const)
          : (['brachioradialis'] as const)
      ).flatMap((m) => (['R', 'L'] as const).map((side) => ({ m, side }))),
      // The cable's pull at each hand. A rope's strands also pull the hands
      // toward each other, which the two hands cancel and which turns neither
      // elbow; taking each strand's own direction read the rope's share at
      // about 0.75 of the bar's, from the strand angle alone (30 strands with
      // the hands 20 from center), while each elbow carries the same torque
      // for the same weight.
      load: (b) => {
        const dir = sub(pul, attach(b).attach);
        return [b.j.handR, b.j.handL].map((at) => ({ at, dir }));
      },
      lever: [
        { joint: 'elbowR', end: 'handR' },
        { joint: 'elbowL', end: 'handL' },
      ],
      // The upper arm hangs against the side of the chest; see ARM_FWD.
      allow: ['armR.upper~torso', 'armL.upper~torso'],
      contacts: feetOn(STAND_FLOOR),
    },
  };
}

/* ---------- facing away, right arm ---------- */

/** Staggered stance, left foot forward, as the flys stand. */
const STAGGER_FLOOR = 89;
const STAGGER = 20;

/*
 * Upper arm 30 degrees behind the torso and 9 out from it. At 30 the elbow
 * sits 3 behind the line of the back, which its dot covers in the Side view;
 * at 25 it only reached it. 35 clears the dot from the line but drops the
 * stretch's share from 53 to 42 for 0.2 more on each biceps proxy. At 7 out
 * the upper arm sinks 2.5 into the drawn torso's back corner; 8 passes and 9
 * leaves a margin. Torso upright.
 *
 * Facing away, the cable pulls the hanging forearm back, against the curl, and
 * the farther forward the stance the more square to the forearm it pulls.
 * Share of full leverage, bottom (negative is helping the curl) then top, by
 * how far the pulley is behind the hip joints:
 *
 *    60 behind: -14 / 63    130 behind: 42 / 36
 *   100 behind:  25 / 46    160 behind: 53 / 27
 *
 * At 160 the share peaks at 100 at t = 0.4, with the hand beside the hip.
 * Leaning the torso 10 degrees forward at 160 cut the bottom from 53 to 34,
 * since it tips the arm back in the room toward the line of the cable. Less
 * shoulder extension raises the bottom (20 behind the torso: 71; arm at the
 * side: 93) and gives up the shoulder half of the stretch, which is what the
 * exercise is for. 160 is about two steps of 75 from the hip joints, and puts
 * the back heel 136 in front of the pulley; the pulley is left out of the fit
 * and the cable runs off the edge.
 */
const BEHIND_PULLEY = 160;
const BEHIND_EXT = 30;
const BEHIND_OUT = 9;

/*
 * Elbow bend at the top, degrees. With the elbow held back the forearm then
 * points 15 above level and the hand is beside the lower chest. Bending
 * further turns the forearm toward the line of the cable: at 140 the top's
 * share fell from 27 to 20 and the drawn cable ran through the underside of
 * the forearm. At 130 the top's share was 34.
 */
const BEHIND_FLEX_TOP = 135;

function behindCurl(): FigureDef {
  const u = armDir(BEHIND_OUT, -BEHIND_EXT);
  // The elbow hinges about an axis square to the upper arm, so the hand comes
  // in toward the front of the shoulder as it rises.
  const hinge = norm(cross(u, [0, 0, 1]));
  const forearm = (t: number) => turn(u, hinge, BEHIND_FLEX_TOP * t);
  // Left arm hangs relaxed at the side with a slight bend.
  const uL = mx(armDir(7, 4));
  const fL = mx(turn(armDir(7, 4), [1, 0, 0], 12));
  // In line with the hand, so the cable runs straight back past the hip.
  const handX = DIM.shoulder[0] + (DIM.upperArm + DIM.forearm) * u[0];
  const pul: V3 = [handX, STAGGER_FLOOR - PULLEY_UP, -BEHIND_PULLEY];
  const grip = (b: { j: Record<'handR' | 'elbowR', V3> }) => handle(b.j.handR, pul, sub(b.j.handR, b.j.elbowR));
  return {
    // The hanging left arm is behind the torso from the right, all but the
    // hand, which drew as a lone dot below the front of the hip, so Side
    // hides it as Top does.
    views: [{ ...VIEW.sideRight, hide: ['armL'] }, { ...VIEW.top, hide: ['leg', 'armL'] }],
    pose: (t) => ({
      pos: [0, 0, 0],
      armR: { dirs: [u, forearm(t)] },
      armL: { dirs: [uL, fL] },
      legR: footOn(STAGGER_FLOOR, DIM.hipHalf, -STAGGER),
      legL: footOn(STAGGER_FLOOR, -DIM.hipHalf, STAGGER),
    }),
    equipment: (b) => {
      const h = grip(b);
      return [floor(STAGGER_FLOOR), pulley(pul, { fit: false }), cable(pul, h.attach, { fit: false }), ...h.prims];
    },
    check: {
      muscles: [
        { m: 'bicepsLong', side: 'R' },
        { m: 'bicepsShort', side: 'R' },
      ],
      load: (b) => [{ at: b.j.handR, dir: sub(pul, grip(b).attach) }],
      lever: [{ joint: 'elbowR', end: 'handR' }],
      contacts: feetOn(STAGGER_FLOOR),
    },
  };
}

export const group: Group = {
  figures: {
    curl: facingCurl('cambered'),
    hammerCurl: facingCurl('rope'),
    reverseCurl: facingCurl('straight'),
    behindCurl: behindCurl(),
  },
  cues: {
    curl: {
      reach: 'Elbows fully straight at the bottom, with the upper arms still at your sides.',
      points: [
        'Set the pulley at the bottom and clip a cambered bar to it. Stand facing the pulley with your hips a little under half a step from it, your feet about hip width apart and your knees slightly bent. Hold the bar underhand on its outer angled grips, with your hands about shoulder width apart. At the stretch your palms face forward and turn a little in, and the bar hangs just in front of your upper thighs.',
        'Both heads of the biceps cross the elbow, so they are longest with the elbow fully straight. Lower until your arms are completely straight before you curl again.',
        'Curl until the bar is in front of your shoulders and a little below them. Keep your upper arms still at your sides and your torso upright. If the elbows drift forward at the finish, the biceps shortens at the shoulder and the front delt takes part of the work.',
        'The cable pulls the bar forward as well as down. At the stretch that forward pull helps bend the elbow, so the biceps carries no load with the arms fully straight. The cable holds your elbows slightly bent there, and you press the bar back toward your thighs to straighten them. Standing this close keeps that help small. The cable resists the movement most with your forearms about level, and at the finish it resists about three fifths as much. Standing farther back makes the help at the stretch larger and the finish heavier.',
      ],
    },
    hammerCurl: {
      reach: 'Elbows fully straight at the bottom, palms facing each other, with the upper arms still at your sides.',
      points: [
        'Set the pulley at the bottom and clip a rope to it. Stand facing the pulley with your hips a little under half a step from it, your feet about hip width apart and your knees slightly bent. Hold one end of the rope in each hand with your palms facing each other and your hands about shoulder width apart. At the stretch your hands hang just in front of your thighs.',
        'The biceps, the brachialis under it, and the brachioradialis along the top of the forearm all bend the elbow. With the palms facing each other, the brachioradialis does more of the work than in an underhand curl. The brachialis and brachioradialis cross only the elbow, so they are longest with the elbow fully straight.',
        'Curl until your hands are in front of your shoulders and a little below them. Keep your upper arms still at your sides, your torso upright, and your palms facing each other the whole way.',
        'The cable pulls the rope forward as well as down. At the stretch that forward pull helps bend the elbow, so the brachialis and brachioradialis carry no load with the arms fully straight. The cable holds your elbows slightly bent there, and you press your hands back toward your thighs to straighten them. Standing this close keeps that help small. The cable resists the movement most with your forearms about level, and at the finish it resists about three fifths as much. Standing farther back makes the help at the stretch larger and the finish heavier.',
      ],
    },
    reverseCurl: {
      reach: 'Elbows fully straight at the bottom, palms facing your thighs, with the upper arms still at your sides.',
      points: [
        'Set the pulley at the bottom and clip a short straight bar to it. Stand facing the pulley with your hips a little under half a step from it, your feet about hip width apart and your knees slightly bent. Hold the bar overhand with your hands about shoulder width apart. At the stretch your palms face your thighs and the bar hangs just in front of your upper thighs.',
        'With an overhand grip, the biceps does less of the work than in an underhand curl and the brachioradialis, along the top of the forearm, does more. It crosses only the elbow, so it is longest with the elbow fully straight.',
        'Curl until the bar is in front of your shoulders and a little below them. Keep your wrists in line with your forearms, your upper arms still at your sides and your torso upright.',
        'The cable pulls the bar forward as well as down. At the stretch that forward pull helps bend the elbow, so the brachioradialis carries no load with the arms fully straight. The cable holds your elbows slightly bent there, and you press the bar back toward your thighs to straighten them. Standing this close keeps that help small. The cable resists the movement most with your forearms about level, and at the finish it resists about three fifths as much. Standing farther back makes the help at the stretch larger and the finish heavier.',
      ],
    },
    behindCurl: {
      reach: 'Arm straight at the bottom, with the upper arm about 30 degrees behind your torso.',
      points: [
        'Set the pulley at the bottom and clip a D handle to it. Hold the handle in your right hand. Face away from the pulley with your hips about two steps in front of it and the pulley directly behind your right hand, and stagger your feet with your left foot forward. Hold the upper arm about 30 degrees behind your torso, with the elbow just behind the line of your back, and let your left arm hang. To work the left arm, do everything mirrored.',
        'Both heads of the biceps cross the elbow and the front of the shoulder, so they are longest with the elbow fully straight and the upper arm behind your torso. That makes the biceps longer at the stretch than in a curl with the arms at your sides.',
        'Curl until the forearm is about 15 degrees above level. Past that the forearm turns toward the line of the cable and the load gets lighter. Keep the elbow behind you and your torso upright through the rep. If the elbow drifts forward, the biceps shortens at the shoulder and the front delt takes part of the work.',
        'The cable pulls the hand back, against the curl. It resists the movement most as your hand passes your hip. At the stretch it resists a little over half as much, and at the finish a little over a quarter as much. Standing closer to the pulley makes the stretch lighter and the finish heavier. Leaning forward also makes the stretch lighter, because it tips the arm back toward the line of the cable.',
      ],
    },
  },
  exercises: {
    'cable-bicep-curl': 'curl',
    'cable-hammer-curl': 'hammerCurl',
    'cable-reverse-curl': 'reverseCurl',
    'cable-behind-the-back-bicep-curl': 'behindCurl',
  },
};
