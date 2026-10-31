/**
 * Kinesiological models and inverse kinematics for natural human movement.
 * Defines joint chains, anatomical landmark rigs, and interpolation curves.
 */

export type Point = readonly [number, number];
export type Chain = readonly [Point, Point, Point, Point];
export type Arm = readonly [Point, Point, Point?];
export type Leg = readonly [Point, Point, Point?];

export type Pose = {
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

export type Equipment =
  | "floor"
  | "bar"
  | "neutral-bar"
  | "dip-bars"
  | "bench"
  | "step"
  | "wall"
  | "uphill"
  | "downhill"
  | "mat";

export type Scene = {
  pose: Pose;
  equipment: Equipment;
  still?: boolean;
};

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export const point = (a: Point, b: Point, t: number): Point => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
export const distance = (a: Point, b: Point): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function extend(a: Point, b: Point, length: number): Point {
  const d = distance(a, b) || 1;
  return [b[0] + ((b[0] - a[0]) * length) / d, b[1] + ((b[1] - a[1]) * length) / d];
}

export function rig(
  head: Point,
  shoulder: Point,
  hip: Point,
  farArm: Arm,
  nearArm: Arm,
  farLeg: Leg,
  nearLeg: Leg,
  options: { front?: boolean; curve?: Point } = {},
): Pose {
  const front = options.front ?? false;
  const arm = (parts: Arm, offset: number): Chain => [
    [shoulder[0] + offset, shoulder[1]],
    parts[0],
    parts[1],
    parts[2] ?? extend(parts[0], parts[1], 5),
  ];
  const leg = (parts: Leg, offset: number): Chain => [
    [hip[0] + offset, hip[1]],
    parts[0],
    parts[1],
    parts[2] ?? [parts[1][0] + 10, parts[1][1] + 1],
  ];
  return {
    head,
    shoulder,
    hip,
    front,
    curve: options.curve ?? point(shoulder, hip, 0.55),
    farArm: arm(farArm, front ? -12 : -2),
    nearArm: arm(nearArm, front ? 12 : 2),
    farLeg: leg(farLeg, front ? -7 : -2),
    nearLeg: leg(nearLeg, front ? 7 : 2),
  };
}

// Anatomical joint solver: maintains limb segment lengths while tracking kinematics
export function joint(start: Point, target: Point, hint: Point, upper: number, lower: number): Point {
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

export function between(a: Pose, b: Pose, t: number): Pose {
  const limb = (first: Chain, last: Chain): Chain => [
    point(first[0], last[0], t),
    point(first[1], last[1], t),
    point(first[2], last[2], t),
    point(first[3], last[3], t),
  ];
  return {
    head: point(a.head, b.head, t),
    shoulder: point(a.shoulder, b.shoulder, t),
    hip: point(a.hip, b.hip, t),
    curve: point(a.curve, b.curve, t),
    front: a.front,
    farArm: limb(a.farArm, b.farArm),
    nearArm: limb(a.nearArm, b.nearArm),
    farLeg: limb(a.farLeg, b.farLeg),
    nearLeg: limb(a.nearLeg, b.nearLeg),
  };
}

export const STAND = rig(
  [161, 41],
  [153, 62],
  [149, 111],
  [[143, 87], [148, 110]],
  [[165, 86], [174, 108]],
  [[143, 144], [142, 176]],
  [[156, 144], [158, 176]],
);

export const SQUAT = rig(
  [165, 78],
  [154, 98],
  [129, 137],
  [[175, 99], [199, 99]],
  [[180, 102], [204, 102]],
  [[158, 142], [151, 176]],
  [[168, 143], [166, 176]],
);

export const SQUAT_TOP = rig(
  [161, 41],
  [153, 62],
  [149, 111],
  [[175, 69], [199, 74]],
  [[179, 73], [203, 78]],
  [[145, 144], [151, 176]],
  [[159, 144], [166, 176]],
);

const JUMP_AIR = rig(
  [161, 26],
  [153, 48],
  [149, 101],
  [[139, 63], [126, 78], [122, 84]],
  [[165, 64], [178, 79], [182, 85]],
  [[143, 126], [137, 151], [136, 157]],
  [[157, 126], [163, 151], [168, 155]],
);

export function pullPose(id: string, up: boolean, side = 1): Pose {
  const wide = id.includes("wide");
  const neutral = id.includes("neutral");
  const chin = id === "chin-up";
  const commando = id.includes("commando");
  const scapular = id.startsWith("scapular");
  const grip = commando ? 5 : wide ? 50 : neutral || chin ? 22 : 33;
  const x = commando && up ? 160 + side * 5 : 160;
  const rise = up ? (scapular ? 5 : 26) : 0;
  const s: Point = [x, 73 - rise];
  const hip: Point = [x, 116 - rise];
  return rig(
    [x, 53 - rise],
    s,
    hip,
    [[160 - grip - (up && !scapular ? 7 : -6), 46 - rise * 0.1], [160 - grip, 24], [160 - grip, 20]],
    [[160 + grip + (up && !scapular ? 7 : -6), 46 - rise * 0.1], [160 + grip, 24], [160 + grip, 20]],
    [[x - 8, 145 - rise], [x - 12, 173 - rise], [x - 21, 174 - rise]],
    [[x + 8, 145 - rise], [x + 12, 173 - rise], [x + 21, 174 - rise]],
    { front: true },
  );
}

export function dipPose(chest: boolean, down: boolean): Pose {
  const drop = down ? 21 : 0;
  const lean = chest ? 9 : 0;
  return rig(
    [160 + lean, 34 + drop],
    [153 + lean, 54 + drop],
    [151, 103 + drop],
    [[128, 77 + drop * 0.45], [137, 107], [142, 107]],
    [[171, 78 + drop * 0.45], [175, 107], [181, 107]],
    [[142, 132 + drop], [116, 144 + drop], [108, 139 + drop]],
    [[153, 135 + drop], [128, 148 + drop], [119, 144 + drop]],
  );
}

export const SPLIT_TOP = rig(
  [161, 40],
  [153, 61],
  [146, 110],
  [[170, 77], [175, 91]],
  [[175, 79], [180, 93]],
  [[119, 135], [94, 142], [86, 140]],
  [[172, 141], [176, 176]],
);

export const SPLIT_LOW = rig(
  [164, 65],
  [155, 86],
  [143, 135],
  [[173, 97], [179, 89]],
  [[178, 101], [184, 93]],
  [[116, 161], [94, 142], [86, 140]],
  [[178, 146], [176, 176]],
);

export const PISTOL_TOP = rig(
  [151, 43],
  [146, 64],
  [144, 111],
  [[169, 74], [194, 80]],
  [[173, 78], [198, 84]],
  [[173, 123], [204, 133]],
  [[158, 142], [156, 176]],
);

export const PISTOL_LOW = rig(
  [150, 78],
  [142, 99],
  [124, 140],
  [[166, 105], [190, 109]],
  [[170, 109], [194, 113]],
  [[159, 137], [194, 134]],
  [[161, 144], [156, 176]],
);

export const SHRIMP_TOP = rig(
  [174, 42],
  [164, 63],
  [160, 111],
  [[175, 83], [188, 75]],
  [[183, 105], [205, 101]],
  [[130, 137], [111, 145], [104, 143]],
  [[165, 144], [166, 176]],
);

export const SHRIMP_LOW = rig(
  [179, 79],
  [165, 98],
  [151, 137],
  [[177, 111], [189, 119]],
  [[185, 128], [207, 128]],
  [[108, 160], [93, 140], [87, 132]],
  [[162, 144], [166, 176]],
);

export function hangPose(raise: "down" | "knees" | "toes"): Pose {
  const toes = raise === "toes";
  return rig(
    [160, 50],
    [151, 71],
    [149, 114],
    [[153, 47], [161, 24], [160, 20]],
    [[168, 48], [175, 24], [174, 20]],
    raise === "down" ? [[149, 144], [145, 173]] : toes ? [[153, 88], [160, 43], [160, 29]] : [[150, 84], [168, 98], [178, 104]],
    raise === "down" ? [[161, 144], [156, 173]] : toes ? [[166, 87], [168, 43], [168, 29]] : [[163, 82], [180, 95], [190, 102]],
  );
}

export const GLUTE_LOW = rig(
  [86, 165],
  [105, 167],
  [153, 165],
  [[126, 172], [151, 175]],
  [[126, 175], [152, 178]],
  [[187, 134], [218, 146], [230, 146]],
  [[197, 137], [228, 148], [238, 148]],
);

export const GLUTE_HIGH = rig(
  [86, 165],
  [105, 167],
  [151, 140],
  [[126, 172], [151, 175]],
  [[126, 175], [152, 178]],
  [[189, 130], [218, 146], [230, 146]],
  [[199, 133], [228, 148], [238, 148]],
);

export const WRIST_EXTENSOR = rig(
  [142, 44],
  [140, 65],
  [140, 112],
  [[166, 72], [192, 74], [193, 85]],
  [[160, 99], [191, 87], [194, 81]],
  [[132, 144], [131, 176]],
  [[149, 144], [151, 176]],
);

export const WRIST_FLEXOR = rig(
  [189, 88],
  [178, 108],
  [132, 130],
  [[170, 138], [166, 173], [157, 174]],
  [[183, 140], [180, 176], [170, 177]],
  [[122, 173], [92, 174], [83, 173]],
  [[133, 176], [105, 177], [96, 176]],
  { curve: [155, 120] },
);

const ROLL_TUCK = rig(
  [115, 120],
  [136, 111],
  [158, 126],
  [[139, 91], [157, 76], [163, 72]],
  [[148, 95], [167, 81], [173, 77]],
  [[172, 102], [153, 85], [148, 80]],
  [[179, 105], [161, 89], [156, 84]],
  { curve: [145, 117] },
);

export const PLOW = rig(
  [113, 167],
  [133, 166],
  [153, 113],
  [[154, 174], [182, 176]],
  [[160, 177], [188, 179]],
  [[117, 118], [87, 159], [85, 175]],
  [[123, 119], [95, 161], [94, 178]],
  { curve: [157, 146] },
);

const T_BALANCE = rig(
  [184, 43], [160, 65], [124, 72],
  [[185, 60], [211, 57]], [[190, 65], [217, 62]],
  [[87, 71], [58, 70], [49, 69]], [[123, 111], [127, 159], [136, 166]],
  { curve: [142, 66] },
);

function rotatePointAround(pointToRotate: Point, pivot: Point, angle: number): Point {
  const dx = pointToRotate[0] - pivot[0];
  const dy = pointToRotate[1] - pivot[1];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [pivot[0] + dx * cos - dy * sin, pivot[1] + dx * sin + dy * cos];
}

function rotatePose(pose: Pose, pivot: Point, angle: number): Pose {
  const chain = (limb: Chain): Chain => limb.map((p) => rotatePointAround(p, pivot, angle)) as unknown as Chain;
  return {
    ...pose,
    head: rotatePointAround(pose.head, pivot, angle),
    shoulder: rotatePointAround(pose.shoulder, pivot, angle),
    hip: rotatePointAround(pose.hip, pivot, angle),
    curve: rotatePointAround(pose.curve, pivot, angle),
    farArm: chain(pose.farArm),
    nearArm: chain(pose.nearArm),
    farLeg: chain(pose.farLeg),
    nearLeg: chain(pose.nearLeg),
  };
}

function rollingPose(seconds: number): Pose {
  // Rock the compact tuck through a small arc while keeping the silhouette intact.
  const rockingAngle = -0.28 * Math.cos((seconds * Math.PI) / 1.9);
  const rotated = rotatePose(ROLL_TUCK, [151, 112], rockingAngle);
  const lift = 5 * Math.abs(Math.sin((seconds * Math.PI) / 1.9));
  const shift = (pose: Pose): Pose => ({
    ...pose,
    head: [pose.head[0], pose.head[1] + lift],
    shoulder: [pose.shoulder[0], pose.shoulder[1] + lift],
    hip: [pose.hip[0], pose.hip[1] + lift],
    curve: [pose.curve[0], pose.curve[1] + lift],
    farArm: pose.farArm.map(([x, y]) => [x, y + lift]) as unknown as Chain,
    nearArm: pose.nearArm.map(([x, y]) => [x, y + lift]) as unknown as Chain,
    farLeg: pose.farLeg.map(([x, y]) => [x, y + lift]) as unknown as Chain,
    nearLeg: pose.nearLeg.map(([x, y]) => [x, y + lift]) as unknown as Chain,
  });
  return shift(rotated);
}

function highKneePose(seconds: number): Pose {
  const stride = seconds * 7.2;
  const alternatingDrive = Math.sin(stride);
  const easeDrive = (value: number) => {
    const t = Math.max(0, value);
    return t * t * (3 - 2 * t);
  };
  const nearDrive = easeDrive(alternatingDrive);
  const farDrive = easeDrive(-alternatingDrive);
  const bounce = Math.max(nearDrive, farDrive) * 2.2;
  const weightShift = (farDrive - nearDrive) * 3.5;
  const head: Point = [165 + weightShift, 42 - bounce];
  const shoulder: Point = [156 + weightShift, 63 - bounce];
  const hip: Point = [151 + weightShift, 111 - bounce];

  const makeLeg = (start: Point, drive: number, side: -1 | 1): Chain => {
    const ankle = point(
      [start[0] - side * 7, hip[1] + 63],
      [start[0] + 23, hip[1] + 3],
      drive,
    );
    const hint = point(
      [start[0] + 12, hip[1] + 34],
      [start[0] + 12, hip[1] - 34],
      drive,
    );
    const knee = joint(start, ankle, hint, 37, 36);
    return [start, knee, ankle, [ankle[0] + 10, ankle[1] + 2]];
  };

  const makeArm = (start: Point, pump: number, side: -1 | 1): Chain => {
    const wrist = point(
      [start[0] - 11 + side * 2, start[1] + 33],
      [start[0] + 24, start[1] - 12],
      pump,
    );
    const elbowHint = point(
      [start[0] - 18 + side * 2, start[1] + 14],
      [start[0] + 20, start[1] + 13],
      pump,
    );
    const elbow = joint(start, wrist, elbowHint, 26, 25);
    return [start, elbow, wrist, [wrist[0] + 4, wrist[1] - 3]];
  };

  const pose = rig(
    head,
    shoulder,
    hip,
    [[shoulder[0] - 22, shoulder[1] + 16], [shoulder[0] - 8, shoulder[1] + 33]],
    [[shoulder[0] + 22, shoulder[1] + 16], [shoulder[0] + 8, shoulder[1] + 33]],
    [[hip[0] - 17, hip[1] + 32], [hip[0] - 10, hip[1] + 63]],
    [[hip[0] + 17, hip[1] + 32], [hip[0] + 10, hip[1] + 63]],
  );
  pose.farLeg = makeLeg(pose.farLeg[0], farDrive, -1);
  pose.nearLeg = makeLeg(pose.nearLeg[0], nearDrive, 1);
  pose.farArm = makeArm(pose.farArm[0], nearDrive, -1);
  pose.nearArm = makeArm(pose.nearArm[0], farDrive, 1);
  return pose;
}

function breathe(pose: Pose, seconds: number): Pose {
  const amount = Math.sin((seconds * Math.PI * 2) / 3.8) * 1.1;
  const lift = (p: Point): Point => [p[0], p[1] - amount];
  const arm = (chain: Chain): Chain => [lift(chain[0]), lift(chain[1]), chain[2], chain[3]];
  return {
    ...pose,
    head: lift(pose.head),
    shoulder: lift(pose.shoulder),
    curve: lift(pose.curve),
    farArm: arm(pose.farArm),
    nearArm: arm(pose.nearArm),
  };
}

export const HAND_BRIDGE = rig(
  [112, 141],
  [119, 123],
  [167, 116],
  [[99, 149], [90, 176], [81, 177]],
  [[109, 151], [101, 178], [92, 179]],
  [[197, 137], [208, 176]],
  [[208, 139], [221, 177]],
  { curve: [141, 96] },
);

export const HEAD_BRIDGE = rig(
  [104, 169],
  [119, 146],
  [164, 128],
  [[118, 167], [91, 176], [82, 177]],
  [[130, 170], [104, 178], [96, 179]],
  [[195, 143], [208, 176]],
  [[206, 146], [222, 177]],
  { curve: [137, 120] },
);

export const REVERSE_PLANK = rig(
  [105, 101],
  [120, 121],
  [166, 145],
  [[111, 148], [105, 175], [97, 177]],
  [[126, 150], [121, 177], [114, 179]],
  [[193, 159], [224, 175], [235, 173]],
  [[204, 164], [235, 178], [245, 176]],
);

export const CROW = rig(
  [202, 124],
  [182, 132],
  [151, 113],
  [[169, 153], [179, 175], [190, 177]],
  [[180, 155], [191, 178], [202, 180]],
  [[171, 138], [135, 138], [129, 129]],
  [[182, 142], [146, 142], [139, 134]],
  { curve: [163, 107] },
);

export const TRIPOD = rig(
  [161, 169],
  [158, 149],
  [159, 108],
  [[130, 156], [137, 176], [148, 178]],
  [[184, 157], [182, 177], [192, 179]],
  [[151, 72], [149, 35], [156, 28]],
  [[166, 71], [166, 35], [174, 28]],
);

export const WALL_WALK = rig(
  [151, 149],
  [165, 131],
  [187, 96],
  [[146, 153], [132, 176], [142, 178]],
  [[162, 155], [149, 178], [159, 180]],
  [[206, 69], [234, 44], [240, 38]],
  [[216, 77], [235, 52], [241, 45]],
);

export function locomotion(id: string, seconds: number): Pose {
  const walking = id.includes("walk");
  const high = id === "high-knees";
  if (high) return highKneePose(seconds);
  const uphill = id === "fast-uphill-run";
  const stride = seconds * (walking ? 3.6 : high ? 7.5 : id === "slow-run-zone-1" ? 5.5 : 7);
  const phase = (Math.sin(stride) + 1) / 2;
  const lift = walking ? 0 : Math.abs(Math.cos(stride)) * (high ? 2.5 : 4);
  const h: Point = [uphill ? 172 : 165, 43 - lift];
  const s: Point = [uphill ? 163 : 156, 64 - lift];
  const hip: Point = [151, 111 - lift];
  const forward: Leg = high
    ? [[177, 79], [190, 99], [199, 101]]
    : walking
      ? [[170, 143], [184, 176]]
      : [[178, 129], [172, 164]];
  const backward: Leg = high
    ? [[130, 139], [137, 169], [149, 176]]
    : walking
      ? [[137, 143], [119, 176]]
    : [[130, 139], [109, 118], [107, 108]];
  const armAhead: Arm = walking ? [[177, 86], [170, 109]] : high ? [[176, 78], [187, 64]] : [[177, 87], [190, 68]];
  const armBack: Arm = walking ? [[134, 85], [122, 106]] : high ? [[132, 87], [145, 105]] : [[132, 86], [150, 102]];
  const first = rig(h, s, hip, armBack, armAhead, forward, backward);
  const second = rig(h, s, hip, armAhead, armBack, backward, forward);
  const pose = between(first, second, phase);
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

export const MOTION_MAP: Record<string, string> = {
  pull: "pull-up-pronated",
  push: "dip-tricep",
  squat: "squat-air",
  jump: "squat-jump",
  core: "hanging-knee-raise",
  bridge: "glute-bridge-elevated",
  stretch: "wrist-flexor-stretch",
  roll: "rolling-ball",
  fold: "plow-stretch",
  balance: "crow-hold",
  hold: "reverse-plank",
  run: "slow-run-zone-1",
  walk: "slow-walk-zone-1",
  stand: "squat-air",
};

export function resolveExerciseKey(exerciseId?: string, motion?: string): string {
  if (exerciseId) return exerciseId;
  if (motion && MOTION_MAP[motion]) return MOTION_MAP[motion];
  return "squat-air";
}

export function scene(idOrMotion: string, seconds: number): Scene {
  const exerciseId = MOTION_MAP[idOrMotion] || idOrMotion;
  const slow = (1 - Math.cos((seconds * Math.PI) / 1.9)) / 2;
  const rep = (first: Pose, last: Pose, equipment: Equipment = "floor"): Scene => ({
    pose: between(first, last, slow),
    equipment,
  });

  const phase = Math.max(0, Math.min(1, slow));
  const jumpScene = (): Scene => {
    const jumpPhase = (1 - Math.cos((seconds * Math.PI) / 2.5)) / 2;
    if (jumpPhase < 0.2) return { pose: between(STAND, SQUAT, jumpPhase / 0.2), equipment: "floor" };
    if (jumpPhase < 0.58) return { pose: between(SQUAT, JUMP_AIR, (jumpPhase - 0.2) / 0.38), equipment: "floor" };
    if (jumpPhase < 0.72) return { pose: JUMP_AIR, equipment: "floor" };
    if (jumpPhase < 0.9) return { pose: between(JUMP_AIR, SQUAT, (jumpPhase - 0.72) / 0.18), equipment: "floor" };
    return { pose: between(SQUAT, STAND, (jumpPhase - 0.9) / 0.1), equipment: "floor" };
  };

  if (
    exerciseId.startsWith("pull-up-") ||
    exerciseId === "chin-up" ||
    exerciseId.startsWith("scapular-pull-")
  ) {
    if (exerciseId.includes("commando")) {
      const side = Math.floor(seconds / 3.8) % 2 === 0 ? 1 : -1;
      return rep(pullPose(exerciseId, false, side), pullPose(exerciseId, true, side), "bar");
    }
    return rep(
      pullPose(exerciseId, true),
      pullPose(exerciseId, false),
      exerciseId.includes("neutral") ? "neutral-bar" : "bar",
    );
  }

  switch (exerciseId) {
    case "dip-tricep":
      return rep(dipPose(false, true), dipPose(false, false), "dip-bars");
    case "dip-chest":
      return rep(dipPose(true, true), dipPose(true, false), "dip-bars");
    case "squat-air":
      return rep(SQUAT, SQUAT_TOP);
    case "squat-bulgarian":
      return rep(SPLIT_LOW, SPLIT_TOP, "bench");
    case "squat-pistol":
      return rep(PISTOL_LOW, PISTOL_TOP);
    case "squat-shrimp":
      return rep(SHRIMP_LOW, SHRIMP_TOP);
    case "squat-jump": {
      return jumpScene();
    }
    case "hanging-knee-raise":
      return rep(hangPose("knees"), hangPose("down"), "bar");
    case "toes-to-bar":
      return rep(hangPose("toes"), hangPose("down"), "bar");
    case "glute-bridge-elevated":
      return rep(GLUTE_HIGH, GLUTE_LOW, "step");
    case "wrist-extensor-stretch":
      return { pose: WRIST_EXTENSOR, equipment: "floor", still: true };
    case "wrist-flexor-stretch":
      return { pose: WRIST_FLEXOR, equipment: "mat", still: true };
    case "rolling-ball":
      return { pose: rollingPose(seconds), equipment: "mat" };
    case "plow-stretch":
      return { pose: PLOW, equipment: "mat", still: true };
    case "standing-back-raise":
      return rep(STAND, T_BALANCE);
    case "hand-bridge":
      return { pose: breathe(HAND_BRIDGE, seconds), equipment: "mat" };
    case "head-bridge":
      return { pose: HEAD_BRIDGE, equipment: "mat", still: true };
    case "reverse-plank":
      return { pose: breathe(REVERSE_PLANK, seconds), equipment: "mat" };
    case "crow-hold":
      return { pose: breathe(CROW, seconds), equipment: "mat" };
    case "tripod-headstand":
      return { pose: TRIPOD, equipment: "mat", still: true };
    case "wall-walk-hold":
      return { pose: breathe(WALL_WALK, seconds), equipment: "wall" };
    case "slow-run-zone-1":
    case "fast-uphill-run":
    case "power-walk-downhill":
    case "slow-walk-zone-1":
    case "interval-run":
    case "high-knees":
      return {
        pose: locomotion(exerciseId, seconds),
        equipment:
          exerciseId === "fast-uphill-run"
            ? "uphill"
            : exerciseId === "power-walk-downhill"
              ? "downhill"
              : "floor",
      };
    default:
      return { pose: STAND, equipment: "floor", still: true };
  }
}
