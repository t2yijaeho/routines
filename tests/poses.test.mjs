import assert from "node:assert/strict";
import test from "node:test";
import { scene } from "../app/components/movement-kinematics.ts";

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test("jump squat swings both arms back when upright and forward in the squat", () => {
  const standing = scene("squat-jump", 0).pose;
  const squat = scene("squat-jump", 5 / 6).pose;
  const airborne = scene("squat-jump", 1.49).pose;

  for (const pose of [standing, airborne]) {
    assert.ok(pose.farArm[3][0] < pose.shoulder[0]);
    assert.ok(pose.nearArm[3][0] < pose.shoulder[0]);
  }
  assert.ok(squat.farArm[3][0] > squat.shoulder[0] + 20);
  assert.ok(squat.nearArm[3][0] > squat.shoulder[0] + 20);
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
});
