import exerciseData from "../data/exercises.json" with { type: "json" };

export const categories = ["strength", "flexibility", "isometric", "cardio"] as const;
export type Category = (typeof categories)[number];
export type ExerciseUnit = "reps" | "reps / side" | "sec" | "sec / side" | "min";

export type Exercise = {
  id: string;
  name: string;
  category: Category;
  family: string;
  level: string;
  equipment: string;
  focus: string;
  cue: string;
  motion: string;
  amount: number;
  unit: ExerciseUnit;
  estimatedMinutes: number;
};

export const exercises = exerciseData as Exercise[];
export const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
export const categoryDetails: Record<Category, { label: string; code: string; description: string }> = {
  strength: { label: "Strength", code: "STR", description: "Build your session around controlled repetitions." },
  flexibility: { label: "Flexibility", code: "FLX", description: "Explore a comfortable range of movement." },
  isometric: { label: "Isometric", code: "ISO", description: "Make time for stillness, balance and holds." },
  cardio: { label: "Cardio", code: "CRD", description: "Find your rhythm with walking and running." },
};

export type RoutineEntry = {
  instanceId: string;
  exerciseId: string;
  amount: number;
  sets: number;
  restSeconds: number;
};

export type Routine = {
  version: 2;
  title: string;
  entries: RoutineEntry[];
};

export const routineLimits = { entries: 50, title: 80, sets: 10, restSeconds: 300 } as const;

export function amountLimit(unit: ExerciseUnit): number {
  if (unit === "min") return 120;
  if (unit.startsWith("sec")) return 600;
  return 100;
}

function instanceId(exerciseId: string): string {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${exerciseId}-${suffix}`;
}

export function createEntry(exerciseId: string): RoutineEntry {
  const exercise = exerciseById.get(exerciseId);
  if (!exercise) throw new RangeError(`Unknown movement: ${exerciseId}`);
  return {
    instanceId: instanceId(exerciseId),
    exerciseId,
    amount: exercise.amount,
    sets: exercise.category === "strength" ? 3 : exercise.category === "isometric" ? 2 : 1,
    restSeconds: exercise.category === "strength" ? 45 : exercise.category === "flexibility" ? 15 : 30,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function integerWithin(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}

/** Reject malformed current saves; migrate legacy amounts into the current bounds. */
export function normalizeRoutine(value: unknown): Routine | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) return null;
  if (typeof value.title !== "string" || !Array.isArray(value.entries)) return null;
  if (value.entries.length > routineLimits.entries) return null;
  if (value.version === 2 && value.title.length > routineLimits.title) return null;

  const entries: RoutineEntry[] = [];
  const seenIds = new Set<string>();
  for (const candidate of value.entries) {
    if (!isRecord(candidate) || typeof candidate.exerciseId !== "string") return null;
    const exercise = exerciseById.get(candidate.exerciseId);
    if (!exercise || typeof candidate.instanceId !== "string" || !candidate.instanceId.trim()) return null;
    if (candidate.instanceId.length > 160 || !/^[a-zA-Z0-9._:-]+$/.test(candidate.instanceId)) return null;

    const maxAmount = amountLimit(exercise.unit);
    let amount: number;
    let sets: number;
    let restSeconds: number;
    if (value.version === 1) {
      if (typeof candidate.amount !== "number" || !Number.isFinite(candidate.amount) || candidate.amount <= 0) return null;
      amount = clampInteger(candidate.amount, 1, maxAmount);
      // Version 1 represented one prescribed block, not multiple sets.
      sets = 1;
      restSeconds = 0;
    } else {
      if (!integerWithin(candidate.amount, 1, maxAmount)) return null;
      if (!integerWithin(candidate.sets, 1, routineLimits.sets)) return null;
      if (!integerWithin(candidate.restSeconds, 0, routineLimits.restSeconds)) return null;
      amount = candidate.amount;
      sets = candidate.sets;
      restSeconds = candidate.restSeconds;
    }

    let id = candidate.instanceId;
    if (seenIds.has(id)) {
      // Deterministic repair makes repeated imports stable without dropping work.
      const base = id.slice(0, 140);
      let suffix = entries.length;
      do { id = `${base}-copy-${suffix++}`; } while (seenIds.has(id));
    }
    seenIds.add(id);
    entries.push({ instanceId: id, exerciseId: exercise.id, amount, sets, restSeconds });
  }

  const title = value.title.replace(/\p{Cc}/gu, " ").trim().slice(0, routineLimits.title);
  return { version: 2, title: title || "Untitled routine", entries };
}

export type SessionStep = {
  id: string;
  exerciseId: string;
  kind: "work" | "rest";
  durationSeconds: number;
  setNumber: number;
  totalSets: number;
  amount: number;
  unit: ExerciseUnit;
};

/** Repetition timing is a planning estimate of four seconds per repetition. */
export function workSeconds(amount: number, unit: ExerciseUnit): number {
  const boundedAmount = Number.isFinite(amount) ? clampInteger(amount, 1, amountLimit(unit)) : 1;
  const seconds = unit === "min" ? boundedAmount * 60 : unit.startsWith("sec") ? boundedAmount : boundedAmount * 4;
  return seconds * (unit.endsWith("/ side") ? 2 : 1);
}

/** Recovery follows each set, including transitions, but never the final set. */
export function buildSessionSteps(entries: readonly RoutineEntry[]): SessionStep[] {
  const validEntries = entries.slice(0, routineLimits.entries).filter((entry) => exerciseById.has(entry.exerciseId));
  const steps: SessionStep[] = [];
  validEntries.forEach((entry, entryIndex) => {
    const exercise = exerciseById.get(entry.exerciseId)!;
    const sets = Number.isFinite(entry.sets) ? clampInteger(entry.sets, 1, routineLimits.sets) : 1;
    const rest = Number.isFinite(entry.restSeconds) ? clampInteger(entry.restSeconds, 0, routineLimits.restSeconds) : 0;
    const amount = Number.isFinite(entry.amount) ? clampInteger(entry.amount, 1, amountLimit(exercise.unit)) : exercise.amount;
    for (let setNumber = 1; setNumber <= sets; setNumber++) {
      const shared = { exerciseId: exercise.id, setNumber, totalSets: sets };
      const id = `${entryIndex}-${entry.instanceId}-${setNumber}`;
      steps.push({ ...shared, id: `${id}-work`, kind: "work", durationSeconds: workSeconds(amount, exercise.unit), amount, unit: exercise.unit });
      if (rest > 0 && !(entryIndex === validEntries.length - 1 && setNumber === sets)) {
        steps.push({ ...shared, id: `${id}-rest`, kind: "rest", durationSeconds: rest, amount: rest, unit: "sec" });
      }
    }
  });
  return steps;
}

export function estimateRoutineSeconds(entries: readonly RoutineEntry[]): number {
  return buildSessionSteps(entries).reduce((total, step) => total + step.durationSeconds, 0);
}

export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}

type PresetEntry = Omit<RoutineEntry, "instanceId">;
export type RoutinePreset = {
  id: string;
  title: string;
  description: string;
  minutes: number;
  category: Category;
  entries: readonly PresetEntry[];
};

const presetDefinitions: Omit<RoutinePreset, "minutes">[] = [
  {
    id: "balanced-base",
    title: "The daily mix",
    description: "A little strength, a little space, a steady finish.",
    category: "strength",
    entries: [
      { exerciseId: "slow-walk-zone-1", amount: 2, sets: 1, restSeconds: 15 },
      { exerciseId: "squat-air", amount: 10, sets: 2, restSeconds: 30 },
      { exerciseId: "glute-bridge-elevated", amount: 10, sets: 2, restSeconds: 30 },
      { exerciseId: "reverse-plank", amount: 20, sets: 2, restSeconds: 30 },
      { exerciseId: "wrist-extensor-stretch", amount: 20, sets: 1, restSeconds: 15 },
      { exerciseId: "slow-walk-zone-1", amount: 4, sets: 1, restSeconds: 0 },
    ],
  },
  {
    id: "strength-foundation",
    title: "Strength essentials",
    description: "A focused lower-body session with time to reset.",
    category: "strength",
    entries: [
      { exerciseId: "slow-walk-zone-1", amount: 2, sets: 1, restSeconds: 15 },
      { exerciseId: "squat-air", amount: 12, sets: 3, restSeconds: 45 },
      { exerciseId: "glute-bridge-elevated", amount: 12, sets: 3, restSeconds: 45 },
      { exerciseId: "reverse-plank", amount: 25, sets: 3, restSeconds: 30 },
      { exerciseId: "slow-walk-zone-1", amount: 2, sets: 1, restSeconds: 0 },
    ],
  },
  {
    id: "mobility-reset",
    title: "Room to move",
    description: "Gentle wrist work and controlled hip movement.",
    category: "flexibility",
    entries: [
      { exerciseId: "slow-walk-zone-1", amount: 2, sets: 1, restSeconds: 15 },
      { exerciseId: "wrist-extensor-stretch", amount: 30, sets: 1, restSeconds: 15 },
      { exerciseId: "wrist-flexor-stretch", amount: 30, sets: 1, restSeconds: 15 },
      { exerciseId: "standing-back-raise", amount: 8, sets: 2, restSeconds: 20 },
      { exerciseId: "glute-bridge-elevated", amount: 8, sets: 2, restSeconds: 20 },
    ],
  },
  {
    id: "cardio-flow",
    title: "Find your rhythm",
    description: "An easy walk, a conversational run, a slower finish.",
    category: "cardio",
    entries: [
      { exerciseId: "slow-walk-zone-1", amount: 3, sets: 1, restSeconds: 0 },
      { exerciseId: "slow-run-zone-1", amount: 9, sets: 1, restSeconds: 0 },
      { exerciseId: "slow-walk-zone-1", amount: 3, sets: 1, restSeconds: 0 },
    ],
  },
];

export const presets: RoutinePreset[] = presetDefinitions.map((preset) => ({
  ...preset,
  minutes: Math.ceil(estimateRoutineSeconds(preset.entries.map((entry, index) => ({ ...entry, instanceId: `${preset.id}-${index}` }))) / 60),
}));

/** Stable IDs keep the initial server render and browser hydration identical. */
export function makeRoutine(presetId = "balanced-base"): Routine {
  const preset = presets.find((candidate) => candidate.id === presetId);
  if (!preset) throw new RangeError(`Unknown routine preset: ${presetId}`);
  return {
    version: 2,
    title: preset.title,
    entries: preset.entries.map((entry, index) => ({ ...entry, instanceId: `${preset.id}-${index}` })),
  };
}
