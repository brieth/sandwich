# Writing a stretch figure

Each exercise in the app opens a modal from its name: an animated drawing of the
exercise and a cue underneath. The drawing exists to show the position where the
target muscle is longest, and how to reach it. This guide covers how figures are
built, checked and written up.

## The standard

The three crossover flys (`src/lib/figures/fly.ts`) set the bar. Every figure
must match them on all of these:

- **A whole body in 3D**, placed the way the person actually does the exercise:
  stance, seat, bench, kneeling, lean. Legs, feet and head are all there.
- **The right equipment**, at real sizes and positions: the attachment the user
  actually uses, pulleys where they really are, seats and pads where the body
  rests on them, the floor.
- **Every applicable angle.** Each view must show something the others do not
  (stance, lean, bar path, blade movement, elbow path). No angle that adds
  nothing. Order them Front, Back, Side, Top.
- **Only moving body parts are teal.** This is automatic: any body part that
  moves more than 0.75 cm through the rep is teal, everything else grey.
  Equipment is always grey. If something is teal that should hold still, the
  pose is wrong.
- **A verified stretch.** t = 0 is the stretch. The target muscle's length
  proxy must be longest at t = 0 and clearly shorter at t = 1 (the check
  enforces this).
- **Measured leverage.** The check prints how much of the load turns the
  working joint at each point. Any claim the cue makes about where the rep is
  hard or easy must agree with these numbers.
- **A cue rewritten to match the drawing and the numbers.**

Look at the fly figures before starting:

    node scripts/figures/render.mjs /tmp/fly.png all 0,0.25,0.5,0.75,1 1.2 --file src/lib/figures/fly.ts

## The user's setups

The person is 178 cm. These setups are what the user does; draw exactly these.

| Exercise id | Name | Setup | Attachment |
|---|---|---|---|
| barbell-incline-bench-press | Barbell Incline Bench Press | Bench at about 30 degrees | barbell |
| barbell-bench-press | Barbell Bench Press | Flat bench | barbell |
| barbell-decline-bench-press | Barbell Decline Bench Press | Bench at about 15 degrees decline | barbell |
| close-grip-lat-pulldown | Close Grip Lat Pulldown | Seated, knee pad, narrow overhand grip on the lat bar | lat bar |
| lat-pulldown | Lat Pulldown | Seated, knee pad | lat bar |
| wide-grip-lat-pulldown | Wide Grip Lat Pulldown | Seated, knee pad | lat bar |
| cable-single-arm-high-row | Cable High Row | Half-kneeling, high pulley, one arm | D handle |
| cable-single-arm-mid-row | Cable Mid Row | Standing staggered, one arm | D handle |
| cable-single-arm-low-row | Cable Low Row | Standing staggered, low pulley, one arm | D handle |
| cable-high-overhead-tricep-extension | Cable High Overhead Tricep Extension | Standing staggered, facing away from the pulley | rope |
| cable-low-overhead-tricep-extension | Cable Low Overhead Tricep Extension | Standing staggered, facing away from the pulley | straight bar |
| cable-tricep-pushdown | Cable Tricep Pushdown | Standing, facing a high pulley | rope |
| cable-single-arm-underhand-tricep-pushdown | Cable Cross Body Tricep Extension | Mid pulley; the cable crosses in front of the body and the arm extends out to the side | D handle |
| cable-bicep-curl | Cable Bicep Curl | Standing, facing a low pulley | cambered bar |
| cable-hammer-curl | Cable Hammer Curl | Standing, facing a low pulley | rope |
| cable-reverse-curl | Cable Reverse Curl | Standing, facing a low pulley, overhand | straight bar |
| cable-behind-the-back-bicep-curl | Cable Behind the Back Bicep Curl | Facing away from a low pulley, one arm | D handle |
| cable-behind-the-back-lateral-raise | Cable Behind the Back Lateral Raise | Low pulley, cable behind the back, one arm | D handle |
| cable-single-arm-rear-delt-fly | Cable Rear Delt Fly | Pulley above head height, one arm | D handle |
| cable-face-pull | Cable Face Pull | Pulley above head height | rope |
| cable-upright-row | Cable Upright Row | Standing, low pulley | cambered bar |
| machine-leg-press | Machine Leg Press | Horizontal seated leg press | machine |
| machine-leg-curl | Machine Leg Curl | Seated leg curl | machine |
| machine-leg-extension | Machine Leg Extension | Seated | machine |
| machine-hip-abductor | Machine Hip Abductor | Seated | machine |
| machine-hip-adductor | Machine Hip Adductor | Seated | machine |
| cable-crunch | Cable Crunch | Kneeling, facing a high pulley | rope |
| cable-oblique-crunch | Cable Oblique Crunch | Kneeling, high pulley, crunching down and across toward one hip | D handle |
| cable-high-woodchopper | Cable High Woodchopper | Standing side-on, high pulley | D handle |
| cable-low-woodchopper | Cable Low Woodchopper | Standing side-on, low pulley | D handle |

Single-arm work is drawn with the right arm. The single-arm exercises are logged
per arm; the user does both sides.

## Files and rules

- Your group file is `src/lib/figures/<group>.ts`. It exports
  `export const group: Group = { figures, cues, exercises }` (types in
  `kit.ts`). Write only that file. It is already registered in `index.ts`.
- **Do not edit anything in `src/lib/figure3d/`, `kit.ts`, `index.ts` or
  another group's file.** Other figures are being written at the same time. If
  the engine cannot do something you need, build it in your own file from the
  primitive types (`Prim` in `scene.ts`), and report what the engine lacked.
- Do not commit. Do not run `npm run build` or the whole-project `tsc`; other
  files may be mid-edit. Use the per-file tools below.

## Tools

    sh scripts/figures/tsc-one.sh src/lib/figures/<group>.ts
    node scripts/figures/check.mjs all --file src/lib/figures/<group>.ts
    node scripts/figures/render.mjs <out.png> all 0,0.25,0.5,0.75,1 1.2 --file src/lib/figures/<group>.ts

Render to your scratchpad and look at the PNG with the Read tool. Rows are
views, columns are moments in the rep; the cue is printed under each figure.
Zoom 2 or 3 with fewer columns to inspect detail. The canvas in the app is
drawn the same way at about 300 to 360 CSS pixels wide.

`check.mjs` prints, at t = 0, 0.25, 0.5, 0.75 and 1: each muscle proxy's
length, the leverage table, and joint angles; then PASS or FAIL lines. Every
FAIL must be fixed or, if it is a false alarm, answered with an `allow` entry
and a comment in the figure saying why it is fine in real life.

## Coordinates and the body

Centimeters. x is the person's right, y is **down**, z is forward, in the room
and in the body. Standing upright facing +z, the hip-joint center is the body's
origin; feet are 93 below it with straight legs.

Body dimensions (`DIM` in `body.ts`, re-exported from `kit.ts`), in standard
upright body coordinates:

| | |
|---|---|
| hip joints | x = ±10, y = 0 |
| torso | waist ring y = 0 (half width 14, depth ±13), mid ring y = −29 (17, ±14), top y = −58 (20, ±15) |
| pelvis block | y = 0 to 9 (seat contact at y = 9 below the hips when sitting) |
| shoulder joints | (±20, −53, 0), moved by the scapula offset |
| head | center (0, −76, 3), radius 11 |
| upper arm 34, forearm to grip center 32 | thigh 44, shin 42, ankle 7 above the sole, heel 4 behind and toe 18 ahead of the ankle |

### Pose

A figure's `pose(t)` returns a `BodySpec` (see `body.ts` for the full types):

- `pos`: the hip-joint center in the room. `rot`: the pelvis's base
  orientation as a quaternion (identity = standing, facing +z). Use `qAxis`,
  `pitchFwd`, `turnRight`, `bendRight`, `qMul` from `math.ts` to build it.
- `pelvis`, `lumbar`, `thoracic`, `neck`: `Rot3 { flex, side, twist }` in
  degrees, each relative to the segment below. flex tips the top forward
  (a hip hinge is `pelvis.flex`; a crunch is positive `lumbar` and `thoracic`
  flex; chest up is negative `thoracic` flex). side bends toward the person's
  right. twist turns the front toward the person's right.
- `scapR`, `scapL`: shoulder blade offsets `{ x, y, z, rot }` in the upper
  torso's axes, written for the right side (x is away from the spine, y down, z
  forward). The left blade mirrors the right unless `scapL` is given. `rot` is
  upward rotation in degrees and turns the drawn blade. Typical ranges:
  retracted x −2..−3, protracted x +3..+5 with z +2..+4, elevated y −5..−7,
  depressed y +2..+3, upward rotation up to about 45 with the arm overhead.
- `armR`, `armL`, `legR`, `legL`: a `Limb`:
  - `{ dirs: [upperDir, lowerDir], frame? }` unit directions in the upper torso
    frame (arms) or pelvis frame (legs), or `'world'`.
  - `{ ik: target, pole }` the hand or ankle goes to `target` in the room; the
    elbow or knee points toward `pole`. Unreachable targets straighten the limb
    and the check reports the miss.
  - `{ foot: { heel, dir, up? }, pole }` legs only: heel placed in the room,
    foot pointing along `dir`, sole facing away from `up` (default up = −y).
  - `{ pts: [mid, end] }` explicit points; lengths are checked.
- `footR`, `footL`: `{ dir, up }` for legs not placed with `foot` (default flat,
  pointing where the pelvis faces). Use it for kneeling (toes tucked or flat).

`kit.ts` has `key(t, [[0, a], [0.5, b], [1, c]])` to interpolate numbers,
vectors or objects through the rep, `keyDir` for directions, `dirHE(heading,
elevation)` and `mx` (mirror across the midline).

The solved `Body` has `j`: `hipR kneeR ankleR heelR toeR shoulderR elbowR handR`
and the L versions, plus `neck head mid`; `at(seg, p)` and `dirOf(seg, d)`
carry body-coordinate points and directions on a segment into the room.

### Equipment

`equipment(b, t)` returns primitives (helpers in `equipment.ts`): `floor(y)`,
`pulley(p)`, `cable(from, to)`, `handle(hand, toward, forearmDir)`,
`rope(handR, handL, toward)`, `bar(kind, handR, handL, opts)` with kind
`straight | cambered | lat | barbell`, `box(center, size, { rot })`,
`cylinder(a, b, r)`, `disc(c, axis, r, thick)`, `rail(points)`. Attachments
return `attach`, where the cable clips on: run the cable from the pulley to it.
Give each piece a distinct `part` name starting with `eq.` (e.g. `eq.seat`,
`eq.backpad`) so collisions read clearly. Pass `{ fit: false }` to a pulley and
its cable if it is so far away that keeping it in frame would shrink the person;
the cable then runs off the edge. Draw what helps a reader understand the
setup, at real sizes, and nothing more: no weight stacks, no decorative frame.

Real sizes to use when nothing better is known: a cable station's lowest pulley
is about 10 to 20 off the floor and its highest about 200 to 210; a flat bench
pad is about 43 high, 28 wide, 120 long; an Olympic bar is 220 long with 45 cm
plates centered about 75 from the middle; a lat bar is 120 with bent ends; a
short straight cable bar is 50; a rope's strands are 30.

### Views

`views: ViewDef[]`, each `{ label, cam, hide?, turn? }`. `VIEW.front`,
`VIEW.back`, `VIEW.side` (camera on the person's left, facing screen left),
`VIEW.sideRight` (camera on the right, facing screen right; use it for
right-arm single-arm work so the working arm is on the near side), `VIEW.top`.
**Front is drawn as in a mirror**: the person's right is on screen right in both
front and back views. A camera is `{ dir, up, right }` in room coordinates
(`dir` points from the scene toward the camera), so for a body that is not
standing and facing +z, write cameras that look at it the way the label says.
`hide` drops parts by name prefix (the fly top view hides `leg`). `turn`
rotates the drawing on screen. The modal opens on the first view.

The box is 240 units wide and up to 250 tall, sized and scaled to fit every
view across the whole rep at one shared scale. A tall figure is drawn smaller;
keep pulleys out of the fit only when they would shrink the person a lot.

### Checks

`check: CheckDef`:

- `muscles`: target muscles as `{ m, side }`. Proxies (`analysis.ts`):
  pecSternal, pecClavicular, lat, teresMajor, rearDelt, sideDelt, frontDelt,
  midTrap, upperTrap, tricepsLong, tricepsShort, bicepsLong, bicepsShort,
  brachialis, brachioradialis, quadsVasti, rectusFemoris, hamstrings, gluteMax,
  gluteMed, adductors, rectusAbdominis, obliqueExt, obliqueInt. Read how each is
  measured before trusting it. `custom` adds your own proxies.
- `load(b, t)`: external forces `{ at, dir }` on the body: a cable's direction
  toward its pulley at the hand, or gravity on a barbell. `lever`: the joints
  the load turns, each with the end of the limb that sets the motion's axis,
  matched to `load` by index.
- `contacts(b, t)`: places the body must touch: feet on the floor, seat under
  the pelvis, back against a pad, knees on the floor, shins against a roller.
- `allow`: part pairs allowed to touch, like `'armR.lower~head'`.

The leverage table: `share` is the torque about the axis the limb is moving
in, as a fraction of the most the force could give at that distance (100 is a
force square to the limb in its plane of motion). `sine` is the angle between
the limb and the force regardless of plane. `moment arm` is the torque about the
motion's axis per unit of force, in cm; it does not shrink when the limb folds,
so it is the row to compare across a press, a row or a curl. `resists +1` means the force works
against the contraction, as a load should.

## The cue

Under the figure: `reach`, one line naming the position to reach, and
`points`, 2 to 5 short paragraphs: the setup (stance, seat, attachment, where
the pulley is), why this is the long position for the muscle, what shortens it,
and what to keep fixed. Read the fly cues for the voice. Rules (CLAUDE.md):

- Plain and boring. State the fact, stop.
- Label every number with what it is: "lean forward about 20 degrees", not
  "about 20".
- No em dashes.
- No rhetorical constructions: no "X, not Y", no "instead of" contrasts, no
  "the thing that does Z", no sentence whose job is emphasis rather than
  information.
- American spelling.
- Numbers that appear together must reconcile, rounded the same way.

Everything the cue says must be true of the drawing and of the check numbers.
Name only research you are sure of, by its finding, stated conservatively.

Standing distances are given in steps, the same way in every cue. One step is
about 75 cm. Say the nearest half step and keep it honest: 100 cm is "about one
and a half steps", 120 cm "a little over one and a half steps", 130 cm "a
little under two steps", 150 cm "about two steps". Do not add centimeters to
the cue text.

## What to return

A short report: the figure keys and exercise ids you wrote, the views and what
each shows, the check summary (muscle lengths at 0 and 1, leverage at 0 and 1),
any `allow` entries and why, assumptions you made about the setup, and
anything the engine could not do.
