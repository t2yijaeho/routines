/**
 * Zen Sumi-Ink Anatomical Silhouette Renderer
 * Renders authentic human yoga & movement silhouettes with natural anatomical curves,
 * true joint articulation, and subtle depth values for overlapping limbs.
 */

import { Chain, Equipment, Point, Pose, Scene, distance, point } from "./movement-kinematics";

const INK_NEAR = "#1a1c1b";
const INK_FAR = "rgba(26, 28, 27, 0.60)";
const GROUND_LINE = "rgba(196, 200, 189, 0.45)";
const MAT_FILL = "rgba(232, 232, 230, 0.65)";

function normal(a: Point, b: Point): Point {
  const d = distance(a, b) || 1;
  return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
}

function strokeHairline(ctx: CanvasRenderingContext2D, points: readonly Point[], color: string, width = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * Renders an anatomical human limb silhouette with muscular curvature (quadriceps,
 * gastrocnemius calf belly, deltoid taper, forearm brachioradialis, and foot arch).
 */
function drawLimb(ctx: CanvasRenderingContext2D, chain: Chain, isLeg: boolean, isFar: boolean) {
  const [start, mid, end, tip] = chain;
  const color = isFar ? INK_FAR : INK_NEAR;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // Segment 1: Upper limb (thigh or upper arm)
  const n1 = normal(start, mid);
  const w1Start = isLeg ? 14 : 9.5;
  const w1Belly = isLeg ? 16.5 : 10.5;
  const w1Joint = isLeg ? 10.5 : 7.2;

  const belly1 = point(start, mid, 0.45);

  ctx.beginPath();
  ctx.moveTo(start[0] + n1[0] * w1Start * 0.5, start[1] + n1[1] * w1Start * 0.5);
  ctx.quadraticCurveTo(
    belly1[0] + n1[0] * w1Belly * 0.5,
    belly1[1] + n1[1] * w1Belly * 0.5,
    mid[0] + n1[0] * w1Joint * 0.5,
    mid[1] + n1[1] * w1Joint * 0.5,
  );
  ctx.arc(mid[0], mid[1], w1Joint * 0.5, 0, Math.PI * 2);
  ctx.moveTo(mid[0] - n1[0] * w1Joint * 0.5, mid[1] - n1[1] * w1Joint * 0.5);
  ctx.quadraticCurveTo(
    belly1[0] - n1[0] * (isLeg ? w1Belly * 0.42 : w1Belly * 0.5),
    belly1[1] - n1[1] * (isLeg ? w1Belly * 0.42 : w1Belly * 0.5),
    start[0] - n1[0] * w1Start * 0.5,
    start[1] - n1[1] * w1Start * 0.5,
  );
  ctx.closePath();
  ctx.fill();

  // Segment 2: Lower limb (calf or forearm)
  const n2 = normal(mid, end);
  const w2Joint = isLeg ? 10.5 : 7.2;
  const w2Calf = isLeg ? 12.8 : 8.2;
  const w2Ankle = isLeg ? 6.5 : 4.8;

  const belly2 = point(mid, end, 0.35);

  ctx.beginPath();
  ctx.moveTo(mid[0] + n2[0] * w2Joint * 0.5, mid[1] + n2[1] * w2Joint * 0.5);
  ctx.quadraticCurveTo(
    belly2[0] + n2[0] * w2Calf * 0.55,
    belly2[1] + n2[1] * w2Calf * 0.55,
    end[0] + n2[0] * w2Ankle * 0.5,
    end[1] + n2[1] * w2Ankle * 0.5,
  );
  ctx.lineTo(end[0] - n2[0] * w2Ankle * 0.5, end[1] - n2[1] * w2Ankle * 0.5);
  ctx.quadraticCurveTo(
    belly2[0] - n2[0] * w2Calf * 0.42,
    belly2[1] - n2[1] * w2Calf * 0.42,
    mid[0] - n2[0] * w2Joint * 0.5,
    mid[1] - n2[1] * w2Joint * 0.5,
  );
  ctx.closePath();
  ctx.fill();

  // Extremity: Foot or Hand
  if (isLeg) {
    // Foot with heel, plantar arch, and toe pad
    const toe = tip;
    const heel = point(toe, end, 1.35);
    const footVector = normal(heel, toe);

    ctx.beginPath();
    ctx.moveTo(heel[0] - footVector[0] * 1.5, heel[1] - footVector[1] * 1.5);
    ctx.lineTo(toe[0] - footVector[0] * 1.2, toe[1] - footVector[1] * 1.2);
    ctx.quadraticCurveTo(toe[0] + 2, toe[1] + 1, toe[0] + footVector[0] * 2, toe[1] + footVector[1] * 2);
    ctx.lineTo(end[0] + footVector[0] * 1.5, end[1] + footVector[1] * 1.5);
    ctx.closePath();
    ctx.fill();
  } else {
    // Hand with wrist taper and graceful fingers
    const fingers = tip;
    const handNorm = normal(end, fingers);

    ctx.beginPath();
    ctx.moveTo(end[0] + handNorm[0] * 2.2, end[1] + handNorm[1] * 2.2);
    ctx.lineTo(fingers[0] + handNorm[0] * 1.2, fingers[1] + handNorm[1] * 1.2);
    ctx.arc(fingers[0], fingers[1], 1.6, 0, Math.PI * 2);
    ctx.lineTo(end[0] - handNorm[0] * 2.2, end[1] - handNorm[1] * 2.2);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Renders the torso silhouette with natural ribcage expansion, waist narrowing,
 * and pelvic contours in pure sumi ink.
 */
function drawTorso(ctx: CanvasRenderingContext2D, pose: Pose) {
  const { shoulder: s, hip: h, curve: c } = pose;
  const d = distance(s, h) || 1;
  const nx = -(h[1] - s[1]) / d;
  const ny = (h[0] - s[0]) / d;

  const shoulderW = pose.front ? 17 : 13;
  const waistW = pose.front ? 11 : 9.5;
  const hipW = pose.front ? 14 : 11.5;

  ctx.fillStyle = INK_NEAR;
  ctx.beginPath();

  // Shoulder contour
  ctx.moveTo(s[0] + nx * shoulderW, s[1] + ny * shoulderW);
  // Chest / ribcage to waist
  ctx.quadraticCurveTo(c[0] + nx * 13.5, c[1] + ny * 13.5, h[0] + nx * hipW, h[1] + ny * hipW);
  // Pelvic base
  ctx.quadraticCurveTo(h[0], h[1] + 4, h[0] - nx * hipW, h[1] - ny * hipW);
  // Back / lumbar curve to shoulder
  ctx.quadraticCurveTo(c[0] - nx * waistW, c[1] - ny * waistW, s[0] - nx * shoulderW, s[1] - ny * shoulderW);
  // Clavicle arch
  ctx.quadraticCurveTo(s[0] - (h[0] - s[0]) * 0.1, s[1] - (h[1] - s[1]) * 0.1, s[0] + nx * shoulderW, s[1] + ny * shoulderW);

  ctx.closePath();
  ctx.fill();
}

/**
 * Renders the head silhouette with natural cervical cant and the classic yoga hair topknot.
 */
function drawHead(ctx: CanvasRenderingContext2D, pose: Pose) {
  const { head: h, shoulder: s, front } = pose;
  const neck = point(s, h, 0.48);

  ctx.fillStyle = INK_NEAR;
  ctx.strokeStyle = INK_NEAR;
  ctx.lineWidth = 6.8;
  ctx.lineCap = "round";

  // Neck stroke
  ctx.beginPath();
  ctx.moveTo(s[0], s[1]);
  ctx.lineTo(neck[0], neck[1]);
  ctx.lineTo(h[0], h[1]);
  ctx.stroke();

  const angle = Math.atan2(h[1] - s[1], h[0] - s[0]) + Math.PI / 2;

  ctx.save();
  ctx.translate(h[0], h[1]);
  ctx.rotate(front ? 0 : angle);

  // Cranium oval
  ctx.beginPath();
  ctx.ellipse(0, 0, front ? 8.2 : 7.6, 9.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Classic yoga chignon / topknot silhouette at the crown/back of head
  if (!front) {
    ctx.beginPath();
    ctx.arc(-6.5, -4.5, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Subtle jawline / facial silhouette profile
    ctx.beginPath();
    ctx.moveTo(4, -2.5);
    ctx.lineTo(8, 0.5);
    ctx.lineTo(4.5, 3);
    ctx.closePath();
    ctx.fill();
  } else {
    // Symmetrical topknot at top of cranium
    ctx.beginPath();
    ctx.arc(0, -9.5, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Renders minimalist, delicate equipment cues (mat hairline, pull-up bar, dip bars).
 */
function drawEquipment(ctx: CanvasRenderingContext2D, type: Equipment) {
  // Ground hairline shadow
  ctx.fillStyle = "rgba(26, 28, 27, 0.035)";
  ctx.beginPath();
  ctx.ellipse(160, 185, 78, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (type === "mat") {
    // Minimalist washi mat
    ctx.fillStyle = MAT_FILL;
    ctx.beginPath();
    ctx.roundRect(66, 180, 190, 3.5, 1.5);
    ctx.fill();
    strokeHairline(ctx, [[66, 180], [256, 180]], GROUND_LINE, 1);
  } else if (type === "uphill" || type === "downhill") {
    const slope = type === "uphill" ? -1 : 1;
    strokeHairline(ctx, [[68, 180 - slope * 9], [250, 180 + slope * 9]], GROUND_LINE, 1.5);
  } else {
    strokeHairline(ctx, [[74, 181], [246, 181]], GROUND_LINE, 1);
  }

  if (type === "bar" || type === "neutral-bar") {
    strokeHairline(ctx, [[97, 23], [223, 23]], INK_NEAR, 3);
    strokeHairline(ctx, [[97, 14], [97, 23]], GROUND_LINE, 1.5);
    strokeHairline(ctx, [[223, 14], [223, 23]], GROUND_LINE, 1.5);
    if (type === "neutral-bar") {
      strokeHairline(ctx, [[138, 20], [138, 30]], INK_NEAR, 3);
      strokeHairline(ctx, [[182, 20], [182, 30]], INK_NEAR, 3);
    }
  }

  if (type === "dip-bars") {
    strokeHairline(ctx, [[129, 181], [129, 108], [148, 108]], INK_NEAR, 3);
    strokeHairline(ctx, [[168, 181], [168, 108], [188, 108]], INK_NEAR, 3);
  }

  if (type === "bench") {
    ctx.fillStyle = MAT_FILL;
    ctx.beginPath();
    ctx.roundRect(71, 142, 39, 7, 2);
    ctx.fill();
    strokeHairline(ctx, [[77, 149], [77, 180]], GROUND_LINE, 2);
    strokeHairline(ctx, [[105, 149], [105, 180]], GROUND_LINE, 2);
  }

  if (type === "step") {
    ctx.fillStyle = MAT_FILL;
    ctx.beginPath();
    ctx.roundRect(215, 151, 33, 28, [2, 2, 0, 0]);
    ctx.fill();
    strokeHairline(ctx, [[215, 151], [248, 151]], GROUND_LINE, 2);
  }

  if (type === "wall") {
    strokeHairline(ctx, [[244, 29], [244, 181]], GROUND_LINE, 2);
    for (let y = 39; y < 179; y += 14) {
      strokeHairline(ctx, [[245, y], [251, y - 5]], GROUND_LINE, 1);
    }
  }
}

/**
 * Paints the complete, authentic Zen yoga silhouette on canvas with proper depth layering:
 * 1. Background equipment / ground
 * 2. Far leg (subtle depth ink)
 * 3. Far arm (subtle depth ink)
 * 4. Near leg (rich sumi ink)
 * 5. Torso (rich sumi ink)
 * 6. Head & neck (rich sumi ink)
 * 7. Near arm (rich sumi ink)
 */
export function paintZenSilhouette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  current: Scene,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();

  const scale = Math.min(width / 320, height / 200);
  ctx.translate((width - 320 * scale) / 2, (height - 200 * scale) / 2);
  ctx.scale(scale, scale);

  drawEquipment(ctx, current.equipment);

  const p = current.pose;

  // Layer 1: Far limbs with depth tone
  drawLimb(ctx, p.farLeg, true, true);
  drawLimb(ctx, p.farArm, false, true);

  // Layer 2: Near leg with primary ink
  drawLimb(ctx, p.nearLeg, true, false);

  // Layer 3: Torso and head
  drawTorso(ctx, p);
  drawHead(ctx, p);

  // Layer 4: Near arm
  drawLimb(ctx, p.nearArm, false, false);

  ctx.restore();
}
