import assert from "node:assert/strict";
import test from "node:test";
import { scene } from "../app/components/movement-kinematics.ts";

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test("jump squat uses one air-squat load and jump cycle", () => {
  const startingSquat = scene("squat-jump", 0).pose;
  const squat = scene("squat-jump", 2.25).pose;
  const airborne = scene("squat-jump", 1.25).pose;

  const nextCycle = scene("squat-jump", 2.5).pose;
  assert.ok(distance(nextCycle.head, startingSquat.head) < 0.01, "lands back in the same squat after one cycle");
  assert.ok(Math.abs(squat.hip[1] - startingSquat.hip[1]) < 0.01, "holds the squat after landing without standing");
  assert.ok(airborne.head[1] < startingSquat.head[1] - 10, "one jump rises from the squat");
});

test("shrimp squat keeps one hand at the lifted foot and the other reaching forward", () => {
  for (const seconds of [0, 0.25, 0.5, 0.95, 1.4, 1.9]) {
    const pose = scene("squat-shrimp", seconds).pose;
    assert.ok(distance(pose.nearArm[3], pose.nearLeg[3]) < 3, `hand leaves foot at ${seconds}s`);
    assert.ok(pose.farArm[3][0] > pose.shoulder[0] + 30, `free hand stops reaching forward at ${seconds}s`);
  }
});

test("rolling like a ball stays tucked with hands clasping the shins", () => {
  for (const seconds of [0, 0.475, 0.95, 1.425, 1.9]) {
    const pose = scene("rolling-ball", seconds).pose;
    assert.ok(distance(pose.nearArm[3], pose.nearLeg[1]) < 15, `near hand leaves shin at ${seconds}s`);
    assert.ok(distance(pose.farArm[3], pose.farLeg[1]) < 15, `far hand leaves shin at ${seconds}s`);
    assert.ok(distance(pose.head, pose.shoulder) < 30, `head leaves the tucked shape at ${seconds}s`);
  }
  assert.ok(scene("rolling-ball", 0).pose.hip[1] > 150, "original tuck is lowered toward the mat");
});

test("standing back leg raise restores its original lean with a planted, proportional support leg", () => {
  const start = scene("standing-back-raise", 0).pose;
  const pose = scene("standing-back-raise", 1.9).pose;
  assert.deepEqual(pose.head, [216, 57]);
  assert.deepEqual(pose.shoulder, [192, 79]);
  assert.deepEqual(pose.hip, [156, 86]);
  assert.deepEqual(pose.farLeg[1], [119, 85]);
  assert.equal(pose.nearLeg[3][0], start.nearLeg[3][0], "support foot stays in the same horizontal position");
  assert.ok(pose.nearLeg[3][1] >= 178, "support foot stays grounded");
  assert.ok(Math.abs(distance(pose.nearLeg[0], pose.nearLeg[1]) - 39) < 1, "upper support leg keeps its original length");
  assert.ok(Math.abs(distance(pose.nearLeg[1], pose.nearLeg[2]) - 48) < 1, "lower support leg keeps its original length");
});

test("high-knee run alternates one raised knee with a grounded support foot", () => {
  const pose = scene("high-knees", 0.2).pose;
  assert.ok(pose.nearLeg[1][1] < pose.hip[1] - 20, "driving knee rises above the hip");
  assert.ok(pose.farLeg[2][1] > 160, "support foot stays near the floor");
  for (const arm of [pose.nearArm, pose.farArm]) {
    assert.ok(arm[3][1] > pose.shoulder[1], "hand stays below shoulder height");
    assert.ok(arm[3][1] < pose.hip[1], "hand pumps near the torso");
  }
});
