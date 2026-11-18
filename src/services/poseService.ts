import { Landmark2D } from '../types/motion';
import { POSE_LANDMARKS } from '../utils/biomechanics';

declare global {
  interface Window {
    Pose?: any;
    Camera?: any;
  }
}

let poseInstance: any = null;
let isInitializing = false;

export function getActivePose(): any {
  return poseInstance || (window as any)._activePoseInstance || null;
}

export async function initMediaPipePose(
  onResultsCallback: (results: { poseLandmarks?: Landmark2D[]; image?: any }) => void
): Promise<any> {
  if (poseInstance) {
    poseInstance.onResults(onResultsCallback);
    (window as any)._activePoseInstance = poseInstance;
    return poseInstance;
  }

  // Ensure scripts are loaded
  if (!window.Pose) {
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
  }

  if (window.Pose) {
    const pose = new window.Pose({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 0, // Lite model: ultra-fast, loads in <1s, high fps tracking
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResultsCallback);
    poseInstance = pose;
    (window as any)._activePoseInstance = pose;
    return poseInstance;
  }

  throw new Error('MediaPipe Pose could not be initialized from CDN.');
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Generate procedural realistic squat kinematics for testing & demo purposes
 * Produces 60 frames (2 seconds @ 30fps) of a complete squat cycle
 */
export function generateSyntheticSquatTimeline(durationSec = 3, fps = 30): Landmark2D[][] {
  const totalFrames = Math.round(durationSec * fps);
  const frames: Landmark2D[][] = [];

  for (let i = 0; i < totalFrames; i++) {
    const t = i / totalFrames; // 0 to 1
    // Squat depth factor: 0 (standing) -> 1 (deep squat) -> 0 (standing)
    // using sine curve
    const phase = Math.sin(t * Math.PI); // 0 at t=0, 1 at t=0.5, 0 at t=1

    // Baseline coordinates (normalized 0..1)
    const headY = 0.18 + phase * 0.16;
    const shoulderY = 0.28 + phase * 0.18;
    const hipY = 0.52 + phase * 0.22;
    const kneeY = 0.72 + phase * 0.08;
    const ankleY = 0.90;

    // Hip shift backward slightly
    const hipXShift = phase * 0.04;

    const landmarks: Landmark2D[] = [];
    for (let j = 0; j < 33; j++) {
      landmarks.push({ x: 0.5, y: 0.5, visibility: 0.9 });
    }

    // Nose
    landmarks[POSE_LANDMARKS.NOSE] = { x: 0.5, y: headY, visibility: 0.98 };

    // Shoulders
    landmarks[POSE_LANDMARKS.LEFT_SHOULDER] = { x: 0.42, y: shoulderY, visibility: 0.98 };
    landmarks[POSE_LANDMARKS.RIGHT_SHOULDER] = { x: 0.58, y: shoulderY, visibility: 0.98 };

    // Elbows (forward counterbalance)
    landmarks[POSE_LANDMARKS.LEFT_ELBOW] = { x: 0.38 - phase * 0.03, y: shoulderY + 0.10, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_ELBOW] = { x: 0.62 + phase * 0.03, y: shoulderY + 0.10, visibility: 0.95 };

    // Wrists
    landmarks[POSE_LANDMARKS.LEFT_WRIST] = { x: 0.44, y: shoulderY + 0.04, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_WRIST] = { x: 0.56, y: shoulderY + 0.04, visibility: 0.95 };

    // Hips
    landmarks[POSE_LANDMARKS.LEFT_HIP] = { x: 0.44 - hipXShift, y: hipY, visibility: 0.98 };
    landmarks[POSE_LANDMARKS.RIGHT_HIP] = { x: 0.56 - hipXShift, y: hipY, visibility: 0.98 };

    // Knees (spread slightly outward in deep squat)
    const kneeSpread = phase * 0.03;
    landmarks[POSE_LANDMARKS.LEFT_KNEE] = { x: 0.42 - kneeSpread, y: kneeY, visibility: 0.98 };
    landmarks[POSE_LANDMARKS.RIGHT_KNEE] = { x: 0.58 + kneeSpread, y: kneeY, visibility: 0.98 };

    // Ankles
    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = { x: 0.43, y: ankleY, visibility: 0.98 };
    landmarks[POSE_LANDMARKS.RIGHT_ANKLE] = { x: 0.57, y: ankleY, visibility: 0.98 };

    // Feet
    landmarks[POSE_LANDMARKS.LEFT_FOOT_INDEX] = { x: 0.40, y: ankleY + 0.04, visibility: 0.95 };
    landmarks[POSE_LANDMARKS.RIGHT_FOOT_INDEX] = { x: 0.60, y: ankleY + 0.04, visibility: 0.95 };

    frames.push(landmarks);
  }

  return frames;
}
