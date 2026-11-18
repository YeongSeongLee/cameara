export interface UserProfile {
  id: string;
  email: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  height: number; // cm
  weight: number; // kg
  phone: string;
  createdAt: string;
}

export interface Landmark2D {
  x: number; // 0.0 - 1.0 (normalized)
  y: number; // 0.0 - 1.0 (normalized)
  z?: number;
  visibility?: number;
}

export interface CalibrationState {
  pointA: { x: number; y: number } | null; // pixel coords
  pointB: { x: number; y: number } | null; // pixel coords
  realDistanceCm: number; // e.g. 100cm
  scaleCmPerPx: number | null; // cm per pixel
  pixelDistance: number | null;
  isCalibrated: boolean;
}

export interface FrameBiomechanics {
  timestamp: number; // seconds
  frameIndex: number;
  angles: {
    leftElbow: number;
    rightElbow: number;
    leftShoulder: number;
    rightShoulder: number;
    leftHip: number;
    rightHip: number;
    leftKnee: number;
    rightKnee: number;
    trunkAngle: number;
  };
  velocities: {
    unit: 'cm/s' | 'px/s';
    leftWrist: number;
    rightWrist: number;
    leftKnee: number;
    rightKnee: number;
    leftAnkle: number;
    rightAnkle: number;
    comVelocity: number;
  };
  com: { x: number; y: number }; // normalized or pixel
  segmentLengths?: {
    unit: 'cm' | 'px';
    trunk: number;
    leftArm: number;
    rightArm: number;
    leftLeg: number;
    rightLeg: number;
  };
  landmarks?: Landmark2D[];
  frameWidth?: number;
  frameHeight?: number;
}

export interface JointSummaryMetric {
  name: string;
  label: string;
  currentAngle: number;
  minAngle: number;
  maxAngle: number;
  rom: number;
  averageAngle: number;
}

export interface VelocitySummaryMetric {
  joint: string;
  label: string;
  peakVelocity: number;
  avgVelocity: number;
  unit: 'cm/s' | 'px/s';
}

export interface BiomechanicsAggregate {
  durationSeconds: number;
  totalFrames: number;
  fps: number;
  joints: Record<string, JointSummaryMetric>;
  velocities: Record<string, VelocitySummaryMetric>;
  comSummary: {
    modelUsed: 'Dempster 1955 Anthropometric Model' | 'Mid-Hip Fallback';
    peakVelocity: number;
    avgVelocity: number;
    unit: 'cm/s' | 'px/s';
  };
  symmetry: {
    kneeRomDiffPct: number;
    hipRomDiffPct: number;
    elbowRomDiffPct: number;
    overallSymmetryScore: number; // 0 - 100
  };
  segmentLengths: {
    unit: 'cm' | 'px';
    trunk: number;
    leftArm: number;
    rightArm: number;
    leftLeg: number;
    rightLeg: number;
  };
  videoWidth?: number;
  videoHeight?: number;
  aspectRatio?: number;
}

export interface GeminiAnalysisFeedback {
  overview: string;
  movementPhases: {
    phase: string;
    description: string;
    score: number; // 1-10
  }[];
  kinematicsEvaluation: {
    joint: string;
    observation: string;
    status: 'good' | 'caution' | 'warning';
  }[];
  symmetryAssessment: {
    symmetryGrade: '우수 (A)' | '양호 (B)' | '불균형 주의 (C)' | '교정 필요 (D)';
    details: string;
  };
  injuryRisks: string[];
  correctiveActions: {
    title: string;
    exercise: string;
    target: string;
    frequency: string;
  }[];
  biomechanicalInsights: string;
  disclaimer: string;
}

export interface AnalysisRecord {
  id: string;
  userId: string;
  createdAt: string;
  title: string;
  mediaType: 'image' | 'video';
  calibration: CalibrationState;
  aggregate: BiomechanicsAggregate;
  timeline: FrameBiomechanics[];
  feedback?: GeminiAnalysisFeedback;
  thumbnailUrl?: string;
  videoDuration?: number;
  mediaUrl?: string;
  videoWidth?: number;
  videoHeight?: number;
  aspectRatio?: number;
}
