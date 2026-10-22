/**
 * Barbell bench press: incline, flat and decline.
 *
 * The body lies on its back with the head toward -z, tipped by the bench
 * angle. The torso holds one arch for the whole rep and the shoulder blades
 * stay pulled back and down, so only the arms move. The bar's path is set in
 * the room, from where it touches the chest at the bottom to over the
 * shoulder joints at lockout, and each arm reaches for its hand on the bar
 * with the elbow under it (see DOWN).
 *
 * Work is done in a base frame laid along the back pad: x to the person's
 * right, y along the pad toward the feet, z out of the pad. It is the body's
 * own frame before the arch, so the pad is the plane z = pad.
 *
 * Views: Front looks from the feet end, as a spotter at the feet would see
 * grip width, elbow flare and the forearms over the elbows, and on the flat
 * and incline the stance.
 * Side shows the bench angle, the arch, the leg setup and the bar's path from
 * the chest to over the shoulders. Top looks square onto the pad and shows
 * how far the elbows are out from the sides and where on the chest the bar
 * lands. Front and Top put the person's right on screen right, like the
 * standing figures. The shoulder blades hold still and no view shows them.
 * A view from under the pad showed them as two still grey arcs and
 * otherwise repeated Top.
 */
import type { Body, BodySpec, Limb } from '../figure3d/body';
import { solveBody } from '../figure3d/body';
import type { FigureDef, MuscleName } from '../figure3d/figure';
import type { Q, V3 } from '../figure3d/math';
import { add, cross, dist, dot, len, mul, norm, pitchFwd, qRot, sub } from '../figure3d/math';
import type { Camera, Prim } from '../figure3d/scene';
import { CAM } from '../figure3d/scene';
import { bar, box, cylinder, floor, rail } from '../figure3d/equipment';
import type { Cue, Group } from './kit';
import { DIM } from './kit';

/*
 * The arch, held through the rep. The pelvis tips 10 degrees so the low back
 * lifts off the pad, and the upper back bends back 17 against it, which was
 * solved so the upper back and the seat of the pelvis rest on one flat pad.
 * The low back then clears the pad by about 4.6 at its highest.
 *
 * The arch tips the upper torso 7 degrees flatter than the pad, so the upper
 * torso lies at 23 degrees on the 30 degree incline and like a 7 degree
 * decline on the flat bench. A real arch does the same. The incline cue's
 * research sentence is about the bench's angle, which stays 30.
 */
const ARCH = { pelvis: 10, lumbar: 0, thoracic: -17 };
/** Neck extension that lays the back of the head on the pad, solved against the arch. */
const NECK = -17;
/** Shoulder blades pulled back and down, held. */
const SCAP = { x: -3, y: 2, z: -2 };

/*
 * Half the distance between the hands' grip centers. Measured on the flat
 * bench touching at -35, for half widths 34 / 37 / 40 / 43:
 *
 *   forearm tilt in from vertical at the bottom, from the feet:   15 / 12 / 8 / 4
 *   elbows out from the sides at the bottom, degrees:             53 / 58 / 62 / 65
 *   pecSternal length at the bottom:                            32.6 / 33.0 / 33.4 / 33.7
 *
 * The elbows sit under the hands seen from the side, so a wider grip also
 * flares them. The grip is set by the usual rule of forearms close to
 * vertical at the bottom, seen from the feet: 40, an 8 degree tilt, with the
 * elbows 62 out from the sides. That puts the elbows 27 outside the shoulder
 * joints and 12 below them, so the hands are 80 apart and the shoulder joints
 * 34. The width follows from that elbow angle with upright forearms.
 * Separately, the torso is drawn deep: the shoulder joints sit 13.8 above the
 * pad, which brings the elbows to 1.7 above the pad at the bottom and makes
 * the bar travel 42 up. No cue sentence depends on either.
 */
const GRIP = 40;
/** Shoulder to hand at lockout: the elbows 8 degrees short of locked. */
const REACH = 65.85;
/** Bar radius, so the bar's center sits this far off the chest when it touches. */
const BAR_R = 1.5;

/** Pad sizes: an adjustable bench's pads are about 28 wide and 6 thick. */
const PAD_W = 28;
const PAD_T = 6;
/** Decline leg rollers: foam pads about 15 across. */
const ROLLER_R = 7.5;
/** Foot roller center above the ankle joint, along the shin. */
const FOOT_ROLLER_UP = 9;

/*
 * Elbow pole: straight down in the room. Only its part square to the line
 * from shoulder to hand counts, so each elbow bends down from that line, in
 * the upright plane through the hand. That keeps the forearm under the bar
 * seen from the side all through the rep, and lets the elbows flare as the
 * bar drifts toward the head. Seen from the side the forearms lean at most
 * 5 (incline), 6 (flat) and 7 (decline) degrees. The elbow angle at the
 * bottom then follows from the grip and where the bar touches.
 *
 * The first version sent the elbows toward a set angle out from the sides at
 * the bottom and turned them toward straight out by lockout. The forearms
 * then trailed toward the feet, leaning 14 degrees at t = 0.4 on the flat and
 * 15 at t = 0.3 on the decline. Holding the set angle at the bottom and
 * switching to this pole by t = 0.3 still leaned them 10 at t = 0.15, and
 * swung the elbows out so fast that the flat's shoulder share fell from 80
 * at t = 0 to 42 at t = 0.25.
 */
const DOWN: V3 = [0, 1, 0];

/*
 * Front looks from the feet end, 30 degrees up off the pad's plane, which
 * shows the body the same way on each bench: raised 30 above level on the
 * flat, 45 on the decline and level on the incline. From a level camera the
 * flat bench's torso drew as a box with arms and the decline's pad as a
 * second box inside it. Raised 30 above level on the incline, Front came
 * within 30 degrees of Top and repeated it.
 */
const FRONT_EL = (30 * Math.PI) / 180;

type Legs = 'floor' | 'rollers';

interface Setup {
  /** Back pad angle above horizontal, degrees; negative is a decline. */
  incline: number;
  /** Where the bar touches, as a height on the upper torso in body coordinates. */
  touchY: number;
  muscle: MuscleName;
  legs: Legs;
  /** Also check the lowest sternal fibers, for a cue that makes a claim about them. */
  lowerFibers?: boolean;
}

/** Upper arm 10 from the shoulder, where the pec proxies in analysis.ts insert. */
const humerus10 = (b: Body, s: 'R' | 'L'): V3 =>
  add(b.j[`shoulder${s}`], mul(norm(sub(b.j[`elbow${s}`], b.j[`shoulder${s}`])), 10));

/*
 * Lower pec fibers, from the bottom of the sternum 3 off the midline, as in
 * fly.ts. analysis.ts's pecSternal starts at mid-sternum. The lowest fibers
 * also come from the cartilages of the lower ribs, lower and farther out.
 * Started there instead, at x 8, y -28 or x 10, y -26 on the chest, the
 * proxy still shortens more on the decline: 24.4% against 18.2% on the
 * flat, and 22.9% against 16.2%.
 */
const pecCostal = (s: 'R' | 'L') => ({
  name: `pecCostal${s}`,
  len: (b: Body) => dist(b.at('upper', [s === 'R' ? 3 : -3, -30, 14]), humerus10(b, s)),
});

const DUMMY: Limb = { dirs: [[0, 1, 0], [0, 1, 0]] };

/** Depth of the upper torso's front face at a height, from its two rings. */
const frontAt = (y: number) => DIM.mid.f + ((y - DIM.mid.y) / (DIM.top.y - DIM.mid.y)) * (DIM.top.f - DIM.mid.f);

const lowest = (pts: V3[], f: (p: V3) => number) => Math.min(...pts.map(f));

function bench(s: Setup): FigureDef {
  // Lying back from standing: 90 lays the back flat with the head toward -z.
  const base: Q = pitchFwd(-(90 - s.incline));
  const toBase: Q = pitchFwd(90 - s.incline);
  const B = (p: V3): V3 => qRot(base, p);
  const inBase = (p: V3): V3 => qRot(toBase, p);

  const torsoSpec: Omit<BodySpec, 'armR' | 'armL' | 'legR' | 'legL'> = {
    pos: [0, 0, 0],
    rot: base,
    pelvis: { flex: ARCH.pelvis },
    lumbar: { flex: ARCH.lumbar },
    thoracic: { flex: ARCH.thoracic },
    neck: { flex: NECK },
    scapR: SCAP,
  };
  const torso = solveBody({ ...torsoSpec, armR: DUMMY, armL: DUMMY, legR: DUMMY, legL: DUMMY });
  // The pad is the plane the seat of the pelvis rests on.
  const pad = lowest(torso.torso.pelvis, (p) => inBase(p)[2]);
  const headY = inBase(torso.head.c)[1];

  /*
   * Floor. A flat bench pad is 43 off the floor. The incline's seat is 45 off
   * it. The top of the decline's pad is 58 off the floor under the hips, which
   * puts the top of its head end about 35 off it.
   */
  const padUnderHips = B([0, 0, pad]);
  const seatTop = Math.max(...torso.torso.pelvis.map((p) => p[1]));
  const floorY = s.incline > 5 ? seatTop + 45 : s.incline < -5 ? padUnderHips[1] + 58 : padUnderHips[1] + 43;

  let legR: Limb;
  let legL: Limb;
  let foot: BodySpec['footR'];
  let rollers: { knee: V3; foot: V3 } | null = null;
  if (s.legs === 'floor') {
    // Feet flat and wider than the hips, toes turned out 15, shins near
    // upright, knees out over the feet.
    const heelZ = s.incline > 5 ? 34 : 30;
    const out = 0.26;
    const planted = (sx: number): Limb => ({
      foot: { heel: [sx * 24, floorY, heelZ], dir: [sx * out, 0, 1] },
      pole: [sx * 0.15, -1, 0.1],
    });
    legR = planted(1);
    legL = planted(-1);
  } else {
    /*
     * Decline: thighs rise 32 above horizontal from the hips, the knees bend
     * 108 over the knee roller, and the shins hang to the foot roller.
     */
    const thighUp = 32;
    const kneeBend = 108;
    const th: V3 = [0, -Math.sin((thighUp * Math.PI) / 180), Math.cos((thighUp * Math.PI) / 180)];
    const shA = ((thighUp - kneeBend) * Math.PI) / 180;
    const sh: V3 = [0, -Math.sin(shA), Math.cos(shA)];
    const leg = (sx: number): { limb: Limb; knee: V3; ankle: V3 } => {
      const hip = sx > 0 ? torso.j.hipR : torso.j.hipL;
      const knee = add(hip, mul(norm(add(th, [sx * 0.05, 0, 0])), DIM.thigh));
      const ankle = add(knee, mul(sh, DIM.shin));
      return { limb: { pts: [knee, ankle] }, knee, ankle };
    };
    const r = leg(1);
    const l = leg(-1);
    legR = r.limb;
    legL = l.limb;
    // Feet square to the shins, toes away from the bench.
    const fd = norm(cross(sh, [1, 0, 0]));
    foot = { dir: dot(fd, [0, 0, 1]) > 0 ? fd : mul(fd, -1), up: mul(sh, -1) };
    /*
     * The knee roller sits in the crook of the knee, touching the back of the
     * thigh (7 in radius) and the calf (5), so the legs hang on it and hold
     * the body from sliding down the pad. The foot roller sits on the front
     * of the shins above the ankles.
     */
    const kneeMid = mul(add(r.knee, l.knee), 0.5);
    const ankleMid = mul(add(r.ankle, l.ankle), 0.5);
    const sinK = Math.sin(((180 - kneeBend) * Math.PI) / 180);
    const shFront = norm(cross([1, 0, 0], sh));
    const shinFront: V3 = dot(shFront, [0, 0, 1]) > 0 ? shFront : mul(shFront, -1);
    rollers = {
      knee: add(kneeMid, add(mul(th, -(5 + ROLLER_R) / sinK), mul(sh, (7 + ROLLER_R) / sinK))),
      foot: add(add(ankleMid, mul(sh, -FOOT_ROLLER_UP)), mul(shinFront, 5 + ROLLER_R)),
    };
  }

  // Bar: touching the chest at the bottom, over the shoulder joints at lockout.
  const touch = torso.at('upper', [0, s.touchY, frontAt(s.touchY) + BAR_R]);
  const shMid = mul(add(torso.j.shoulderR, torso.j.shoulderL), 0.5);
  const shX = torso.j.shoulderR[0];
  const top: V3 = [0, shMid[1] - Math.sqrt(REACH * REACH - (GRIP - shX) ** 2), shMid[2]];
  /*
   * The bar leaves the chest moving up and toward the head, and most of that
   * drift is done by halfway, so it finishes straight up over the shoulders.
   */
  const barAt = (t: number): V3 => {
    const k = 1 - (1 - t) * (1 - t);
    return [0, touch[1] + (top[1] - touch[1]) * t, touch[2] + (top[2] - touch[2]) * k];
  };

  const feetEnd: Camera = {
    dir: B([0, Math.cos(FRONT_EL), Math.sin(FRONT_EL)]),
    up: B([0, -Math.sin(FRONT_EL), Math.cos(FRONT_EL)]),
    right: [1, 0, 0],
  };
  // The frame under the pad shows round it from above: crossbars beside the
  // head, the incline's floor rail under the seat. The decline's rollers
  // stack into a ladder over the knees from above, so they go too, but its
  // legs stay, as on the other benches: the thighs and knees show below the
  // hips. That takes the shared box from 163 to 170 tall at the same scale.
  const hideTop = s.legs === 'rollers' ? ['eq.frame', 'eq.roller'] : ['eq.frame'];
  /*
   * Front on the flat: the head end's floor crossbar showed between the legs
   * as two short ticks beside the hips, over the thighs. The foot end's post
   * and crossbar already show the bench there.
   */
  const frontHide = s.legs === 'rollers' ? ['leg', 'eq.roller', 'eq.frame'] : s.incline > 5 ? undefined : ['eq.frame.head'];
  return {
    views: [
      /*
       * The decline's legs and rollers stack into a ladder over the pelvis.
       * This view draws no floor, since the camera is not level, so the
       * decline's frame showed as a lone pole hanging below the pelvis: the
       * floor rail running toward the camera and the lower part of the
       * hip-end leg. Hiding it took the shared box from 183 to 163 tall,
       * before the Top view showed the legs.
       */
      { label: 'Front', cam: feetEnd, hide: frontHide },
      // The near plate, seen face on, would cover the chest and arms. The far
      // plate is centered on the bar behind the body and shows where it is.
      { label: 'Side', cam: CAM.side, hide: ['eq.bar.near'] },
      // Square to the pad, so the elbow angle from the torso's side draws true.
      { label: 'Top', cam: { dir: B([0, 0, 1]), up: B([0, -1, 0]), right: [1, 0, 0] }, hide: hideTop },
    ],
    pose: (t) => {
      const c = barAt(t);
      return {
        ...torsoSpec,
        armR: { ik: add(c, [GRIP, 0, 0]), pole: DOWN },
        armL: { ik: add(c, [-GRIP, 0, 0]), pole: DOWN },
        legR,
        legL,
        footR: foot,
        footL: foot,
      };
    },
    equipment: (b) => {
      const br = bar('barbell', b.j.handR, b.j.handL);
      // The left plate is the one nearest the Side camera.
      const plates = br.prims.map((q) => (q.k === 'solid' && q.group === 'eq.bar.plate-1' ? { ...q, part: 'eq.bar.near' } : q));
      const out: Prim[] = [floor(floorY), ...plates];
      const padBox = (y0: number, y1: number, part: string) =>
        box(B([0, (y0 + y1) / 2, pad - PAD_T / 2]), [PAD_W, y1 - y0, PAD_T], { rot: base, part });
      const toFloor = (p: V3): V3 => [p[0], floorY, p[2]];
      // Head end of a pad that reaches past the head.
      const head0 = headY - DIM.head.r - 4;
      if (s.incline > 5) {
        /*
         * Backrest from the seat to 6 past the head's center, 91 long, which
         * stops 5 short of the top of the head. Ending it at the head left
         * the head balanced on its corner. The seat is level under the seat
         * of the pelvis and runs forward under the thighs;
         * tipped up at the front, as some seats are, it cut 2 into the
         * thighs, which slope down 15 to the knees.
         */
        const back0 = headY - 6;
        const back1 = 10;
        out.push(padBox(back0, back1, 'eq.backrest'));
        const contact = torso.torso.pelvis.reduce((m, p) => (p[1] > m[1] ? p : m));
        const seatC: V3 = [0, seatTop + PAD_T / 2, contact[2] + 13];
        out.push(box(seatC, [30, PAD_T, 34], { part: 'eq.seat' }));
        const postTop = add(seatC, [0, PAD_T / 2, 0]);
        const backMid = B([0, (back0 + back1) / 2, pad - PAD_T]);
        out.push(
          rail([postTop, toFloor(postTop)], { part: 'eq.frame' }),
          rail([backMid, toFloor(add(backMid, [0, 0, -6]))], { part: 'eq.frame' }),
          rail([toFloor(add(backMid, [0, 0, -6])), toFloor(add(postTop, [0, 0, 25]))], { part: 'eq.frame' }),
        );
      } else if (rollers) {
        // Decline pad from past the head to just past the hips, 106 long.
        const back0 = head0;
        const back1 = 16;
        out.push(padBox(back0, back1, 'eq.backrest'));
        const kr = rollers.knee;
        const fr = rollers.foot;
        out.push(
          cylinder(add(kr, [-16, 0, 0]), add(kr, [16, 0, 0]), ROLLER_R, { part: 'eq.roller.knee' }),
          cylinder(add(fr, [-16, 0, 0]), add(fr, [16, 0, 0]), ROLLER_R, { part: 'eq.roller.foot' }),
        );
        // The hip-end leg sits under the low back. Front hides the frame.
        const headLeg = B([0, back0 + 12, pad - PAD_T]);
        const hipLeg = B([0, back1 - 30, pad - PAD_T]);
        out.push(
          rail([headLeg, toFloor(headLeg)], { part: 'eq.frame' }),
          rail([hipLeg, toFloor(hipLeg)], { part: 'eq.frame' }),
          rail([toFloor(headLeg), toFloor(kr)], { part: 'eq.frame' }),
          rail([toFloor(kr), kr, fr], { part: 'eq.roller.post' }),
        );
      } else {
        // Flat pad, 120 long, from past the head to under the thighs.
        const back0 = head0;
        const back1 = back0 + 120;
        out.push(padBox(back0, back1, 'eq.pad'));
        for (const [y, part] of [
          [back0 + 14, 'eq.frame.head'],
          [back1 - 14, 'eq.frame'],
        ] as const) {
          const top0 = B([0, y, pad - PAD_T]);
          out.push(
            rail([top0, toFloor(top0)], { part }),
            rail([toFloor(add(top0, [-22, 0, 0])), toFloor(add(top0, [22, 0, 0]))], { part }),
          );
        }
      }
      return out;
    },
    check: {
      muscles: [
        { m: s.muscle, side: 'R' },
        { m: s.muscle, side: 'L' },
      ],
      custom: s.lowerFibers ? [pecCostal('R'), pecCostal('L')] : undefined,
      /*
       * Gravity on the bar, half in each hand. The hands are wider than the
       * shoulders, so a load straight down at each hand still turns the arms
       * out to the side at lockout: share 35 and moment arm 23.0 there on all
       * three. A real bar also lets the hands push out against each other,
       * which this leaves out. The moment arm falls from the bottom to
       * t = 0.25 and climbs back to that lockout figure, flat 23.4 / 20.7 /
       * 21.1 / 22.7 / 23.0, decline 22.0 at the bottom, so the cue claims
       * nothing about where the press is hardest. Share falls from the bottom
       * to lockout, 80 / 71 / 62 to 35 (incline, flat, decline), and the part
       * of the moment arm that no grip force can remove, the bar's distance
       * toward the feet from the shoulder joints, falls from 10.8 / 13.7 /
       * 12.9 to 0.
       */
      load: (b) => [
        { at: b.j.handR, dir: [0, 1, 0] },
        { at: b.j.handL, dir: [0, 1, 0] },
      ],
      lever: [
        { joint: 'shoulderR', end: 'elbowR' },
        { joint: 'shoulderL', end: 'elbowL' },
      ],
      /*
       * Near lockout the upper arm rises from a shoulder joint 3 inside the
       * torso's square top corner and runs along it, 3.7 to 3.8 into it at
       * t = 1, past the check's 2.5 only there. That corner stands for the
       * deltoid and the edge of the pec, which the arm itself is; a real
       * chest tapers there.
       */
      allow: ['armR.upper~torso', 'armL.upper~torso'],
      contacts: (b) => {
        const cs: { name: string; gap: number; tol?: number }[] = [
          { name: 'pelvis on pad', gap: lowest(b.torso.pelvis, (p) => inBase(p)[2]) - pad },
          { name: 'upper back on pad', gap: lowest(b.torso.upper, (p) => inBase(p)[2]) - pad },
          { name: 'head on pad', gap: inBase(b.head.c)[2] - DIM.head.r - pad },
        ];
        if (s.legs === 'floor')
          for (const k of ['heelR', 'toeR', 'heelL', 'toeL'] as const) cs.push({ name: `${k} on floor`, gap: b.j[k][1] - floorY });
        if (rollers) {
          // Distance in the side plane from a roller's surface to a limb's.
          const segGap = (a: V3, e: V3, c: V3, r: number) => {
            const d = sub(e, a);
            const k = Math.max(0, Math.min(1, dot(sub(c, a), d) / dot(d, d)));
            const q = add(a, mul(d, k));
            return len([0, q[1] - c[1], q[2] - c[2]]) - r - ROLLER_R;
          };
          cs.push(
            { name: 'thighR on knee roller', gap: segGap(b.j.hipR, b.j.kneeR, rollers.knee, 7) },
            { name: 'calfR on knee roller', gap: segGap(b.j.kneeR, b.j.ankleR, rollers.knee, 5) },
            { name: 'shinR on foot roller', gap: segGap(b.j.kneeR, b.j.ankleR, rollers.foot, 5) },
          );
        }
        return cs;
      },
    },
  };
}

/*
 * Where the bar touches, as a height on the torso, where the shoulder joints
 * are at -51, the collarbones about -56 and the bottom of the breastbone
 * about -33. The forearms stand under the bar seen from the side, so the
 * touch sets how far out the elbows go. Measured at the bottom:
 *
 *   flat at -31 / -35 / -39 / -43:     elbows out from the sides  55 / 62 / 70 / 79
 *                                      forearm tilt from the feet  4 /  8 / 11 / 14
 *   incline at -43 / -47 / -51:        elbows out from the sides  49 / 56 / 64
 *                                      forearm tilt from the feet  2 /  7 / 12
 *   decline at -28 / -30 / -32:        elbows out from the sides  63 / 67 / 71
 *                                      forearm tilt from the feet  9 / 11 / 13
 *
 * The flat bench touches at -35, the lower chest, with the elbows about 60
 * out. The incline touches at -47, about a hand's width below the
 * collarbones, with the elbows about 55 out. The decline touches at -30, at
 * or just below the bottom of the breastbone, with the elbows about 65 out;
 * at -32 they went to 71. Seen from the side the forearms lean 3 (incline),
 * 5 (flat) and 6 (decline) at the bottom. Tilts from the feet are seen level,
 * looking along the room.
 *
 * Elbows posed at 45 / 52 / 60 / 70 / 80 degrees out from the sides at the
 * bottom of the flat bench, touching at -35, with the forearms left to lean:
 *
 *   pecSternal length at the bottom:  31.8 / 32.6 / 33.3 / 34.0 / 34.5
 *
 * The flat cue's sentence on elbow angle holds to the usual 45 to 70.
 */
const flat = bench({ incline: 0, touchY: -35, muscle: 'pecSternal', legs: 'floor' });
const incline = bench({ incline: 30, touchY: -47, muscle: 'pecClavicular', legs: 'floor' });
/*
 * The decline checks the lower fibers too, for its cue's sentence on them.
 * pecCostal falls 34.6 to 26.3 here, 24%, and 34.2 to 27.8 on the flat, 19%,
 * measured the same way; the shoulder is raised 70 degrees from the sides at
 * lockout here and 84 on the flat.
 */
const decline = bench({ incline: -15, touchY: -30, muscle: 'pecSternal', legs: 'rollers', lowerFibers: true });

const cues: Record<string, Cue> = {
  benchIncline: {
    reach: 'Bar touching your upper chest about a hand\'s width below your collarbones, with your elbows below your shoulders and about 55 degrees out from your sides.',
    points: [
      ['Setup', 'Set the bench to about 30 degrees. Sit with your hips in the corner of the seat and backrest and your feet flat on the floor, wider than your hips. Pull your shoulder blades back and down and keep them there, with a moderate arch between your upper back and hips.'],
      ['Grip', 'Grip the bar so your forearms are close to vertical at the bottom, seen from your feet.'],
      ['Stretch', 'Lower the bar to your upper chest, about a hand\'s width below your collarbones, with your forearms close to vertical seen from the side. Your elbows end up about 55 degrees out from your sides. The upper pec is longest here.'],
      ['Press', 'Press up and slightly toward your head, so the bar finishes over your shoulders.'],
      ['Avoid', 'Bouncing the bar off your chest. Lower it under control and touch lightly. Pec tears in the gym are reported most often on the bench press.'],
    ],
  },
  benchFlat: {
    reach: 'Bar touching your lower chest, with your elbows below your shoulders and about 60 degrees out from your sides.',
    points: [
      ['Setup', 'Lie on the bench with your feet flat on the floor, wider than your hips. Pull your shoulder blades back and down and keep them there, with a moderate arch between your upper back and hips.'],
      ['Grip', 'Grip the bar so your forearms are close to vertical at the bottom, seen from your feet.'],
      ['Stretch', 'Lower the bar to your lower chest, just above the bottom of your breastbone, with your forearms close to vertical seen from the side. Your elbows end up about 60 degrees out from your sides. The pec is longest here.'],
      ['Press', 'Press up and slightly toward your head, so the bar finishes over your shoulders.'],
      ['Avoid', 'Bouncing the bar off your chest. Lower it under control and touch lightly. Pec tears in the gym are reported most often on the bench press. Also avoid tucking your elbows close to your sides at the bottom, which makes the pec a little shorter.'],
    ],
  },
  benchDecline: {
    reach: 'Bar touching the bottom of your breastbone, with your elbows below your shoulders and about 65 degrees out from your sides.',
    points: [
      ['Setup', 'Set the bench to about 15 degrees of decline, head down. Hook your knees over the knee roller with the foot roller against the front of your lower shins. Pull your shoulder blades back and down and keep them there, with a moderate arch between your upper back and hips.'],
      ['Grip', 'Grip the bar so your forearms are close to vertical at the bottom, seen from your feet.'],
      ['Stretch', 'Lower the bar to the bottom of your breastbone, with your forearms close to vertical seen from the side. Your elbows end up about 65 degrees out from your sides. The pec is longest here.'],
      ['Press', 'Press up and slightly toward your head, so the bar finishes over your shoulders. With your head low, your arms finish closer to your sides, so the lower pec shortens more than on a flat bench.'],
      ['Avoid', 'Bouncing the bar off your chest. Lower it under control and touch lightly. Pec tears in the gym are reported most often on the bench press.'],
    ],
  },
};

export const group: Group = {
  figures: { benchIncline: incline, benchFlat: flat, benchDecline: decline },
  cues,
  exercises: {
    'barbell-incline-bench-press': 'benchIncline',
    'barbell-bench-press': 'benchFlat',
    'barbell-decline-bench-press': 'benchDecline',
  },
};
