import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const libraryUrl = new URL("../data/exercises.json", import.meta.url);
const exercises = JSON.parse(await readFile(libraryUrl, "utf8"));

test("ships a balanced movement library", () => {
  assert.ok(Array.isArray(exercises));
  assert.ok(exercises.length >= 30, "expected at least 30 movement components");

  const counts = Object.groupBy(exercises, (exercise) => exercise.category);
  assert.deepEqual(
    new Set(Object.keys(counts)),
    new Set(["strength", "flexibility", "isometric", "cardio"]),
  );
  for (const [category, entries] of Object.entries(counts)) {
    assert.ok(entries.length >= 5, `${category} needs at least five entries`);
  }
});

test("keeps every movement identifiable and actionable", () => {
  const ids = new Set();
  const names = new Set();

  for (const exercise of exercises) {
    assert.match(exercise.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(!ids.has(exercise.id), `duplicate id: ${exercise.id}`);
    assert.ok(!names.has(exercise.name), `duplicate name: ${exercise.name}`);
    ids.add(exercise.id);
    names.add(exercise.name);

    assert.ok(exercise.cue.length >= 24, `${exercise.id} needs a useful cue`);
    assert.ok(exercise.focus.length >= 5, `${exercise.id} needs a focus`);
    assert.ok(exercise.equipment.length >= 3, `${exercise.id} needs equipment data`);
    assert.ok(exercise.amount > 0, `${exercise.id} needs a positive amount`);
    assert.ok(exercise.estimatedMinutes > 0, `${exercise.id} needs a time estimate`);
  }
});

test("keeps advanced neck loading and inversions explicitly guarded", () => {
  for (const id of ["head-bridge", "plow-stretch", "tripod-headstand"]) {
    const exercise = exercises.find((candidate) => candidate.id === id);
    assert.ok(exercise);
    assert.equal(exercise.level, "Advanced");
    assert.match(exercise.cue, /qualified.*coaching/i);
    assert.match(exercise.cue, /neck/i);
  }
});

test("isometric movements prescribe holds rather than dynamic repetitions", () => {
  for (const exercise of exercises.filter((candidate) => candidate.category === "isometric")) {
    assert.match(exercise.unit, /^sec/);
  }
});
