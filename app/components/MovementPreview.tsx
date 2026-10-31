"use client";

import { useEffect, useRef } from "react";
import { scene } from "./movement-kinematics";
import { paintZenSilhouette } from "./zen-silhouette-renderer";

export type MovementPreviewProps = {
  exerciseId: string;
  playing?: boolean;
  className?: string;
  size?: "card" | "player";
};

/**
 * High-fidelity Zen silhouette movement preview for the session player.
 */
export function MovementPreview({
  exerciseId,
  playing = false,
  className = "",
  size = "card",
}: MovementPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Start optimistically. IntersectionObserver callbacks are asynchronous;
    // waiting for one can leave the first paint permanently paused in browsers
    // or embedded previews that do not deliver an initial entry reliably.
    let visible = true;
    let frameId = 0;
    let last = 0;
    let elapsed = 0;
    let width = 0;
    let height = 0;
    let disposed = false;
    const isStill = scene(exerciseId, 0).still;

    const draw = () => {
      if (width && height) {
        paintZenSilhouette(context, width, height, scene(exerciseId, elapsed / 1000));
      }
    };

    const canAnimate = () =>
      playing && visible && !media.matches && !document.hidden && !isStill && !disposed;

    const tick = (now: number) => {
      frameId = 0;
      if (!canAnimate()) {
        last = 0;
        return;
      }
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
      if (width === 0 || height === 0) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.01 },
    );

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

  return (
    <canvas
      ref={canvasRef}
      className={`movement-preview ${className}`.trim()}
      data-size={size}
      data-exercise={exerciseId}
      aria-hidden="true"
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        aspectRatio: "8 / 5",
      }}
    />
  );
}

export default MovementPreview;
