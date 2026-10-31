---
name: pose-animation
description: Add or improve the ZenFigure silhouette animation system for Motive exercise cards. Use when adding new exercises that need pose animations, or when refining existing silhouettes.
---

# Pose Animation Skill

The `ZenFigure` component (`app/components/ZenFigure.tsx`) and `MovementPreview` component (`app/components/MovementPreview.tsx`) render authentic sumi-ink human silhouette vector animations, capturing the anatomical curves, weight shift, and breath-paced kinesiology of real movement.

Detailed anatomical analysis of all movements is documented in [movement-poses-guide.md](file:///c:/repo/routines/movement-poses-guide.md).

## Architecture
- **Kinematic Engine** (`app/components/movement-kinematics.ts`):
  - 2D skeletal anatomical landmark rigs (`head`, `shoulder`, `hip`, `curve`, `farArm`, `nearArm`, `farLeg`, `nearLeg`).
  - True inverse kinematics (`joint()`) ensuring feet and hands maintain ground/bar contact without rubber-banding.
  - Phase-aware locomotion engine (`locomotion()`) for natural gait, flight phases, and foot clearance.
- **Silhouette Renderer** (`app/components/zen-silhouette-renderer.ts`):
  - Renders true human muscular contours (deltoid taper, quadriceps belly, gastrocnemius calf curve, Achilles tendon, foot arch, thoracic spine).
  - Depth-aware sumi-ink layering: primary ink (`#1a1c1b`) for near limbs, subtle depth tone (`rgba(26,28,27,0.60)`) for far limbs.
  - Minimalist zen ground hairline and washi mat.

## Adding a New Movement
1. In `app/components/movement-kinematics.ts`:
   - Define start and peak landmark poses using `rig(head, shoulder, hip, farArm, nearArm, farLeg, nearLeg)`.
   - In `scene(id, seconds)`, map the exercise ID to its interpolation curve.
2. In `app/components/movement-kinematics.ts`:
   - Add the motion category to `MOTION_MAP` if it represents a new class.
3. Test with `npm run dev` to verify natural human movement, joint stability, and reduced-motion compliance.
