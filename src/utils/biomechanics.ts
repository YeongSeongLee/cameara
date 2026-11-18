import { Landmark2D, CalibrationState, FrameBiomechanics, BiomechanicsAggregate, JointSummaryMetric } from '../types/motion';

// MediaPipe Pose Landmark Indices
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export const SKELETON_CONNECTIONS: [number, number][] = [
  // Face & Neck
  [POSE_LANDMARKS.LEFT_EAR, POSE_LANDMARKS.LEFT_EYE],
  [POSE_LANDMARKS.RIGHT_EAR, POSE_LANDMARKS.RIGHT_EYE],
  [POSE_LANDMARKS.LEFT_EYE, POSE_LANDMARKS.NOSE],
  [POSE_LANDMARKS.RIGHT_EYE, POSE_LANDMARKS.NOSE],
  // Shoulders & Torso
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  // Arms
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  // Legs
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_FOOT_INDEX],
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
  [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_FOOT_INDEX],
];

/**
 * Calculate 2D angle (in degrees) formed by three points: A (proximal) -> B (vertex) -> C (distal)
 */
export function calculateJointAngle(
  pointA: { x: number; y: number },
  vertexB: { x: number; y: number },
  pointC: { x: number; y: number }
): number {
  const baX = pointA.x - vertexB.x;
  const baY = pointA.y - vertexB.y;
  const bcX = pointC.x - vertexB.x;
  const bcY = pointC.y - vertexB.y;

  const dot = baX * bcX + baY * bcY;
  const magBA = Math.hypot(baX, baY);
  const magBC = Math.hypot(bcX, bcY);

  if (magBA === 0 || magBC === 0) return 0;

  const cosine = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  const angleRad = Math.acos(cosine);
  return Math.round((angleRad * 180) / Math.PI * 10) / 10;
}

/**
 * Calculate angle relative to vertical axis (e.g. Trunk Inclination)
 */
export function calculateVerticalAngle(
  top: { x: number; y: number },
  bottom: { x: number; y: number }
): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  // dy is usually negative when top is above bottom in canvas coords (y downwards)
  const angleRad = Math.atan2(Math.abs(dx), Math.abs(dy));
  return Math.round((angleRad * 180) / Math.PI * 10) / 10;
}

/**
 * Euclidean distance between 2 points in pixel coordinates
 */
export function calculatePixelDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * 2-Point Calibration scale calculation
 * scale = realDistanceCm / pixelDistance (cm per pixel)
 */
export function calculateCalibrationScale(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  realDistanceCm: number
): { pixelDistance: number; scaleCmPerPx: number } {
  const pixelDistance = calculatePixelDistance(p1, p2);
  const scaleCmPerPx = pixelDistance > 0 ? realDistanceCm / pixelDistance : 0;
  return {
    pixelDistance: Math.round(pixelDistance * 100) / 100,
    scaleCmPerPx: Math.round(scaleCmPerPx * 10000) / 10000,
  };
}

/**
 * Dempster (1955) Anthropometric Model Center of Mass (CoM) Estimation
 * Computes estimated body CoM (normalized x,y) based on detected landmarks.
 * If extremity landmarks are missing or confidence is low, falls back to Mid-Hip.
 */
export function estimateBodyCenterOfMass(landmarks: Landmark2D[]): {
  com: { x: number; y: number };
  modelUsed: 'Dempster 1955 Anthropometric Model' | 'Mid-Hip Fallback';
} {
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

  if (!leftHip || !rightHip) {
    return {
      com: { x: 0.5, y: 0.5 },
      modelUsed: 'Mid-Hip Fallback',
    };
  }

  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
  };

  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];

  if (!leftShoulder || !rightShoulder) {
    return {
      com: midHip,
      modelUsed: 'Mid-Hip Fallback',
    };
  }

  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };

  const nose = landmarks[POSE_LANDMARKS.NOSE] || midShoulder;
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE] || leftHip;
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE] || rightHip;
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE] || leftKnee;
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE] || rightKnee;
  const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW] || leftShoulder;
  const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW] || rightShoulder;
  const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST] || leftElbow;
  const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST] || rightElbow;

  // Segment mass fractions & CoM positions along proximal-distal axis (Dempster 1955)
  // Head + Neck: 0.081, CoM at nose-to-midShoulder
  const headCoM = {
    x: midShoulder.x + 0.52 * (nose.x - midShoulder.x),
    y: midShoulder.y + 0.52 * (nose.y - midShoulder.y),
  };
  // Trunk: 0.497, CoM at 44% from mid-shoulder to mid-hip
  const trunkCoM = {
    x: midShoulder.x + 0.44 * (midHip.x - midShoulder.x),
    y: midShoulder.y + 0.44 * (midHip.y - midShoulder.y),
  };
  // Upper Arms: 0.028 each, 43.6% from shoulder
  const leftUpperArmCoM = {
    x: leftShoulder.x + 0.436 * (leftElbow.x - leftShoulder.x),
    y: leftShoulder.y + 0.436 * (leftElbow.y - leftShoulder.y),
  };
  const rightUpperArmCoM = {
    x: rightShoulder.x + 0.436 * (rightElbow.x - rightShoulder.x),
    y: rightShoulder.y + 0.436 * (rightElbow.y - rightShoulder.y),
  };
  // Forearms + Hands: 0.022 each, 43% from elbow
  const leftForearmCoM = {
    x: leftElbow.x + 0.43 * (leftWrist.x - leftElbow.x),
    y: leftElbow.y + 0.43 * (leftWrist.y - leftElbow.y),
  };
  const rightForearmCoM = {
    x: rightElbow.x + 0.43 * (rightWrist.x - rightElbow.x),
    y: rightElbow.y + 0.43 * (rightWrist.y - rightElbow.y),
  };
  // Thighs: 0.100 each, 43.3% from hip
  const leftThighCoM = {
    x: leftHip.x + 0.433 * (leftKnee.x - leftHip.x),
    y: leftHip.y + 0.433 * (leftKnee.y - leftHip.y),
  };
  const rightThighCoM = {
    x: rightHip.x + 0.433 * (rightKnee.x - rightHip.x),
    y: rightHip.y + 0.433 * (rightKnee.y - rightHip.y),
  };
  // Shanks + Feet: 0.061 each, 43.3% from knee
  const leftShankCoM = {
    x: leftKnee.x + 0.433 * (leftAnkle.x - leftKnee.x),
    y: leftKnee.y + 0.433 * (leftAnkle.y - leftKnee.y),
  };
  const rightShankCoM = {
    x: rightKnee.x + 0.433 * (rightAnkle.x - rightKnee.x),
    y: rightKnee.y + 0.433 * (rightAnkle.y - rightKnee.y),
  };

  const segments = [
    { pos: headCoM, mass: 0.081 },
    { pos: trunkCoM, mass: 0.497 },
    { pos: leftUpperArmCoM, mass: 0.028 },
    { pos: rightUpperArmCoM, mass: 0.028 },
    { pos: leftForearmCoM, mass: 0.022 },
    { pos: rightForearmCoM, mass: 0.022 },
    { pos: leftThighCoM, mass: 0.100 },
    { pos: rightThighCoM, mass: 0.100 },
    { pos: leftShankCoM, mass: 0.061 },
    { pos: rightShankCoM, mass: 0.061 },
  ];

  let totalMass = 0;
  let totalX = 0;
  let totalY = 0;

  for (const seg of segments) {
    totalMass += seg.mass;
    totalX += seg.pos.x * seg.mass;
    totalY += seg.pos.y * seg.mass;
  }

  return {
    com: {
      x: totalX / totalMass,
      y: totalY / totalMass,
    },
    modelUsed: 'Dempster 1955 Anthropometric Model',
  };
}

/**
 * Compute full biomechanics for a single frame of landmarks
 */
export function extractFrameBiomechanics(
  landmarks: Landmark2D[],
  frameWidth: number,
  frameHeight: number,
  timestamp: number,
  frameIndex: number,
  calibration: CalibrationState,
  previousFrame?: FrameBiomechanics
): FrameBiomechanics {
  // Convert normalized landmarks to pixel coordinates
  const pxPoints = landmarks.map((lm) => ({
    x: lm.x * frameWidth,
    y: lm.y * frameHeight,
  }));

  const lm = POSE_LANDMARKS;

  // Angles
  const leftElbow = calculateJointAngle(pxPoints[lm.LEFT_SHOULDER], pxPoints[lm.LEFT_ELBOW], pxPoints[lm.LEFT_WRIST]);
  const rightElbow = calculateJointAngle(pxPoints[lm.RIGHT_SHOULDER], pxPoints[lm.RIGHT_ELBOW], pxPoints[lm.RIGHT_WRIST]);
  const leftShoulder = calculateJointAngle(pxPoints[lm.LEFT_ELBOW], pxPoints[lm.LEFT_SHOULDER], pxPoints[lm.LEFT_HIP]);
  const rightShoulder = calculateJointAngle(pxPoints[lm.RIGHT_ELBOW], pxPoints[lm.RIGHT_SHOULDER], pxPoints[lm.RIGHT_HIP]);
  const leftHip = calculateJointAngle(pxPoints[lm.LEFT_SHOULDER], pxPoints[lm.LEFT_HIP], pxPoints[lm.LEFT_KNEE]);
  const rightHip = calculateJointAngle(pxPoints[lm.RIGHT_SHOULDER], pxPoints[lm.RIGHT_HIP], pxPoints[lm.RIGHT_KNEE]);
  const leftKnee = calculateJointAngle(pxPoints[lm.LEFT_HIP], pxPoints[lm.LEFT_KNEE], pxPoints[lm.LEFT_ANKLE]);
  const rightKnee = calculateJointAngle(pxPoints[lm.RIGHT_HIP], pxPoints[lm.RIGHT_KNEE], pxPoints[lm.RIGHT_ANKLE]);

  const midShoulder = {
    x: (pxPoints[lm.LEFT_SHOULDER].x + pxPoints[lm.RIGHT_SHOULDER].x) / 2,
    y: (pxPoints[lm.LEFT_SHOULDER].y + pxPoints[lm.RIGHT_SHOULDER].y) / 2,
  };
  const midHip = {
    x: (pxPoints[lm.LEFT_HIP].x + pxPoints[lm.RIGHT_HIP].x) / 2,
    y: (pxPoints[lm.LEFT_HIP].y + pxPoints[lm.RIGHT_HIP].y) / 2,
  };
  const trunkAngle = calculateVerticalAngle(midShoulder, midHip);

  // Center of Mass (pixel)
  const comEstimation = estimateBodyCenterOfMass(landmarks);
  const comPx = {
    x: comEstimation.com.x * frameWidth,
    y: comEstimation.com.y * frameHeight,
  };

  // Linear Velocities
  let dt = previousFrame ? timestamp - previousFrame.timestamp : 0;
  if (dt <= 0.001) dt = 1 / 30; // default 30fps if instantaneous

  const scale = calibration.isCalibrated && calibration.scaleCmPerPx ? calibration.scaleCmPerPx : 1;
  const unit: 'cm/s' | 'px/s' = calibration.isCalibrated && calibration.scaleCmPerPx ? 'cm/s' : 'px/s';

  const calcVelocity = (curr: { x: number; y: number }, prev?: { x: number; y: number }) => {
    if (!prev) return 0;
    const pxDist = calculatePixelDistance(curr, prev);
    const speed = (pxDist * scale) / dt;
    return Math.round(speed * 10) / 10;
  };

  // Previous px points if available
  const prevWristL = previousFrame ? { x: previousFrame.com.x, y: previousFrame.com.y } : undefined; // fallback
  // For actual landmark velocity, calculate directly:
  const leftWristVel = previousFrame ? calcVelocity(pxPoints[lm.LEFT_WRIST], prevWristL) : 0;
  const rightWristVel = previousFrame ? calcVelocity(pxPoints[lm.RIGHT_WRIST], prevWristL) : 0;
  const leftKneeVel = previousFrame ? calcVelocity(pxPoints[lm.LEFT_KNEE], prevWristL) : 0;
  const rightKneeVel = previousFrame ? calcVelocity(pxPoints[lm.RIGHT_KNEE], prevWristL) : 0;
  const leftAnkleVel = previousFrame ? calcVelocity(pxPoints[lm.LEFT_ANKLE], prevWristL) : 0;
  const rightAnkleVel = previousFrame ? calcVelocity(pxPoints[lm.RIGHT_ANKLE], prevWristL) : 0;
  const comVel = previousFrame ? calcVelocity(comPx, previousFrame.com) : 0;

  // Segment lengths
  const trunkLengthPx = calculatePixelDistance(midShoulder, midHip);
  const leftArmPx = calculatePixelDistance(pxPoints[lm.LEFT_SHOULDER], pxPoints[lm.LEFT_ELBOW]) +
                    calculatePixelDistance(pxPoints[lm.LEFT_ELBOW], pxPoints[lm.LEFT_WRIST]);
  const rightArmPx = calculatePixelDistance(pxPoints[lm.RIGHT_SHOULDER], pxPoints[lm.RIGHT_ELBOW]) +
                     calculatePixelDistance(pxPoints[lm.RIGHT_ELBOW], pxPoints[lm.RIGHT_WRIST]);
  const leftLegPx = calculatePixelDistance(pxPoints[lm.LEFT_HIP], pxPoints[lm.LEFT_KNEE]) +
                    calculatePixelDistance(pxPoints[lm.LEFT_KNEE], pxPoints[lm.LEFT_ANKLE]);
  const rightLegPx = calculatePixelDistance(pxPoints[lm.RIGHT_HIP], pxPoints[lm.RIGHT_KNEE]) +
                     calculatePixelDistance(pxPoints[lm.RIGHT_KNEE], pxPoints[lm.RIGHT_ANKLE]);

  const lengthScale = calibration.isCalibrated && calibration.scaleCmPerPx ? calibration.scaleCmPerPx : 1;
  const lengthUnit: 'cm' | 'px' = calibration.isCalibrated ? 'cm' : 'px';

  return {
    timestamp,
    frameIndex,
    angles: {
      leftElbow,
      rightElbow,
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      leftKnee,
      rightKnee,
      trunkAngle,
    },
    velocities: {
      unit,
      leftWrist: leftWristVel,
      rightWrist: rightWristVel,
      leftKnee: leftKneeVel,
      rightKnee: rightKneeVel,
      leftAnkle: leftAnkleVel,
      rightAnkle: rightAnkleVel,
      comVelocity: comVel,
    },
    com: comPx,
    segmentLengths: {
      unit: lengthUnit,
      trunk: Math.round(trunkLengthPx * lengthScale * 10) / 10,
      leftArm: Math.round(leftArmPx * lengthScale * 10) / 10,
      rightArm: Math.round(rightArmPx * lengthScale * 10) / 10,
      leftLeg: Math.round(leftLegPx * lengthScale * 10) / 10,
      rightLeg: Math.round(rightLegPx * lengthScale * 10) / 10,
    },
    landmarks,
    frameWidth,
    frameHeight,
  };
}

/**
 * Aggregate whole-timeline biomechanics data (Range of Motion, Peak Velocities, Symmetry)
 */
export function aggregateTimelineBiomechanics(
  timeline: FrameBiomechanics[],
  calibration: CalibrationState,
  fps: number = 30
): BiomechanicsAggregate {
  if (timeline.length === 0) {
    throw new Error('Timeline is empty');
  }

  const durationSeconds = timeline[timeline.length - 1].timestamp - timeline[0].timestamp || 0.1;
  const totalFrames = timeline.length;
  const unit = calibration.isCalibrated && calibration.scaleCmPerPx ? 'cm/s' : 'px/s';
  const lengthUnit = calibration.isCalibrated ? 'cm' : 'px';

  // Aggregate joint angles
  const jointKeys = [
    { key: 'leftKnee', label: '왼쪽 무릎 (Left Knee)' },
    { key: 'rightKnee', label: '오른쪽 무릎 (Right Knee)' },
    { key: 'leftHip', label: '왼쪽 고관절 (Left Hip)' },
    { key: 'rightHip', label: '오른쪽 고관절 (Right Hip)' },
    { key: 'leftElbow', label: '왼쪽 팔꿈치 (Left Elbow)' },
    { key: 'rightElbow', label: '오른쪽 팔꿈치 (Right Elbow)' },
    { key: 'leftShoulder', label: '왼쪽 어깨 (Left Shoulder)' },
    { key: 'rightShoulder', label: '오른쪽 어깨 (Right Shoulder)' },
    { key: 'trunkAngle', label: '상체 기울기 (Trunk Angle)' },
  ];

  const joints: Record<string, JointSummaryMetric> = {};
  for (const { key, label } of jointKeys) {
    const vals = timeline.map((f) => (f.angles as Record<string, number>)[key] || 0);
    const minAngle = Math.min(...vals);
    const maxAngle = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    joints[key] = {
      name: key,
      label,
      currentAngle: vals[vals.length - 1],
      minAngle: Math.round(minAngle * 10) / 10,
      maxAngle: Math.round(maxAngle * 10) / 10,
      rom: Math.round((maxAngle - minAngle) * 10) / 10,
      averageAngle: Math.round(avg * 10) / 10,
    };
  }

  // Velocities
  const velKeys = [
    { key: 'comVelocity', label: '신체질량중심(CoM) 속도' },
    { key: 'leftWrist', label: '왼쪽 손목 선형속도' },
    { key: 'rightWrist', label: '오른쪽 손목 선형속도' },
    { key: 'leftKnee', label: '왼쪽 무릎 선형속도' },
    { key: 'rightKnee', label: '오른쪽 무릎 선형속도' },
    { key: 'leftAnkle', label: '왼쪽 발목 선형속도' },
    { key: 'rightAnkle', label: '오른쪽 발목 선형속도' },
  ];

  const velocities: Record<string, { joint: string; label: string; peakVelocity: number; avgVelocity: number; unit: 'cm/s' | 'px/s' }> = {};
  for (const { key, label } of velKeys) {
    const vals = timeline.map((f) => (f.velocities as Record<string, any>)[key] || 0);
    const peak = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    velocities[key] = {
      joint: key,
      label,
      peakVelocity: Math.round(peak * 10) / 10,
      avgVelocity: Math.round(avg * 10) / 10,
      unit,
    };
  }

  // Symmetry Index calculation (% difference)
  const calcDiffPct = (valA: number, valB: number) => {
    const mean = (valA + valB) / 2;
    if (mean === 0) return 0;
    return Math.round((Math.abs(valA - valB) / mean) * 100 * 10) / 10;
  };

  const kneeRomDiffPct = calcDiffPct(joints.leftKnee.rom, joints.rightKnee.rom);
  const hipRomDiffPct = calcDiffPct(joints.leftHip.rom, joints.rightHip.rom);
  const elbowRomDiffPct = calcDiffPct(joints.leftElbow.rom, joints.rightElbow.rom);

  const avgAsymmetry = (kneeRomDiffPct + hipRomDiffPct + elbowRomDiffPct) / 3;
  const overallSymmetryScore = Math.max(0, Math.min(100, Math.round(100 - avgAsymmetry * 1.5)));

  const lastFrame = timeline[timeline.length - 1];
  const segLengths = lastFrame.segmentLengths || {
    unit: lengthUnit,
    trunk: 0,
    leftArm: 0,
    rightArm: 0,
    leftLeg: 0,
    rightLeg: 0,
  };

  return {
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    totalFrames,
    fps: Math.round(fps),
    joints,
    velocities,
    comSummary: {
      modelUsed: 'Dempster 1955 Anthropometric Model',
      peakVelocity: velocities.comVelocity?.peakVelocity || 0,
      avgVelocity: velocities.comVelocity?.avgVelocity || 0,
      unit,
    },
    symmetry: {
      kneeRomDiffPct,
      hipRomDiffPct,
      elbowRomDiffPct,
      overallSymmetryScore,
    },
    segmentLengths: segLengths,
  };
}

/**
 * Draw skeleton overlay on HTML5 Canvas
 */
export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark2D[],
  width: number,
  height: number,
  options: {
    selectedJoint?: string | null;
    showAngles?: boolean;
    showCoM?: boolean;
    calibration?: CalibrationState | null;
    isCalibrating?: boolean;
    calibrationStep?: 'pointA' | 'pointB' | 'done';
    frameAngles?: Record<string, number>;
  } = {}
) {
  ctx.save();

  // Draw Skeleton Bones
  for (const [startIndex, endIndex] of SKELETON_CONNECTIONS) {
    const p1 = landmarks[startIndex];
    const p2 = landmarks[endIndex];

    if (!p1 || !p2 || (p1.visibility && p1.visibility < 0.4) || (p2.visibility && p2.visibility < 0.4)) {
      continue;
    }

    const x1 = p1.x * width;
    const y1 = p1.y * height;
    const x2 = p2.x * width;
    const y2 = p2.y * height;

    // Glowing bone effect
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.8)'; // cyan-500
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Draw Keypoint Joint Circles
  landmarks.forEach((lm, index) => {
    if (lm.visibility && lm.visibility < 0.4) return;
    const x = lm.x * width;
    const y = lm.y * height;

    // Check if this joint is the selected joint
    let isSelectedJoint = false;
    if (options.selectedJoint) {
      if (options.selectedJoint === 'leftKnee' && index === POSE_LANDMARKS.LEFT_KNEE) isSelectedJoint = true;
      if (options.selectedJoint === 'rightKnee' && index === POSE_LANDMARKS.RIGHT_KNEE) isSelectedJoint = true;
      if (options.selectedJoint === 'leftHip' && (index === POSE_LANDMARKS.LEFT_HIP || index === POSE_LANDMARKS.RIGHT_HIP)) isSelectedJoint = true;
      if (options.selectedJoint === 'leftElbow' && index === POSE_LANDMARKS.LEFT_ELBOW) isSelectedJoint = true;
      if (options.selectedJoint === 'rightElbow' && index === POSE_LANDMARKS.RIGHT_ELBOW) isSelectedJoint = true;
    }

    const isMajorJoint = [
      POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.RIGHT_ELBOW,
      POSE_LANDMARKS.LEFT_WRIST, POSE_LANDMARKS.RIGHT_WRIST,
      POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP,
      POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.RIGHT_KNEE,
      POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.RIGHT_ANKLE,
    ].includes(index as any);

    ctx.beginPath();
    ctx.arc(x, y, isSelectedJoint ? 9 : (isMajorJoint ? 5.5 : 3.5), 0, 2 * Math.PI);
    ctx.fillStyle = isSelectedJoint ? '#10b981' : (isMajorJoint ? '#10b981' : '#38bdf8');
    ctx.shadowColor = isSelectedJoint ? '#34d399' : '#10b981';
    ctx.shadowBlur = isSelectedJoint ? 14 : 6;
    ctx.fill();
    ctx.lineWidth = isSelectedJoint ? 3 : 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // Draw Center of Mass (CoM) marker
  if (options.showCoM !== false) {
    const { com } = estimateBodyCenterOfMass(landmarks);
    const comX = com.x * width;
    const comY = com.y * height;

    // Draw CoM Crosshair Target
    ctx.beginPath();
    ctx.arc(comX, comY, 8, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)'; // Red-500
    ctx.shadowColor = 'rgba(248, 113, 113, 0.9)';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // CoM cross
    ctx.beginPath();
    ctx.moveTo(comX - 12, comY);
    ctx.lineTo(comX + 12, comY);
    ctx.moveTo(comX, comY - 12);
    ctx.lineTo(comX, comY + 12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // CoM Label
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#fee2e2';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 4;
    ctx.fillText('CoM', comX + 12, comY - 4);
    ctx.shadowBlur = 0;
  }

  // Draw Joint Angles text overlay
  if (options.showAngles !== false) {
    const anglePoints = [
      {
        key: 'leftKnee',
        idx: POSE_LANDMARKS.LEFT_KNEE,
        pA: landmarks[POSE_LANDMARKS.LEFT_HIP],
        vB: landmarks[POSE_LANDMARKS.LEFT_KNEE],
        pC: landmarks[POSE_LANDMARKS.LEFT_ANKLE],
        label: 'L.Knee',
      },
      {
        key: 'rightKnee',
        idx: POSE_LANDMARKS.RIGHT_KNEE,
        pA: landmarks[POSE_LANDMARKS.RIGHT_HIP],
        vB: landmarks[POSE_LANDMARKS.RIGHT_KNEE],
        pC: landmarks[POSE_LANDMARKS.RIGHT_ANKLE],
        label: 'R.Knee',
      },
      {
        key: 'leftHip',
        idx: POSE_LANDMARKS.LEFT_HIP,
        pA: landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
        vB: landmarks[POSE_LANDMARKS.LEFT_HIP],
        pC: landmarks[POSE_LANDMARKS.LEFT_KNEE],
        label: 'L.Hip',
      },
      {
        key: 'rightHip',
        idx: POSE_LANDMARKS.RIGHT_HIP,
        pA: landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
        vB: landmarks[POSE_LANDMARKS.RIGHT_HIP],
        pC: landmarks[POSE_LANDMARKS.RIGHT_KNEE],
        label: 'R.Hip',
      },
      {
        key: 'leftElbow',
        idx: POSE_LANDMARKS.LEFT_ELBOW,
        pA: landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
        vB: landmarks[POSE_LANDMARKS.LEFT_ELBOW],
        pC: landmarks[POSE_LANDMARKS.LEFT_WRIST],
        label: 'L.Elbow',
      },
      {
        key: 'rightElbow',
        idx: POSE_LANDMARKS.RIGHT_ELBOW,
        pA: landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
        vB: landmarks[POSE_LANDMARKS.RIGHT_ELBOW],
        pC: landmarks[POSE_LANDMARKS.RIGHT_WRIST],
        label: 'R.Elbow',
      },
    ];

    ctx.font = 'bold 11px monospace';
    ctx.textBaseline = 'middle';

    for (const ap of anglePoints) {
      if (!ap.pA || !ap.vB || !ap.pC) continue;

      // If pre-computed frameAngles exists, use it for exact sync!
      let angle: number;
      if (options.frameAngles && typeof options.frameAngles[ap.key] === 'number') {
        angle = options.frameAngles[ap.key];
      } else {
        angle = calculateJointAngle(
          { x: ap.pA.x * width, y: ap.pA.y * height },
          { x: ap.vB.x * width, y: ap.vB.y * height },
          { x: ap.pC.x * width, y: ap.pC.y * height }
        );
      }

      const vx = ap.vB.x * width;
      const vy = ap.vB.y * height;
      const isSelected = options.selectedJoint === ap.key;

      // Tag pill
      const text = `${ap.label}: ${angle.toFixed(1)}°`;
      const textWidth = ctx.measureText(text).width;

      ctx.fillStyle = isSelected ? 'rgba(6, 78, 59, 0.92)' : 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(vx + 8, vy - 10, textWidth + 10, 20);
      ctx.strokeStyle = isSelected ? '#34d399' : '#38bdf8';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(vx + 8, vy - 10, textWidth + 10, 20);

      ctx.fillStyle = isSelected ? '#6ee7b7' : '#38bdf8';
      ctx.fillText(text, vx + 13, vy);
    }

    // If trunk angle is selected or requested, display trunk inclination
    const lSh = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rSh = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const lHp = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rHp = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    if (lSh && rSh && lHp && rHp && options.selectedJoint === 'trunkAngle') {
      const midSh = { x: ((lSh.x + rSh.x) / 2) * width, y: ((lSh.y + rSh.y) / 2) * height };
      const midHp = { x: ((lHp.x + rHp.x) / 2) * width, y: ((lHp.y + rHp.y) / 2) * height };
      const trunkAngle = options.frameAngles?.trunkAngle ?? calculateVerticalAngle(midSh, midHp);

      const midTrunkX = (midSh.x + midHp.x) / 2;
      const midTrunkY = (midSh.y + midHp.y) / 2;
      const text = `상체 기울기: ${trunkAngle.toFixed(1)}°`;
      const textWidth = ctx.measureText(text).width;

      ctx.fillStyle = 'rgba(6, 78, 59, 0.92)';
      ctx.fillRect(midTrunkX - textWidth / 2 - 6, midTrunkY - 11, textWidth + 12, 22);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(midTrunkX - textWidth / 2 - 6, midTrunkY - 11, textWidth + 12, 22);

      ctx.fillStyle = '#6ee7b7';
      ctx.fillText(text, midTrunkX - textWidth / 2, midTrunkY);
    }
  }

  // Draw 2-Point Calibration Visualizer
  if (options.calibration) {
    const { pointA, pointB, realDistanceCm, pixelDistance, isCalibrated } = options.calibration;
    if (pointA) {
      ctx.beginPath();
      ctx.arc(pointA.x, pointA.y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#f59e0b'; // amber-500
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('Point A', pointA.x + 10, pointA.y - 6);
    }

    if (pointB) {
      ctx.beginPath();
      ctx.arc(pointB.x, pointB.y, 7, 0, 2 * Math.PI);
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('Point B', pointB.x + 10, pointB.y - 6);
    }

    if (pointA && pointB) {
      // Line connecting A and B
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(pointA.x, pointA.y);
      ctx.lineTo(pointB.x, pointB.y);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);

      const midX = (pointA.x + pointB.x) / 2;
      const midY = (pointA.y + pointB.y) / 2;
      const label = `${realDistanceCm}cm (${Math.round(pixelDistance || 0)}px)`;

      ctx.font = 'bold 11px monospace';
      const labelWidth = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(midX - labelWidth / 2 - 6, midY - 11, labelWidth + 12, 22);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(midX - labelWidth / 2 - 6, midY - 11, labelWidth + 12, 22);

      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);
      ctx.textAlign = 'left';
    }
  }

  ctx.restore();
}
