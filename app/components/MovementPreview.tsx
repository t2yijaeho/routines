"use client";

import { useEffect, useRef } from "react";

type Point = readonly [number, number];
type Chain = readonly [Point, Point, Point, Point];
type Arm = readonly [Point, Point, Point?];
type Leg = readonly [Point, Point, Point?];
type Pose = {
  head: Point;
  shoulder: Point;
  hip: Point;
  curve: Point;
  farArm: Chain;
  nearArm: Chain;
  farLeg: Chain;
  nearLeg: Chain;
  front: boolean;
};
type Equipment = "floor" | "bar" | "neutral-bar" | "dip-bars" | "bench" | "step" | "wall" | "uphill" | "downhill" | "mat";
type Scene = { pose: Pose; equipment: Equipment; still?: boolean };

export type MovementPreviewProps = {
  exerciseId: string;
  playing?: boolean;
  className?: string;
  size?: "card" | "player";
};

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (a: Point, b: Point, t: number): Point => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function extend(a: Point, b: Point, length: number): Point {
  const d = distance(a, b) || 1;
  return [b[0] + (b[0] - a[0]) * length / d, b[1] + (b[1] - a[1]) * length / d];
}

function rig(
  head: Point, shoulder: Point, hip: Point,
  farArm: Arm, nearArm: Arm, farLeg: Leg, nearLeg: Leg,
  options: { front?: boolean; curve?: Point } = {},
): Pose {
  const front = options.front ?? false;
  const arm = (parts: Arm, offset: number): Chain => [
    [shoulder[0] + offset, shoulder[1]], parts[0], parts[1], parts[2] ?? extend(parts[0], parts[1], 5),
  ];
  const leg = (parts: Leg, offset: number): Chain => [
    [hip[0] + offset, hip[1]], parts[0], parts[1], parts[2] ?? [parts[1][0] + 10, parts[1][1] + 1],
  ];
  return {
    head, shoulder, hip, front,
    curve: options.curve ?? point(shoulder, hip, 0.55),
    farArm: arm(farArm, front ? -12 : -2),
    nearArm: arm(nearArm, front ? 12 : 2),
    farLeg: leg(farLeg, front ? -7 : -2),
    nearLeg: leg(nearLeg, front ? 7 : 2),
  };
}

// Keep hands/feet on their supports while maintaining the same limb lengths
// throughout a repetition. The authored middle joint chooses the bend direction.
function joint(start: Point, target: Point, hint: Point, upper: number, lower: number): Point {
  const dx = target[0] - start[0];
  const dy = target[1] - start[1];
  const actual = Math.hypot(dx, dy) || 0.001;
  const d = Math.min(actual, upper + lower - 0.001);
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const ux = dx / actual;
  const uy = dy / actual;
  const first: Point = [start[0] + along * ux - height * uy, start[1] + along * uy + height * ux];
  const second: Point = [start[0] + along * ux + height * uy, start[1] + along * uy - height * ux];
  return distance(first, hint) < distance(second, hint) ? first : second;
}

function between(a: Pose, b: Pose, t: number): Pose {
  const limb = (first: Chain, last: Chain): Chain => {
    const start = point(first[0], last[0], t);
    const end = point(first[2], last[2], t);
    const hint = point(first[1], last[1], t);
    const firstUpper = distance(first[0], first[1]);
    const firstLower = distance(first[1], first[2]);
    const lastUpper = distance(last[0], last[1]);
    const lastLower = distance(last[1], last[2]);
    const firstExtension = distance(first[0], first[2]) / (firstUpper + firstLower);
    const lastExtension = distance(last[0], last[2]) / (lastUpper + lastLower);
    const extended = Math.max(firstExtension, lastExtension) > 0.96;
    let upper = extended ? (firstExtension > lastExtension ? firstUpper : lastUpper) : (firstUpper + lastUpper) / 2;
    let lower = extended ? (firstExtension > lastExtension ? firstLower : lastLower) : (firstLower + lastLower) / 2;
    const reach = Math.max(distance(first[0], first[2]), distance(last[0], last[2]));
    if (reach > upper + lower) {
      const factor = reach / (upper + lower);
      upper *= factor;
      lower *= factor;
    }
    return [start, joint(start, end, hint, upper, lower), end, point(first[3], last[3], t)];
  };
  return {
    head: point(a.head, b.head, t), shoulder: point(a.shoulder, b.shoulder, t),
    hip: point(a.hip, b.hip, t), curve: point(a.curve, b.curve, t), front: a.front,
    farArm: limb(a.farArm, b.farArm), nearArm: limb(a.nearArm, b.nearArm),
    farLeg: limb(a.farLeg, b.farLeg), nearLeg: limb(a.nearLeg, b.nearLeg),
  };
}

const STAND = rig([161, 41], [153, 62], [149, 111],
  [[143, 87], [148, 110]], [[165, 86], [174, 108]],
  [[143, 144], [142, 176]], [[156, 144], [158, 176]]);
const SQUAT = rig([165, 78], [154, 98], [129, 137],
  [[175, 99], [199, 99]], [[180, 102], [204, 102]],
  [[158, 142], [151, 176]], [[168, 143], [166, 176]]);
const SQUAT_TOP = rig([161, 41], [153, 62], [149, 111],
  [[175, 69], [199, 74]], [[179, 73], [203, 78]],
  [[145, 144], [151, 176]], [[159, 144], [166, 176]]);

function pullPose(id: string, up: boolean): Pose {
  const wide = id.includes("wide");
  const neutral = id.includes("neutral");
  const chin = id === "chin-up";
  const commando = id.includes("commando");
  const scapular = id.startsWith("scapular");
  const grip = wide ? 50 : neutral || chin ? 22 : 33;
  const x = commando && up ? 155 : 160;
  const rise = up ? (scapular ? 5 : 26) : 0;
  const s: Point = [x, 73 - rise];
  const hip: Point = [x, 116 - rise];
  return rig([x, 53 - rise], s, hip,
    [[160 - grip - (up && !scapular ? 7 : -6), 46 - rise * 0.1], [160 - grip, 24], [160 - grip, 20]],
    [[160 + grip + (up && !scapular ? 7 : -6), 46 - rise * 0.1], [160 + grip, 24], [160 + grip, 20]],
    [[x - 8, 145 - rise], [x - 12, 173 - rise], [x - 21, 174 - rise]],
    [[x + 8, 145 - rise], [x + 12, 173 - rise], [x + 21, 174 - rise]], { front: true });
}

function dipPose(chest: boolean, down: boolean): Pose {
  const drop = down ? 21 : 0;
  const lean = chest ? 9 : 0;
  return rig([160 + lean, 34 + drop], [153 + lean, 54 + drop], [151, 103 + drop],
    [[128, 77 + drop * 0.45], [137, 107], [142, 107]],
    [[171, 78 + drop * 0.45], [175, 107], [181, 107]],
    [[142, 132 + drop], [116, 144 + drop], [108, 139 + drop]],
    [[153, 135 + drop], [128, 148 + drop], [119, 144 + drop]]);
}

const SPLIT_TOP = rig([161, 40], [153, 61], [146, 110],
  [[170, 77], [175, 91]], [[175, 79], [180, 93]],
  [[119, 135], [94, 142], [86, 140]], [[172, 141], [176, 176]]);
const SPLIT_LOW = rig([164, 65], [155, 86], [143, 135],
  [[173, 97], [179, 89]], [[178, 101], [184, 93]],
  [[116, 161], [94, 142], [86, 140]], [[178, 146], [176, 176]]);
const PISTOL_TOP = rig([151, 43], [146, 64], [144, 111],
  [[169, 74], [194, 80]], [[173, 78], [198, 84]],
  [[173, 123], [204, 133]], [[158, 142], [156, 176]]);
const PISTOL_LOW = rig([150, 78], [142, 99], [124, 140],
  [[166, 105], [190, 109]], [[170, 109], [194, 113]],
  [[159, 137], [194, 134]], [[161, 144], [156, 176]]);
const SHRIMP_TOP = rig([162, 43], [154, 64], [149, 112],
  [[128, 84], [121, 110]], [[177, 79], [200, 85]],
  [[132, 144], [121, 110], [116, 104]], [[161, 143], [167, 176]]);
const SHRIMP_LOW = rig([161, 75], [150, 95], [136, 138],
  [[123, 104], [108, 127]], [[175, 105], [199, 109]],
  [[111, 163], [108, 127], [103, 121]], [[170, 145], [167, 176]]);

function hangPose(raise: "down" | "knees" | "toes"): Pose {
  const toes = raise === "toes";
  return rig(toes ? [136, 50] : [160, 50], toes ? [144, 71] : [151, 71], toes ? [177, 92] : [149, 114],
    [[153, 47], [161, 24], [160, 20]], [[168, 48], [175, 24], [174, 20]],
    raise === "down" ? [[149, 144], [145, 173]] : toes ? [[173, 60], [175, 30], [180, 23]] : [[180, 115], [176, 147]],
    raise === "down" ? [[161, 144], [156, 173]] : toes ? [[184, 63], [187, 32], [192, 25]] : [[190, 118], [186, 150]]);
}

const GLUTE_LOW = rig([86, 165], [105, 167], [153, 165],
  [[126, 172], [151, 175]], [[126, 175], [152, 178]],
  [[187, 134], [218, 146], [230, 146]], [[197, 137], [228, 148], [238, 148]]);
const GLUTE_HIGH = rig([86, 165], [105, 167], [151, 140],
  [[126, 172], [151, 175]], [[126, 175], [152, 178]],
  [[189, 130], [218, 146], [230, 146]], [[199, 133], [228, 148], [238, 148]]);
const WRIST_EXTENSOR = rig([142, 44], [140, 65], [140, 112],
  [[166, 72], [192, 74], [193, 85]], [[160, 99], [191, 87], [194, 81]],
  [[132, 144], [131, 176]], [[149, 144], [151, 176]]);
const WRIST_FLEXOR = rig([189, 88], [178, 108], [132, 130],
  [[170, 138], [166, 173], [157, 174]], [[183, 140], [180, 176], [170, 177]],
  [[122, 173], [92, 174], [83, 173]], [[133, 176], [105, 177], [96, 176]], { curve: [155, 120] });
const BALL_UP = rig([121, 111], [132, 129], [148, 161],
  [[153, 119], [174, 140]], [[157, 123], [179, 145]],
  [[175, 130], [177, 161]], [[185, 137], [183, 169]], { curve: [124, 153] });
const BALL_BACK = rig([115, 161], [134, 163], [162, 130],
  [[152, 144], [181, 152]], [[156, 148], [184, 158]],
  [[190, 145], [167, 172]], [[197, 149], [177, 175]], { curve: [159, 173] });
const PLOW = rig([113, 167], [133, 166], [153, 113],
  [[154, 174], [182, 176]], [[160, 177], [188, 179]],
  [[117, 118], [87, 159], [85, 175]], [[123, 119], [95, 161], [94, 178]], { curve: [157, 146] });
const BACK_LEG = rig([162, 41], [154, 62], [150, 111],
  [[175, 79], [197, 84]], [[180, 83], [201, 87]],
  [[123, 131], [94, 148], [93, 158]], [[150, 145], [150, 176]]);
const HAND_BRIDGE = rig([112, 141], [119, 123], [167, 116],
  [[99, 149], [90, 176], [81, 177]], [[109, 151], [101, 178], [92, 179]],
  [[197, 137], [208, 176]], [[208, 139], [221, 177]], { curve: [141, 96] });
const HEAD_BRIDGE = rig([104, 169], [119, 146], [164, 128],
  [[118, 167], [91, 176], [82, 177]], [[130, 170], [104, 178], [96, 179]],
  [[195, 143], [208, 176]], [[206, 146], [222, 177]], { curve: [137, 120] });
const REVERSE_PLANK = rig([105, 101], [120, 121], [166, 145],
  [[111, 148], [105, 175], [97, 177]], [[126, 150], [121, 177], [114, 179]],
  [[193, 159], [224, 175], [235, 173]], [[204, 164], [235, 178], [245, 176]]);
const CROW = rig([202, 124], [182, 132], [151, 113],
  [[169, 153], [179, 175], [190, 177]], [[180, 155], [191, 178], [202, 180]],
  [[171, 138], [135, 138], [129, 129]], [[182, 142], [146, 142], [139, 134]], { curve: [163, 107] });
const TRIPOD = rig([161, 169], [158, 149], [159, 108],
  [[130, 156], [137, 176], [148, 178]], [[184, 157], [182, 177], [192, 179]],
  [[151, 72], [149, 35], [156, 28]], [[166, 71], [166, 35], [174, 28]]);
const WALL_WALK = rig([151, 149], [165, 131], [187, 96],
  [[146, 153], [132, 176], [142, 178]], [[162, 155], [149, 178], [159, 180]],
  [[206, 69], [234, 44], [240, 38]], [[216, 77], [235, 52], [241, 45]]);

function locomotion(id: string, seconds: number): Pose {
  const walking = id.includes("walk");
  const high = id === "high-knees";
  const uphill = id === "fast-uphill-run";
  const stride = seconds * (walking ? 3.6 : id === "slow-run-zone-1" ? 5.5 : 7);
  const phase = (Math.sin(stride) + 1) / 2;
  const lift = walking ? 0 : Math.abs(Math.cos(stride)) * 4;
  const h: Point = [uphill ? 172 : 165, 43 - lift];
  const s: Point = [uphill ? 163 : 156, 64 - lift];
  const hip: Point = [151, 111 - lift];
  const forward: Leg = high ? [[185, 111], [181, 145], [192, 145]] : walking ? [[170, 143], [184, 176]] : [[178, 129], [172, 164]];
  const backward: Leg = walking ? [[137, 143], [119, 176]] : [[130, 139], [109, 118], [107, 108]];
  const armAhead: Arm = walking ? [[177, 86], [170, 109]] : [[177, 87], [190, 68]];
  const armBack: Arm = walking ? [[134, 85], [122, 106]] : [[132, 86], [150, 102]];
  const first = rig(h, s, hip, armBack, armAhead, forward, backward);
  const second = rig(h, s, hip, armAhead, armBack, backward, forward);
  const pose = between(first, second, phase);
  // In each passing step the recovery foot clears the floor.
  if (walking) {
    const liftFoot = Math.sin(phase * Math.PI) * 10;
    const key = Math.cos(stride) > 0 ? "nearLeg" : "farLeg";
    const chain = pose[key];
    const ankle: Point = [chain[2][0], chain[2][1] - liftFoot];
    const knee = joint(chain[0], ankle, [chain[1][0] + 8, chain[1][1]], 36, 35);
    pose[key] = [chain[0], knee, ankle, [chain[3][0], chain[3][1] - liftFoot]];
  }
  return pose;
}

function scene(exerciseId: string, seconds: number): Scene {
  const slow = (1 - Math.cos(seconds * Math.PI / 1.9)) / 2;
  const rep = (first: Pose, last: Pose, equipment: Equipment = "floor"): Scene => ({ pose: between(first, last, slow), equipment });
  if (exerciseId.startsWith("pull-up-") || exerciseId === "chin-up" || exerciseId.startsWith("scapular-pull-")) {
    return rep(pullPose(exerciseId, true), pullPose(exerciseId, false), exerciseId.includes("neutral") ? "neutral-bar" : "bar");
  }
  switch (exerciseId) {
    case "dip-tricep": return rep(dipPose(false, true), dipPose(false, false), "dip-bars");
    case "dip-chest": return rep(dipPose(true, true), dipPose(true, false), "dip-bars");
    case "squat-air": return rep(SQUAT, SQUAT_TOP);
    case "squat-bulgarian": return rep(SPLIT_LOW, SPLIT_TOP, "bench");
    case "squat-pistol": return rep(PISTOL_LOW, PISTOL_TOP);
    case "squat-shrimp": return rep(SHRIMP_LOW, SHRIMP_TOP);
    case "squat-jump": {
      const pose = between(SQUAT, SQUAT_TOP, slow);
      const lift = Math.max(0, slow - 0.76) / 0.24 * 19;
      const move = (p: Point): Point => [p[0], p[1] - lift];
      return { pose: { ...pose, head: move(pose.head), shoulder: move(pose.shoulder), hip: move(pose.hip), curve: move(pose.curve), farArm: pose.farArm.map(move) as unknown as Chain, nearArm: pose.nearArm.map(move) as unknown as Chain, farLeg: pose.farLeg.map(move) as unknown as Chain, nearLeg: pose.nearLeg.map(move) as unknown as Chain }, equipment: "floor" };
    }
    case "hanging-knee-raise": return rep(hangPose("knees"), hangPose("down"), "bar");
    case "toes-to-bar": return rep(hangPose("toes"), hangPose("down"), "bar");
    case "glute-bridge-elevated": return rep(GLUTE_HIGH, GLUTE_LOW, "step");
    case "wrist-extensor-stretch": return { pose: WRIST_EXTENSOR, equipment: "floor", still: true };
    case "wrist-flexor-stretch": return { pose: WRIST_FLEXOR, equipment: "mat", still: true };
    case "rolling-ball": return rep(BALL_UP, BALL_BACK, "mat");
    case "plow-stretch": return { pose: PLOW, equipment: "mat", still: true };
    case "standing-back-raise": return rep(BACK_LEG, STAND);
    case "hand-bridge": return { pose: HAND_BRIDGE, equipment: "mat", still: true };
    case "head-bridge": return { pose: HEAD_BRIDGE, equipment: "mat", still: true };
    case "reverse-plank": return { pose: REVERSE_PLANK, equipment: "mat", still: true };
    case "crow-hold": return { pose: CROW, equipment: "mat", still: true };
    case "tripod-headstand": return { pose: TRIPOD, equipment: "mat", still: true };
    case "wall-walk-hold": return { pose: WALL_WALK, equipment: "wall", still: true };
    case "slow-run-zone-1":
    case "fast-uphill-run":
    case "power-walk-downhill":
    case "slow-walk-zone-1":
    case "interval-run":
    case "high-knees": return { pose: locomotion(exerciseId, seconds), equipment: exerciseId === "fast-uphill-run" ? "uphill" : exerciseId === "power-walk-downhill" ? "downhill" : "floor" };
    default: return { pose: STAND, equipment: "floor", still: true };
  }
}

function stroke(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string, width: number) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function equipment(ctx: CanvasRenderingContext2D, type: Equipment) {
  const line = (points: readonly Point[], width = 2) => stroke(ctx, points, "#b8beb2", width);
  ctx.fillStyle = "rgba(75, 88, 65, 0.055)";
  ctx.beginPath();
  ctx.ellipse(160, 185, 82, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (type === "mat") {
    ctx.fillStyle = "#d2d8c9";
    ctx.beginPath();
    ctx.roundRect(66, 180, 190, 4, 2);
    ctx.fill();
  } else if (type === "uphill" || type === "downhill") {
    const slope = type === "uphill" ? -1 : 1;
    line([[68, 180 - slope * 9], [250, 180 + slope * 9]], 2);
    line([[79, 191], [244, 191]], 1);
  } else {
    line([[73, 181], [247, 181]], 1.4);
  }
  if (type === "bar" || type === "neutral-bar") {
    line([[97, 23], [223, 23]], 4);
    line([[97, 14], [97, 23]], 2);
    line([[223, 14], [223, 23]], 2);
    if (type === "neutral-bar") {
      line([[138, 20], [138, 30]], 4);
      line([[182, 20], [182, 30]], 4);
    }
  }
  if (type === "dip-bars") {
    line([[129, 181], [129, 108], [148, 108]], 4);
    line([[168, 181], [168, 108], [188, 108]], 4);
  }
  if (type === "bench") {
    ctx.fillStyle = "#c1c9bb";
    ctx.beginPath(); ctx.roundRect(71, 142, 39, 8, 2); ctx.fill();
    line([[77, 151], [77, 180]], 3); line([[105, 151], [105, 180]], 3);
  }
  if (type === "step") {
    ctx.fillStyle = "#c1c9bb";
    ctx.beginPath(); ctx.roundRect(215, 151, 33, 28, [3, 3, 0, 0]); ctx.fill();
    line([[215, 151], [248, 151]], 3);
  }
  if (type === "wall") {
    line([[244, 29], [244, 181]], 3);
    for (let y = 39; y < 179; y += 13) line([[245, y], [252, y - 6]], 1);
  }
}

function limb(ctx: CanvasRenderingContext2D, chain: Chain, leg: boolean, far: boolean) {
  const skin = far ? "#ba9174" : "#d2a584";
  const shade = far ? "#ae846a" : "#c49777";
  // Tapered upper and lower limbs, with skin-colored joints rather than markers.
  stroke(ctx, [chain[0], chain[1]], skin, leg ? 11.5 : 8.3);
  stroke(ctx, [chain[1], chain[2]], skin, leg ? 8.3 : 6.8);
  stroke(ctx, [point(chain[1], chain[2], 0.13), point(chain[1], chain[2], 0.82)], shade, leg ? 1.5 : 1);
  if (leg) {
    stroke(ctx, [chain[0], point(chain[0], chain[1], 0.47)], far ? "#344a3f" : "#293f35", 15);
    // Low-profile training shoes: separate ankle, heel, and toe silhouette.
    const ankle = chain[2];
    const toe = chain[3];
    const heel = point(toe, ankle, 1.3);
    stroke(ctx, [heel, toe], far ? "#687168" : "#38483d", 6);
    stroke(ctx, [[heel[0], heel[1] + 2.7], [toe[0], toe[1] + 2.7]], "#e4e7dc", 1.5);
  } else {
    const wrist = chain[2];
    const fingers = chain[3];
    stroke(ctx, [wrist, fingers], skin, 5);
    const mid = point(wrist, fingers, 0.45);
    const angle = Math.atan2(fingers[1] - wrist[1], fingers[0] - wrist[0]);
    stroke(ctx, [mid, [mid[0] - Math.sin(angle) * 3, mid[1] + Math.cos(angle) * 3]], skin, 2.5);
  }
}

function torso(ctx: CanvasRenderingContext2D, pose: Pose) {
  const { shoulder: s, hip: h, curve: c } = pose;
  const d = distance(s, h) || 1;
  const nx = -(h[1] - s[1]) / d;
  const ny = (h[0] - s[0]) / d;
  const shoulderWidth = pose.front ? 16 : 12;
  const waistWidth = pose.front ? 11 : 9;
  ctx.beginPath();
  ctx.moveTo(s[0] + nx * shoulderWidth, s[1] + ny * shoulderWidth);
  ctx.quadraticCurveTo(c[0] + nx * 12, c[1] + ny * 12, h[0] + nx * waistWidth, h[1] + ny * waistWidth);
  ctx.quadraticCurveTo(h[0], h[1] + 4, h[0] - nx * waistWidth, h[1] - ny * waistWidth);
  ctx.quadraticCurveTo(c[0] - nx * 12, c[1] - ny * 12, s[0] - nx * shoulderWidth, s[1] - ny * shoulderWidth);
  ctx.quadraticCurveTo(s[0] - (h[0] - s[0]) * 0.11, s[1] - (h[1] - s[1]) * 0.11, s[0] + nx * shoulderWidth, s[1] + ny * shoulderWidth);
  const fill = ctx.createLinearGradient(s[0] - 15, s[1], s[0] + 17, h[1]);
  fill.addColorStop(0, "#899a7c"); fill.addColorStop(1, "#647c61");
  ctx.fillStyle = fill; ctx.fill();
  // Hem and shorts make the direction of the hips clear even in inversions.
  stroke(ctx, [[h[0] + nx * waistWidth, h[1] + ny * waistWidth], [h[0] - nx * waistWidth, h[1] - ny * waistWidth]], "#2f453a", 8);
  ctx.strokeStyle = "rgba(43, 66, 49, 0.17)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s[0] + nx * 8, s[1] + ny * 8);
  ctx.quadraticCurveTo(c[0] + nx * 7, c[1] + ny * 7, h[0] + nx * 5, h[1] + ny * 5);
  ctx.stroke();
}

function head(ctx: CanvasRenderingContext2D, pose: Pose) {
  const { head: h, shoulder: s, front } = pose;
  const neck = point(s, h, 0.52);
  stroke(ctx, [s, neck, h], "#c69b7b", 7.5);
  const angle = Math.atan2(h[1] - s[1], h[0] - s[0]) + Math.PI / 2;
  ctx.save();
  ctx.translate(h[0], h[1]); ctx.rotate(front ? 0 : angle);
  ctx.fillStyle = "#d2a584";
  ctx.beginPath(); ctx.ellipse(0, 0, front ? 8 : 7.5, 10, 0, 0, Math.PI * 2); ctx.fill();
  if (!front) {
    ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(10, 1); ctx.lineTo(6, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ba8c6d";
    ctx.beginPath(); ctx.ellipse(-3, 2, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#344039";
  ctx.beginPath();
  ctx.moveTo(-7.5, 1); ctx.bezierCurveTo(-11, -10, -2, -13, 5, -9);
  ctx.quadraticCurveTo(9, -7, 7, -4); ctx.quadraticCurveTo(1, -7, -4, -3);
  ctx.lineTo(-5, 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#54463a";
  if (front) {
    ctx.fillRect(-3.8, -0.8, 1.2, 1.2); ctx.fillRect(2.6, -0.8, 1.2, 1.2);
  } else {
    ctx.beginPath(); ctx.arc(5.7, -1.3, 0.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function paint(ctx: CanvasRenderingContext2D, width: number, height: number, current: Scene) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  const scale = Math.min(width / 320, height / 200);
  ctx.translate((width - 320 * scale) / 2, (height - 200 * scale) / 2);
  ctx.scale(scale, scale);
  equipment(ctx, current.equipment);
  const p = current.pose;
  limb(ctx, p.farLeg, true, true);
  limb(ctx, p.farArm, false, true);
  limb(ctx, p.nearLeg, true, false);
  torso(ctx, p);
  head(ctx, p);
  // A short sleeve hides the anatomical shoulder join.
  stroke(ctx, [p.nearArm[0], point(p.nearArm[0], p.nearArm[1], 0.24)], "#728967", 11);
  limb(ctx, [point(p.nearArm[0], p.nearArm[1], 0.18), p.nearArm[1], p.nearArm[2], p.nearArm[3]], false, false);
  ctx.restore();
}

/** Decorative pose diagram. The parent supplies the movement name and cues. */
export function MovementPreview({ exerciseId, playing = false, className = "", size = "card" }: MovementPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let frameId = 0;
    let last = 0;
    let elapsed = 0;
    let width = 0;
    let height = 0;
    let disposed = false;
    const isStill = scene(exerciseId, 0).still;

    const draw = () => {
      if (width && height) paint(context, width, height, scene(exerciseId, elapsed / 1000));
    };
    const canAnimate = () => playing && visible && !media.matches && !document.hidden && !isStill && !disposed;
    const tick = (now: number) => {
      frameId = 0;
      if (!canAnimate()) { last = 0; return; }
      if (last) elapsed += Math.min(now - last, 50);
      last = now;
      draw();
      frameId = window.requestAnimationFrame(tick);
    };
    const sync = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      last = 0;
      if (media.matches) elapsed = 0;
      draw();
      if (canAnimate()) frameId = window.requestAnimationFrame(tick);
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { threshold: 0.01 });
    const resizer = new ResizeObserver(resize);
    observer.observe(canvas);
    resizer.observe(canvas);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    resize();
    return () => {
      disposed = true;
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
      resizer.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [exerciseId, playing]);

  return <canvas ref={canvasRef} className={`movement-preview ${className}`.trim()} data-size={size} data-exercise={exerciseId} aria-hidden="true" style={{ display: "block", width: "100%", height: "auto", aspectRatio: "8 / 5" }} />;
}

export default MovementPreview;
