"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import exerciseData from "@/data/exercises.json";
import { ZenFigure } from "./components/ZenFigure";

const categories = ["strength", "flexibility", "isometric", "cardio"] as const;
type Category = (typeof categories)[number];
type Filter = Category | "all";

type Exercise = {
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
  unit: string;
  estimatedMinutes: number;
};

type RoutineEntry = {
  instanceId: string;
  exerciseId: string;
  amount: number;
};

type StoredRoutine = {
  version: 1;
  title: string;
  goal: string;
  targetMinutes: number;
  entries: RoutineEntry[];
};

type AiState =
  | "checking"
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "running"
  | "error";

const exercises = exerciseData as Exercise[];
const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

const categoryDetails: Record<
  Category,
  { label: string; code: string; description: string }
> = {
  strength: {
    label: "Strength",
    code: "STR",
    description: "Pull, push, squat, hinge and core work.",
  },
  flexibility: {
    label: "Flexibility",
    code: "FLX",
    description: "Active range, joint prep and spinal mobility.",
  },
  isometric: {
    label: "Isometric",
    code: "ISO",
    description: "Holds, hangs, inversions and positional control.",
  },
  cardio: {
    label: "Cardio",
    code: "CRD",
    description: "Aerobic base, intervals and recovery work.",
  },
};

const presets = [
  {
    id: "balanced-base",
    label: "Balanced base",
    title: "20-minute balanced base",
    goal: "Balanced movement",
    targetMinutes: 20,
    entries: [
      ["wrist-flexor-stretch", 30],
      ["squat-air", 12],
      ["scapular-pull-pronated", 8],
      ["reverse-plank", 30],
      ["slow-run-zone-1", 10],
    ] as Array<[string, number]>,
  },
  {
    id: "run-sandwich",
    label: "Run sandwich",
    title: "Uphill run sandwich",
    goal: "Cardio capacity",
    targetMinutes: 30,
    entries: [
      ["slow-run-zone-1", 10],
      ["fast-uphill-run", 3],
      ["power-walk-downhill", 4],
      ["fast-uphill-run", 3],
      ["power-walk-downhill", 4],
      ["slow-walk-zone-1", 8],
    ] as Array<[string, number]>,
  },
  {
    id: "mobility-reset",
    label: "Mobility reset",
    title: "Desk-to-movement reset",
    goal: "Mobility and control",
    targetMinutes: 12,
    entries: [
      ["wrist-extensor-stretch", 30],
      ["wrist-flexor-stretch", 30],
      ["rolling-ball", 8],
      ["glute-bridge-elevated", 12],
      ["crow-hold", 20],
    ] as Array<[string, number]>,
  },
] as const;

const defaultPreset = presets[0];
const defaultEntries: RoutineEntry[] = defaultPreset.entries.map(
  ([exerciseId, amount], index) => ({
    instanceId: `${defaultPreset.id}-${index}`,
    exerciseId,
    amount,
  }),
);

const storageKey = "motive-routine-v1";

function MotionFigure({ motion, exerciseId }: { motion: string; exerciseId?: string }) {
  return (
    <div className={`motion-stage motion-stage--${motion}`} aria-hidden="true">
      <ZenFigure motion={motion} exerciseId={exerciseId} playing={true} />
    </div>
  );
}

function estimateEntryMinutes(entry: RoutineEntry) {
  const exercise = exerciseById.get(entry.exerciseId);
  if (!exercise) return 0;
  if (exercise.unit === "min") return entry.amount;
  if (exercise.unit.startsWith("sec")) return Math.max(1, entry.amount / 60);
  return exercise.estimatedMinutes * (entry.amount / exercise.amount);
}

function makeInstanceId(exerciseId: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${exerciseId}-${suffix}`;
}

function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) return <em key={index}>{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index}>{token.slice(1, -1)}</code>;
    return <Fragment key={index}>{token}</Fragment>;
  });
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: Array<{ type: "ul" | "ol"; lines: string[] } | { type: "p" | "h"; text: string; level?: number }> = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const list = /^(?:([-*+])|\d+[.)])\s+(.+)$/.exec(line);
    if (heading) blocks.push({ type: "h", text: heading[2], level: heading[1].length });
    else if (list) {
      const type = /^\d/.test(line) ? "ol" : "ul";
      const previous = blocks[blocks.length - 1];
      if (previous?.type === type) previous.lines.push(list[2]);
      else blocks.push({ type, lines: [list[2]] });
    } else blocks.push({ type: "p", text: line });
  }
  return (
    <div className="ai-markdown">
      {blocks.map((block, index) => {
        if (block.type === "ul" || block.type === "ol") {
          const List = block.type;
          return (
            <List key={index}>
              {block.lines.map((line, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(line)}</li>)}
            </List>
          );
        }
        if (block.type === "h") {
          const Heading = `h${block.level}` as "h1" | "h2" | "h3";
          return <Heading key={index}>{renderInlineMarkdown(block.text)}</Heading>;
        }
        if (block.type === "p") return <p key={index}>{renderInlineMarkdown(block.text)}</p>;
        return null;
      })}
    </div>
  );
}

function isStoredRoutine(value: unknown): value is StoredRoutine {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredRoutine>;
  return (
    candidate.version === 1 &&
    typeof candidate.title === "string" &&
    typeof candidate.goal === "string" &&
    typeof candidate.targetMinutes === "number" &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(
      (entry) =>
        entry &&
        typeof entry.instanceId === "string" &&
        typeof entry.exerciseId === "string" &&
        exerciseById.has(entry.exerciseId) &&
        typeof entry.amount === "number" &&
        Number.isFinite(entry.amount) &&
        entry.amount > 0,
    )
  );
}

export default function Home() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState<string>(defaultPreset.title);
  const [goal, setGoal] = useState<string>(defaultPreset.goal);
  const [targetMinutes, setTargetMinutes] = useState<number>(
    defaultPreset.targetMinutes,
  );
  const [routine, setRoutine] = useState<RoutineEntry[]>(defaultEntries);
  const [hydrated, setHydrated] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy plan");
  const [aiState, setAiState] = useState<AiState>("checking");
  const [aiProgress, setAiProgress] = useState(0);
  const [aiAdvice, setAiAdvice] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (isStoredRoutine(parsed)) {
            setTitle(parsed.title);
            setGoal(parsed.goal);
            setTargetMinutes(parsed.targetMinutes);
            setRoutine(parsed.entries);
          }
        }
      } catch {
        localStorage.removeItem(storageKey);
      } finally {
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const stored: StoredRoutine = {
      version: 1,
      title,
      goal,
      targetMinutes,
      entries: routine,
    };
    localStorage.setItem(storageKey, JSON.stringify(stored));
  }, [goal, hydrated, routine, targetMinutes, title]);

  useEffect(() => {
    const model = window.LanguageModel;
    if (!model) {
      queueMicrotask(() => setAiState("unavailable"));
      return;
    }

    let cancelled = false;
    model
      .availability({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      })
      .then((availability) => {
        if (!cancelled) setAiState(availability);
      })
      .catch(() => {
        if (!cancelled) setAiState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const visibleExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return exercises.filter((exercise) => {
      const matchesCategory = filter === "all" || exercise.category === filter;
      const matchesQuery =
        !normalizedQuery ||
        [
          exercise.name,
          exercise.family,
          exercise.focus,
          exercise.equipment,
          exercise.level,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [filter, query]);

  const totalMinutes = useMemo(
    () => Math.round(routine.reduce((total, entry) => total + estimateEntryMinutes(entry), 0)),
    [routine],
  );

  const representedCategories = useMemo(
    () =>
      new Set(
        routine
          .map((entry) => exerciseById.get(entry.exerciseId)?.category)
          .filter((category): category is Category => Boolean(category)),
      ),
    [routine],
  );

  const balanceNote = useMemo(() => {
    if (routine.length === 0) return "Start with one movement, then add contrast.";
    if (representedCategories.size === 1)
      return "Focused session. Add a second mode for more contrast.";
    if (representedCategories.size === 4)
      return "All four movement modes are represented.";
    return `${representedCategories.size} of 4 movement modes represented.`;
  }, [representedCategories, routine.length]);

  function addExercise(exercise: Exercise) {
    setRoutine((current) => [
      ...current,
      {
        instanceId: makeInstanceId(exercise.id),
        exerciseId: exercise.id,
        amount: exercise.amount,
      },
    ]);
    setAnnouncement(`${exercise.name} added to the routine.`);
  }

  function removeEntry(instanceId: string) {
    const removed = routine.find((entry) => entry.instanceId === instanceId);
    setRoutine((current) => current.filter((entry) => entry.instanceId !== instanceId));
    if (removed) {
      setAnnouncement(
        `${exerciseById.get(removed.exerciseId)?.name ?? "Movement"} removed.`,
      );
    }
  }

  function moveEntry(index: number, direction: -1 | 1) {
    setRoutine((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
      ];
      return reordered;
    });
  }

  function updateAmount(instanceId: string, amount: number) {
    if (!Number.isFinite(amount) || amount < 1) return;
    setRoutine((current) =>
      current.map((entry) =>
        entry.instanceId === instanceId ? { ...entry, amount } : entry,
      ),
    );
  }

  function applyPreset(preset: (typeof presets)[number]) {
    setTitle(preset.title);
    setGoal(preset.goal);
    setTargetMinutes(preset.targetMinutes);
    setRoutine(
      preset.entries.map(([exerciseId, amount], index) => ({
        instanceId: makeInstanceId(`${preset.id}-${index}`),
        exerciseId,
        amount,
      })),
    );
    setAiAdvice("");
    setAnnouncement(`${preset.label} preset loaded.`);
  }

  async function copyRoutine() {
    const lines = routine.map((entry, index) => {
      const exercise = exerciseById.get(entry.exerciseId);
      return `${index + 1}. ${exercise?.name ?? "Movement"} — ${entry.amount} ${exercise?.unit ?? ""}`;
    });
    const summary = `${title}\nGoal: ${goal} · about ${totalMinutes} min\n\n${lines.join("\n")}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopyLabel("Copied");
      setAnnouncement("Routine copied to the clipboard.");
      window.setTimeout(() => setCopyLabel("Copy plan"), 1800);
    } catch {
      setCopyLabel("Copy failed");
      setAnnouncement("The browser did not allow clipboard access.");
    }
  }

  async function runBrowserAi() {
    const model = window.LanguageModel;
    if (!model || routine.length === 0) return;

    setAiState("running");
    setAiAdvice("");
    let session: BrowserLanguageModelSession | undefined;

    try {
      session = await model.create({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        initialPrompts: [
          {
            role: "system",
            content:
              "You are a concise movement-planning assistant. Review routine structure only. Do not diagnose, prescribe rehabilitation, or claim medical benefits. Mention that pain is a reason to stop and seek qualified guidance.",
          },
        ],
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            setAiState("downloading");
            setAiProgress(Math.round(event.loaded * 100));
          });
        },
      });

      setAiState("running");
      const routineText = routine
        .map((entry, index) => {
          const exercise = exerciseById.get(entry.exerciseId);
          return `${index + 1}. ${exercise?.name}: ${entry.amount} ${exercise?.unit}; category ${exercise?.category}; focus ${exercise?.focus}`;
        })
        .join("\n");
      const response = await session.prompt(
        `Review this ${targetMinutes}-minute routine for the goal “${goal}”. Current estimate: ${totalMinutes} minutes.\n${routineText}\nReturn exactly three short bullet points: one thing working, one sequencing or balance adjustment, and one safety-aware scaling idea.`,
      );
      setAiAdvice(response.trim());
      setAiState("available");
      setAnnouncement("On-device AI review complete.");
    } catch {
      setAiState("error");
      setAiAdvice(
        "The on-device model could not complete this review. Your routine is unchanged and still saved locally.",
      );
    } finally {
      session?.destroy?.();
    }
  }

  const aiLabel =
    aiState === "downloadable"
      ? "Download model & review"
      : aiState === "downloading"
        ? `Downloading ${aiProgress}%`
        : aiState === "running"
          ? "Reviewing routine…"
          : "Review with browser AI";

  const aiDisabled =
    routine.length === 0 ||
    aiState === "checking" ||
    aiState === "unavailable" ||
    aiState === "running" ||
    aiState === "downloading";

  return (
    <main>
      <div className="announce" aria-live="polite">
        {announcement}
      </div>

      <header className="topbar">
        <a className="brand" href="#top" aria-label="Motive home">
          <span className="brand__mark" aria-hidden="true">
            M/
          </span>
          <span>Motive</span>
        </a>
        <nav className="topbar__nav" aria-label="Primary navigation">
          <a href="#library">Library</a>
          <a href="#builder">Builder</a>
          <a href="#browser-ai">Browser AI</a>
        </nav>
        <a className="topbar__action" href="#builder">
          Build a routine <span aria-hidden="true">↘</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero__eyebrow">
          <span className="hero__eyebrow-dot" aria-hidden="true" />
          A private, static movement planner
        </div>
        <div className="hero__grid">
          <div>
            <h1>
              Move with
              <span>a plan.</span>
            </h1>
            <p className="hero__lede">
              Assemble strength, mobility, holds and cardio into one clear session.
              Every motion stays editable. Every plan stays on this device.
            </p>
          </div>
          <div className="hero__signal" aria-hidden="true">
            <span className="hero__signal-ring hero__signal-ring--one" />
            <span className="hero__signal-ring hero__signal-ring--two" />
            <span className="hero__signal-core">MOVE</span>
          </div>
        </div>
        <dl className="hero__stats">
          <div>
            <dt>{exercises.length}</dt>
            <dd>Movement components</dd>
          </div>
          <div>
            <dt>04</dt>
            <dd>Training modes</dd>
          </div>
          <div>
            <dt>00</dt>
            <dd>Accounts or API keys</dd>
          </div>
        </dl>
      </section>

      <section className="mode-strip" aria-label="Movement modes">
        {categories.map((category, index) => (
          <button
            className={`mode-strip__item mode-strip__item--${category}`}
            key={category}
            type="button"
            onClick={() => {
              setFilter(category);
              document.getElementById("library")?.scrollIntoView();
            }}
          >
            <span>0{index + 1}</span>
            <strong>{categoryDetails[category].label}</strong>
            <small>{categoryDetails[category].description}</small>
          </button>
        ))}
      </section>

      <section className="studio">
        <section className="library" id="library" aria-label="Movement library">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Component library</span>
              <h2>Choose the work.</h2>
            </div>
            <p>
              Short cues and looping motion studies make each component quick to scan.
            </p>
          </div>

          <div className="library-tools">
            <label className="search-field">
              <span className="search-field__icon" aria-hidden="true">
                / 
              </span>
              <span className="sr-only">Search movements</span>
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search movement, focus or equipment"
              />
              <kbd>⌘ K</kbd>
            </label>
            <div className="filters" aria-label="Filter movement library">
              <button
                type="button"
                className={filter === "all" ? "is-active" : ""}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All <span>{exercises.length}</span>
              </button>
              {categories.map((category) => (
                <button
                  type="button"
                  key={category}
                  className={filter === category ? "is-active" : ""}
                  aria-pressed={filter === category}
                  onClick={() => setFilter(category)}
                >
                  {categoryDetails[category].label}
                  <span>
                    {exercises.filter((exercise) => exercise.category === category).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="library-result-line">
            <span>
              {visibleExercises.length.toString().padStart(2, "0")} components
            </span>
            <span>{filter === "all" ? "Complete library" : categoryDetails[filter].description}</span>
          </div>

          <div className="exercise-grid">
            {visibleExercises.map((exercise, index) => (
              <article
                className={`exercise-card exercise-card--${exercise.category}`}
                key={exercise.id}
              >
                <div className="exercise-card__topline">
                  <span>{categoryDetails[exercise.category].code}</span>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <MotionFigure motion={exercise.motion} exerciseId={exercise.id} />
                <div className="exercise-card__body">
                  <div className="exercise-card__meta">
                    <span>{exercise.family}</span>
                    <span>{exercise.level}</span>
                  </div>
                  <h3>{exercise.name}</h3>
                  <p>{exercise.cue}</p>
                  <dl>
                    <div>
                      <dt>Focus</dt>
                      <dd>{exercise.focus}</dd>
                    </div>
                    <div>
                      <dt>Start with</dt>
                      <dd>
                        {exercise.amount} {exercise.unit}
                      </dd>
                    </div>
                  </dl>
                  <button type="button" onClick={() => addExercise(exercise)}>
                    Add to routine <span aria-hidden="true">＋</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

          {visibleExercises.length === 0 && (
            <div className="empty-search" role="status">
              <strong>No component matches “{query}”.</strong>
              <button type="button" onClick={() => setQuery("")}>
                Clear search
              </button>
            </div>
          )}
        </section>

        <aside className="builder" id="builder" aria-label="Routine builder">
          <div className="builder__header">
            <div>
              <span className="section-kicker">Live routine</span>
              <span className="builder__saved">Saved locally</span>
            </div>
            <label>
              <span className="sr-only">Routine title</span>
              <input
                className="builder__title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={60}
              />
            </label>
          </div>

          <div className="preset-row" aria-label="Routine presets">
            {presets.map((preset) => (
              <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="builder__settings">
            <label>
              Goal
              <select value={goal} onChange={(event) => setGoal(event.target.value)}>
                <option>Balanced movement</option>
                <option>Build strength</option>
                <option>Mobility and control</option>
                <option>Cardio capacity</option>
                <option>Active recovery</option>
              </select>
            </label>
            <label>
              Target
              <select
                value={targetMinutes}
                onChange={(event) => setTargetMinutes(Number(event.target.value))}
              >
                {[10, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ol className="routine-list">
            {routine.map((entry, index) => {
              const exercise = exerciseById.get(entry.exerciseId);
              if (!exercise) return null;
              return (
                <li className="routine-item" key={entry.instanceId}>
                  <span className="routine-item__index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="routine-item__main">
                    <span className={`routine-item__category dot--${exercise.category}`}>
                      {categoryDetails[exercise.category].code}
                    </span>
                    <strong>{exercise.name}</strong>
                    <label>
                      <span className="sr-only">Amount for {exercise.name}</span>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={entry.amount}
                        onChange={(event) =>
                          updateAmount(entry.instanceId, Number(event.target.value))
                        }
                      />
                      <span>{exercise.unit}</span>
                    </label>
                  </div>
                  <div className="routine-item__actions">
                    <button
                      type="button"
                      onClick={() => moveEntry(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${exercise.name} earlier`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveEntry(index, 1)}
                      disabled={index === routine.length - 1}
                      aria-label={`Move ${exercise.name} later`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.instanceId)}
                      aria-label={`Remove ${exercise.name}`}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          {routine.length === 0 && (
            <div className="empty-routine">
              <span aria-hidden="true">＋</span>
              <strong>Your routine is open.</strong>
              <p>Add a component from the library or load a preset.</p>
            </div>
          )}

          <div className="routine-summary">
            <div>
              <span>Estimate</span>
              <strong>{totalMinutes} min</strong>
              <small>
                {totalMinutes === targetMinutes
                  ? "On target"
                  : `${Math.abs(totalMinutes - targetMinutes)} min ${totalMinutes > targetMinutes ? "over" : "under"} target`}
              </small>
            </div>
            <div>
              <span>Components</span>
              <strong>{routine.length.toString().padStart(2, "0")}</strong>
              <small>{balanceNote}</small>
            </div>
          </div>

          <div className="category-meter" aria-label={balanceNote}>
            {categories.map((category) => (
              <span
                key={category}
                className={`category-meter__segment category-meter__segment--${category} ${representedCategories.has(category) ? "is-on" : ""}`}
                title={categoryDetails[category].label}
              />
            ))}
          </div>

          <section className="ai-panel" id="browser-ai">
            <div className="ai-panel__heading">
              <div>
                <span className="ai-panel__spark" aria-hidden="true">
                  ✦
                </span>
                <strong>Optional browser AI</strong>
              </div>
              <span className={`ai-status ai-status--${aiState}`}>
                {aiState === "available"
                  ? "Ready"
                  : aiState === "unavailable"
                    ? "Not available"
                    : aiState === "error"
                      ? "Try again"
                      : "Local model"}
              </span>
            </div>
            <p>
              Get a three-point structure review from a compatible on-device model.
              No API key or cloud account is used.
            </p>
            {aiState === "unavailable" && (
              <p className="ai-panel__note">
                This browser does not expose the local Prompt API. The builder works
                normally without it.
              </p>
            )}
            {aiAdvice && <div className="ai-response" aria-live="polite"><MarkdownPreview content={aiAdvice} /></div>}
            <button type="button" onClick={runBrowserAi} disabled={aiDisabled}>
              {aiState === "checking" ? "Checking browser…" : aiLabel}
              <span aria-hidden="true">↗</span>
            </button>
          </section>

          <div className="builder__footer-actions">
            <button type="button" onClick={copyRoutine} disabled={routine.length === 0}>
              {copyLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setRoutine([]);
                setAiAdvice("");
                setAnnouncement("Routine cleared.");
              }}
              disabled={routine.length === 0}
            >
              Clear
            </button>
          </div>
        </aside>
      </section>

      <footer>
        <div>
          <span className="brand__mark" aria-hidden="true">
            M/
          </span>
          <strong>Make the next movement obvious.</strong>
        </div>
        <p>
          Motive is a planning tool, not medical advice. Scale to your experience,
          stop when movement causes pain, and seek qualified guidance when needed.
        </p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
