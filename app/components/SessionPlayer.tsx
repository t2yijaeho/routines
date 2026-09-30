"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { buildSessionSteps, exerciseById, type Routine } from "@/lib/routine";
import MovementPreview from "./MovementPreview";
import Modal from "./Modal";

export default function SessionPlayer({ routine, onClose, onComplete }: { routine: Routine; onClose: () => void; onComplete: () => void }) {
  const steps = useMemo(() => buildSessionSteps(routine.entries), [routine]);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(steps[0]?.durationSeconds ?? 0);
  const [paused, setPaused] = useState(true);
  const [finished, setFinished] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const step = steps[index];
  const exercise = step ? exerciseById.get(step.exerciseId) : undefined;
  const timed = step && (step.kind === "rest" || !step.unit.startsWith("reps"));
  useEffect(() => {
    if (paused || finished || !timed) return;
    const deadline = Date.now() + remaining * 1000;
    const interval = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        window.clearInterval(interval);
        // Each transition waits for readiness, so a background tab never skips work.
        setPaused(true);
      }
    }, 200);
    return () => window.clearInterval(interval);
  // The deadline is captured when playback or the current step changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, index, finished, timed]);

  function advance(skip = false) {
    if (skip) setSkipped((n) => n + 1);
    if (index + 1 >= steps.length) { setFinished(true); setPaused(true); onComplete(); return; }
    setIndex(index + 1); setRemaining(steps[index + 1].durationSeconds); setPaused(true);
  }
  function previous() { if (index === 0) return; setIndex(index - 1); setRemaining(steps[index - 1].durationSeconds); setPaused(true); }
  if (!step || !exercise) return null;
  const time = String(Math.floor(remaining / 60)).padStart(2, "0") + ":" + String(remaining % 60).padStart(2, "0");
  return <Modal title={finished ? "Session finished" : "Your session"} onClose={onClose} wide>
    {finished ? <div className="session-finished"><div className="success-orbit"><CircleCheck size={44} /></div><span className="eyebrow">One session at a time</span><h2>You showed up.</h2><p>{routine.title}</p><p className="muted">{skipped ? skipped + " step" + (skipped === 1 ? " was" : "s were") + " skipped. Adjust your next session to suit you." : "Your session is complete. Take a moment to recover."}</p><button className="button primary" onClick={onClose}>Back to your studio <ArrowRight size={17} /></button></div> : <>
      <div className="session-title"><div><span className="muted small">{routine.title}</span><h2>{step.kind === "rest" ? "Take a breath." : exercise.name}</h2></div><span className="pill">{index + 1} / {steps.length}</span></div>
      <div className="session-progress" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index}><span style={{ width: (index / steps.length) * 100 + "%" }} /></div>
      <div className="session-body"><div className="session-stage">{step.kind === "rest" ? <div className="rest-orbit"><span>RECOVER</span></div> : <MovementPreview exerciseId={exercise.id} playing={!paused} size="player" />}<span className="stage-caption">{step.kind === "rest" ? "Move on when you feel ready" : "Movement illustration · follow the written cue"}</span></div>
        <div className="session-instructions"><span className="eyebrow">{step.kind === "rest" ? "Recovery" : "Set " + step.setNumber + " of " + step.totalSets}</span><div className="session-clock">{timed ? time : step.amount}<span>{timed ? "remaining" : step.unit}</span></div><p>{step.kind === "rest" ? "Relax your grip, breathe comfortably, and get ready for the next movement." : exercise.cue}</p>{step.unit.includes("side") && <p className="small muted">Complete both sides. The timer includes equal time for each side.</p>}<div className="session-controls"><button className="button secondary" disabled={timed && remaining === 0} onClick={() => setPaused(!paused)}>{paused ? <Play size={17} /> : <Pause size={17} />}{paused ? "Begin" : "Pause"}</button><button className="button primary" onClick={() => advance()}><Check size={17} />{step.kind === "rest" ? "Ready" : "Set done"}</button></div><button className="text-button" onClick={() => { setRemaining(step.durationSeconds); setPaused(true); }}><RotateCcw size={14} />Reset this step</button></div></div>
      <div className="session-bottom"><button className="button ghost" onClick={previous} disabled={index === 0}><ArrowLeft size={16} />Previous</button><span className="small muted">{!timed ? "Repetitions are self-paced." : "You control when the next step starts."}</span><button className="button ghost" onClick={() => advance(true)}>Skip <SkipForward size={16} /></button></div>
    </>}
  </Modal>;
}
