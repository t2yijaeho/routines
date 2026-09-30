import assert from "node:assert/strict";
import test from "node:test";
import {
  amountLimit,
  buildSessionSteps,
  createEntry,
  estimateRoutineSeconds,
  exerciseById,
  formatDuration,
  makeRoutine,
  normalizeRoutine,
  presets,
  routineLimits,
  workSeconds,
} from "../lib/routine.ts";

function entry(exerciseId, overrides = {}) {
  return { instanceId: `${exerciseId}-test`, exerciseId, amount: 10, sets: 1, restSeconds: 0, ...overrides };
}

function routine(entries, overrides = {}) {
  return { version: 2, title: "Test session", entries, ...overrides };
}

test("new entries have unique IDs, known movements and valid editable defaults", () => {
  for (const exercise of exerciseById.values()) {
    const first = createEntry(exercise.id);
    const second = createEntry(exercise.id);
    assert.notEqual(first.instanceId, second.instanceId);
    assert.equal(first.amount, exercise.amount);
    assert.ok(normalizeRoutine(routine([first])));
  }
  assert.throws(() => createEntry("missing-exercise"), RangeError);
});

test("current saves round-trip without retaining untrusted extra fields", () => {
  const original = makeRoutine();
  const parsed = normalizeRoutine(JSON.parse(JSON.stringify({ ...original, injected: "ignored" })));
  assert.deepEqual(parsed, original);
  assert.notEqual(parsed.entries, original.entries);
  assert.equal(normalizeRoutine(routine([], { title: " \n\t " })).title, "Untitled routine");
});

test("malformed and oversized persisted payloads are rejected instead of partly loading", () => {
  const valid = entry("squat-air");
  const invalidValues = [null, [], {}, "routine", { ...routine([]), version: 9 }, routine([], { title: 123 }),
    routine([], { title: "x".repeat(routineLimits.title + 1) }),
    routine(Array.from({ length: routineLimits.entries + 1 }, () => valid)),
    routine([null]), routine([[]]), routine([{ ...valid, exerciseId: "missing" }]),
    routine([{ ...valid, instanceId: "" }]), routine([{ ...valid, instanceId: "bad\nid" }]),
    routine([{ ...valid, instanceId: "x".repeat(161) }]),
  ];
  for (const value of invalidValues) assert.equal(normalizeRoutine(value), null);
  for (const field of ["amount", "sets", "restSeconds"]) {
    for (const value of [null, undefined, "2", NaN, Infinity, -1, 1.5]) {
      assert.equal(normalizeRoutine(routine([{ ...valid, [field]: value }])), null, `${field} rejects ${value}`);
    }
  }
  assert.equal(normalizeRoutine(routine([{ ...valid, amount: 0 }])), null);
  assert.equal(normalizeRoutine(routine([{ ...valid, amount: 101 }])), null);
  assert.equal(normalizeRoutine(routine([{ ...valid, sets: 0 }])), null);
  assert.equal(normalizeRoutine(routine([{ ...valid, sets: 11 }])), null);
  assert.equal(normalizeRoutine(routine([{ ...valid, restSeconds: 301 }])), null);
});

test("limits distinguish repetitions, seconds and minutes", () => {
  assert.equal(amountLimit("reps / side"), 100);
  assert.equal(amountLimit("sec / side"), 600);
  assert.equal(amountLimit("min"), 120);
  assert.ok(normalizeRoutine(routine([entry("slow-walk-zone-1", { amount: 120 })])));
  assert.equal(normalizeRoutine(routine([entry("slow-walk-zone-1", { amount: 121 })])), null);
  assert.ok(normalizeRoutine(routine([entry("reverse-plank", { amount: 600 })])));
  assert.equal(normalizeRoutine(routine([entry("reverse-plank", { amount: 601 })])), null);
});

test("legacy routines migrate without silently multiplying their original work", () => {
  const legacy = { version: 1, title: "  Old routine  ", goal: "Balance", targetMinutes: 20, entries: [
    { instanceId: "legacy-squat", exerciseId: "squat-air", amount: 12 },
    { instanceId: "legacy-walk", exerciseId: "slow-walk-zone-1", amount: 999 },
  ] };
  assert.deepEqual(normalizeRoutine(legacy), routine([
    entry("squat-air", { instanceId: "legacy-squat", amount: 12 }),
    entry("slow-walk-zone-1", { instanceId: "legacy-walk", amount: 120 }),
  ], { title: "Old routine" }));
  assert.equal(normalizeRoutine({ ...legacy, entries: [{ ...legacy.entries[0], amount: Infinity }] }), null);
});

test("duplicate instance IDs are repaired stably without dropping repeated movements", () => {
  const original = routine([entry("squat-air"), entry("squat-air"), entry("squat-air", { instanceId: "squat-air-test-copy-1" })]);
  const result = normalizeRoutine(original);
  assert.equal(result.entries.length, 3);
  assert.equal(new Set(result.entries.map(({ instanceId }) => instanceId)).size, 3);
  assert.deepEqual(normalizeRoutine(original), result);
  assert.deepEqual(normalizeRoutine(result), result);
});

test("time estimates count both sides and use four seconds per repetition", () => {
  assert.equal(workSeconds(10, "reps"), 40);
  assert.equal(workSeconds(10, "reps / side"), 80);
  assert.equal(workSeconds(30, "sec"), 30);
  assert.equal(workSeconds(30, "sec / side"), 60);
  assert.equal(workSeconds(5, "min"), 300);
  assert.equal(estimateRoutineSeconds([entry("squat-bulgarian", { amount: 8 })]), 64);
  assert.equal(estimateRoutineSeconds([entry("wrist-extensor-stretch", { amount: 30 })]), 60);
});

test("session timing includes set recovery and exercise transitions, without trailing rest", () => {
  const entries = [entry("squat-air", { sets: 2, restSeconds: 30 }), entry("reverse-plank", { amount: 20, sets: 2, restSeconds: 15 })];
  const steps = buildSessionSteps(entries);
  assert.deepEqual(steps.map(({ kind, durationSeconds }) => [kind, durationSeconds]), [
    ["work", 40], ["rest", 30], ["work", 40], ["rest", 30],
    ["work", 20], ["rest", 15], ["work", 20],
  ]);
  assert.deepEqual(steps.filter(({ kind }) => kind === "work").map(({ setNumber, totalSets }) => [setNumber, totalSets]), [[1, 2], [2, 2], [1, 2], [2, 2]]);
  assert.equal(estimateRoutineSeconds(entries), 195);
  assert.equal(new Set(steps.map(({ id }) => id)).size, steps.length);
  assert.equal(steps.at(-1).kind, "work");
});

test("empty, no-rest, and defensively bounded sessions remain finite", () => {
  assert.deepEqual(buildSessionSteps([]), []);
  assert.equal(estimateRoutineSeconds([]), 0);
  assert.deepEqual(buildSessionSteps([entry("missing")]), []);
  assert.equal(buildSessionSteps([entry("squat-air", { sets: 3 })]).length, 3);
  const bounded = buildSessionSteps([entry("squat-air", { sets: 999, restSeconds: 999, amount: 999 })]);
  assert.equal(bounded.length, 19);
  assert.ok(bounded.every(({ durationSeconds }) => Number.isFinite(durationSeconds) && durationSeconds > 0));
  assert.equal(bounded[0].durationSeconds, 400);
  assert.equal(bounded[1].durationSeconds, 300);
  assert.equal(estimateRoutineSeconds([entry("missing"), entry("squat-air", { restSeconds: 20 }), entry("missing")]), 40);
});

test("presets use real movements and advertise the duration their session actually runs", () => {
  assert.equal(new Set(presets.map(({ id }) => id)).size, presets.length);
  for (const preset of presets) {
    const first = makeRoutine(preset.id);
    const second = makeRoutine(preset.id);
    assert.deepEqual(first, second, "stable initial IDs prevent hydration differences");
    assert.ok(normalizeRoutine(first));
    assert.ok(first.entries.length >= 3);
    assert.equal(preset.minutes, Math.ceil(estimateRoutineSeconds(first.entries) / 60));
    assert.ok(first.entries.every(({ exerciseId }) => exerciseById.get(exerciseId).level !== "Advanced"));
    first.entries[0].amount = 1;
    assert.notEqual(first.entries[0].amount, second.entries[0].amount, "loaded presets do not mutate shared definitions");
  }
  assert.throws(() => makeRoutine("missing"), RangeError);
});

test("duration formatting is predictable for timer edge cases", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(3600), "60:00");
  assert.equal(formatDuration(-1), "0:00");
  assert.equal(formatDuration(NaN), "0:00");
  assert.equal(formatDuration(59.6), "1:00");
});
