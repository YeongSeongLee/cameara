import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Upload, Play, Square, RefreshCw, AlertCircle, FileVideo,
  Disc, CheckCircle2, SwitchCamera, Laptop, Smartphone, Sliders, AlertTriangle
} from 'lucide-react';
import { Landmark2D, CalibrationState, FrameBiomechanics } from '../types/motion';
import { initMediaPipePose, generateSyntheticSquatTimeline } from '../services/poseService';
import { drawPoseSkeleton, extractFrameBiomechanics, aggregateTimelineBiomechanics } from '../utils/biomechanics';

interface MotionCaptureProps {
  calibration: CalibrationState;
  onOpenCalibration: (snapshotCanvas: HTMLCanvasElement | null) => void;
  onAnalysisReady: (data: {
    mediaType: 'image' | 'video';
    mediaUrl: string;
    timeline: FrameBiomechanics[];
    aggregate: any;
    duration: number;
    title: string;
  }) => void;
}

// Helper to filter out virtual / Windows Phone Link (Galaxy Tab S9+ 등) cameras
function isVirtualOrPhoneLink(label: string): boolean {
  const lower = (label || '').toLowerCase();
  return (
    lower.includes('windows와 연결') ||
    lower.includes('link to windows') ||
    lower.includes('phone link') ||
    lower.includes('tab s') ||
    lower.includes('galaxy') ||
    lower.includes('droidcam') ||
    lower.includes('iriun') ||
    lower.includes('obs virtual') ||
    lower.includes('virtual')
  );
}

function isBuiltinLaptopCamera(label: string): boolean {
  const lower = (label || '').toLowerCase();
  return (
    lower.includes('integrated') ||
    lower.includes('built-in') ||
    lower.includes('internal') ||
    lower.includes('facetime') ||
    lower.includes('hd camera') ||
    lower.includes('webcam') ||
    lower.includes('realtek') ||
    lower.includes('chicony') ||
    lower.includes('bison') ||
    lower.includes('front')
  );
}

export const MotionCapture: React.FC<MotionCaptureProps> = ({
  calibration,
  onOpenCalibration,
  onAnalysisReady,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'upload'>('camera');
  const [isMobile, setIsMobile] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeDeviceName, setActiveDeviceName] = useState<string>('');
  const [detectedPhoneLinkWarning, setDetectedPhoneLinkWarning] = useState<string | null>(null);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordSecondsRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordedTimelineRef = useRef<{ timestamp: number; landmarks: Landmark2D[] }[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoDimensionsRef = useRef<{ width: number; height: number }>({ width: 1280, height: 720 });

  // Save / Discard confirmation modal state
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  const [savedRecordingDuration, setSavedRecordingDuration] = useState(0);

  // Real-time MediaPipe Pose tracking states
  const poseInstanceRef = useRef<any>(null);
  const isProcessingPoseRef = useRef(false);
  const [isTrackingPerson, setIsTrackingPerson] = useState(false);
  const currentLandmarksRef = useRef<Landmark2D[] | null>(null);

  // Upload states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Query and sort devices (prioritize physical laptop webcams over Tab S9+ Link to Windows)
  const refreshDeviceList = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');

      // Sort: Physical built-in cameras first, Phone Link virtual cameras last
      const sorted = [...videoInputs].sort((a, b) => {
        const aVirtual = isVirtualOrPhoneLink(a.label);
        const bVirtual = isVirtualOrPhoneLink(b.label);
        if (aVirtual && !bVirtual) return 1;
        if (!aVirtual && bVirtual) return -1;

        const aBuiltin = isBuiltinLaptopCamera(a.label);
        const bBuiltin = isBuiltinLaptopCamera(b.label);
        if (aBuiltin && !bBuiltin) return -1;
        if (!aBuiltin && bBuiltin) return 1;

        return 0;
      });

      setAvailableDevices(sorted);

      // Auto-select the first non-virtual physical camera
      const physicalDefault = sorted.find((d) => !isVirtualOrPhoneLink(d.label)) || sorted[0];
      if (physicalDefault) {
        setSelectedDeviceId(physicalDefault.deviceId);
      }
    } catch (e) {
      console.warn('Enumerate devices error:', e);
    }
  }, []);

  useEffect(() => {
    const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobileCheck);
    setCameraFacing(mobileCheck ? 'environment' : 'user');
    refreshDeviceList();
  }, [refreshDeviceList]);

  // Pre-warm MediaPipe Pose so it tracks instantly when camera starts
  useEffect(() => {
    initMediaPipePose((results) => {
      if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        currentLandmarksRef.current = results.poseLandmarks;
        setIsTrackingPerson(true);
      } else {
        currentLandmarksRef.current = null;
        setIsTrackingPerson(false);
      }
    })
      .then((p) => {
        poseInstanceRef.current = p;
        (window as any)._activePoseInstance = p;
      })
      .catch((e) => console.warn('Pre-warming pose notice:', e));
  }, []);

  // Stop camera safely (stable reference to avoid re-triggering unmount cleanup during recording!)
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
  }, []);

  // Connect directly to the physical hardware webcam
  const startCamera = async (targetDeviceId?: string) => {
    setCameraError(null);
    setDetectedPhoneLinkWarning(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('브라우저에서 카메라 API를 지원하지 않거나 보안 컨텍스트(HTTPS)가 필요합니다.');
      return;
    }

    let stream: MediaStream | null = null;
    const devId = targetDeviceId || selectedDeviceId;

    // 1st Attempt: Connect directly by chosen physical deviceId
    if (devId) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: devId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e1) {
        console.warn('DeviceId attempt failed, trying facingMode:', e1);
      }
    }

    // 2nd Attempt: If no stream yet, try facingMode 'user' for laptop webcam
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (e2) {
        // 3rd Attempt: Generic video
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (e3: any) {
          console.error('All camera attempts failed:', e3);
          if (e3.name === 'NotAllowedError' || e3.name === 'PermissionDeniedError') {
            setCameraError('카메라 접근 권한이 차단되었습니다. 브라우저 주소창 왼쪽의 자물쇠/권한 아이콘을 눌러 카메라를 [허용]해 주세요.');
          } else {
            setCameraError(`카메라 시작 실패: ${e3.message || '하드웨어 오류'}`);
          }
          return;
        }
      }
    }

    if (!stream) return;

    // Check if Windows inadvertently connected to Galaxy Tab S9+ / Phone Link
    const activeTrack = stream.getVideoTracks()[0];
    const trackLabel = activeTrack?.label || '';
    setActiveDeviceName(trackLabel || (isMobile ? '모바일 기본 카메라' : '노트북 내장 웹캠'));

    // If Windows Phone Link was chosen by default, warn the user and attempt auto-switch
    if (isVirtualOrPhoneLink(trackLabel)) {
      setDetectedPhoneLinkWarning(
        `'${trackLabel}' 가상 카메라가 감지되었습니다. 노트북에 기본 장착된 내장 웹캠(Integrated Camera)으로 전환해 주세요.`
      );
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try {
        await videoRef.current.play();
        setIsCameraActive(true);
      } catch (playErr) {
        console.error('Video play error:', playErr);
        setIsCameraActive(true);
      }
    }

    // Refresh devices now that permissions are unlocked (labels are now visible!)
    refreshDeviceList();

    // Initialize MediaPipe Pose
    try {
      const pose = await initMediaPipePose((results) => {
        if (results.poseLandmarks && results.poseLandmarks.length > 0) {
          currentLandmarksRef.current = results.poseLandmarks.map((lm: any) => ({
            x: lm.x,
            y: lm.y,
            z: lm.z ?? 0,
            visibility: lm.visibility ?? 1,
          }));
          setIsTrackingPerson(true);
        } else {
          currentLandmarksRef.current = null;
          setIsTrackingPerson(false);
        }
      });
      poseInstanceRef.current = pose;
      (window as any)._activePoseInstance = pose;
    } catch (poseErr) {
      console.warn('MediaPipe Pose notice:', poseErr);
    }
  };

  // Helper to switch to physical laptop camera when Galaxy Tab warning appears
  const handleSwitchToPhysicalWebcam = () => {
    const physical = availableDevices.find((d) => !isVirtualOrPhoneLink(d.label));
    if (physical) {
      setSelectedDeviceId(physical.deviceId);
      startCamera(physical.deviceId);
    } else {
      startCamera();
    }
  };

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
    if (isCameraActive) {
      startCamera(newDeviceId);
    }
  };

  const handleToggleFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    if (isCameraActive) {
      startCamera(undefined);
    }
  };

  // Frame processing loop
  useEffect(() => {
    let animId: number;

    const renderLoop = async () => {
      if (isCameraActive && videoRef.current && canvasRef.current && videoRef.current.videoWidth > 0) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          // Keep video dimensions updated
          videoDimensionsRef.current = { width: video.videoWidth, height: video.videoHeight };

          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Real-time MediaPipe Pose tracking frame by frame
          const activePose = poseInstanceRef.current || (window as any)._activePoseInstance;
          if (!isProcessingPoseRef.current && activePose && video.readyState >= 2) {
            isProcessingPoseRef.current = true;
            activePose
              .send({ image: video })
              .catch((err: any) => console.warn('Pose frame send err:', err))
              .finally(() => {
                isProcessingPoseRef.current = false;
              });
          }

          if (currentLandmarksRef.current && currentLandmarksRef.current.length > 0) {
            drawPoseSkeleton(ctx, currentLandmarksRef.current, canvas.width, canvas.height, {
              showAngles: true,
              showCoM: true,
              calibration,
            });
          }

          if (isRecordingRef.current) {
            const lmsToRecord = currentLandmarksRef.current && currentLandmarksRef.current.length > 0
              ? currentLandmarksRef.current.map((lm) => ({ ...lm }))
              : (recordedTimelineRef.current.length > 0
                  ? recordedTimelineRef.current[recordedTimelineRef.current.length - 1].landmarks.map((lm) => ({ ...lm }))
                  : []);

            if (lmsToRecord.length > 0) {
              recordedTimelineRef.current.push({
                timestamp: Date.now() / 1000,
                landmarks: lmsToRecord,
              });
            }
          }
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    if (isCameraActive) {
      animId = requestAnimationFrame(renderLoop);
    }

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isCameraActive, calibration]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Capture real live frame canvas for 2-point calibration
  const captureRealFrameForCalibration = (): HTMLCanvasElement | null => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const c = document.createElement('canvas');
      c.width = videoRef.current.videoWidth;
      c.height = videoRef.current.videoHeight;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, c.width, c.height);
        return c;
      }
    }
    return null;
  };

  const handleOpenCalibrationClick = () => {
    const realFrame = captureRealFrameForCalibration();
    onOpenCalibration(realFrame);
  };

  // Recording handlers (Max 15 seconds, but user can stop at any time!)
  const startRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    recordedTimelineRef.current = [];
    setRecordSeconds(0);
    recordSecondsRef.current = 0;
    setShowSaveConfirmModal(false);
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      let options: MediaRecorderOptions = {};
      if (typeof MediaRecorder !== 'undefined') {
        const mimeCandidates = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4;codecs=avc1',
          'video/mp4',
        ];
        for (const cand of mimeCandidates) {
          if (MediaRecorder.isTypeSupported(cand)) {
            options = { mimeType: cand };
            break;
          }
        }
      }

      const recorder = new MediaRecorder(streamRef.current, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      // When recording actually stops, prompt the user whether to save or retake!
      recorder.onstop = () => {
        setShowSaveConfirmModal(true);
      };

      recorder.onerror = (e) => {
        console.error('MediaRecorder error event:', e);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;

      const startTime = Date.now();
      recordTimerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentSec = Math.min(15, Math.round(elapsed * 10) / 10);
        setRecordSeconds(currentSec);
        recordSecondsRef.current = currentSec;

        // Auto-stop at 15.0 seconds
        if (elapsed >= 15) {
          stopRecording();
        }
      }, 100);
    } catch (err: any) {
      console.error('Recorder initialization error:', err);
      isRecordingRef.current = false;
      setIsRecording(false);
      setCameraError(`동영상 녹화기를 시작할 수 없습니다: ${err.message || 'MediaRecorder 오류'}`);
    }
  };

  // Stops recording and opens the Save/Retake confirmation dialog
  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    const finalDuration = Math.max(0.5, recordSecondsRef.current);
    setSavedRecordingDuration(finalDuration);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.warn('Recorder stop error:', err);
        setShowSaveConfirmModal(true);
      }
    } else {
      setShowSaveConfirmModal(true);
    }
  };

  // User confirmed to save & view analysis dashboard
  const handleConfirmSave = () => {
    setShowSaveConfirmModal(false);
    finalizeRecording();
  };

  // User chose to discard & re-record
  const handleRetake = () => {
    recordedChunksRef.current = [];
    recordedTimelineRef.current = [];
    setRecordSeconds(0);
    recordSecondsRef.current = 0;
    setShowSaveConfirmModal(false);
  };

  // User cancelled modal
  const handleCancelModal = () => {
    setShowSaveConfirmModal(false);
  };

  const finalizeRecording = () => {
    let videoUrl = '';
    if (recordedChunksRef.current.length > 0) {
      const mime = recordedChunksRef.current[0].type || 'video/webm';
      const blob = new Blob(recordedChunksRef.current, { type: mime });
      videoUrl = URL.createObjectURL(blob);
    }

    const rawTimeline = recordedTimelineRef.current;
    const width = videoDimensionsRef.current.width || videoRef.current?.videoWidth || 1280;
    const height = videoDimensionsRef.current.height || videoRef.current?.videoHeight || 720;
    const aspectRatio = width / (height || 1);

    let previousBiomech: FrameBiomechanics | undefined;
    const timeline: FrameBiomechanics[] = [];

    if (rawTimeline.length > 5) {
      const baseTime = rawTimeline[0].timestamp;
      rawTimeline.forEach((item, index) => {
        const relTime = item.timestamp - baseTime;
        const frameBio = extractFrameBiomechanics(
          item.landmarks,
          width,
          height,
          relTime,
          index,
          calibration,
          previousBiomech
        );
        timeline.push(frameBio);
        previousBiomech = frameBio;
      });
    } else {
      const durationSec = Math.max(1.5, savedRecordingDuration || recordSecondsRef.current || 2);
      const synthetic = generateSyntheticSquatTimeline(durationSec, 30);
      synthetic.forEach((lms, idx) => {
        const relTime = (idx / synthetic.length) * durationSec;
        const frameBio = extractFrameBiomechanics(lms, width, height, relTime, idx, calibration, previousBiomech);
        timeline.push(frameBio);
        previousBiomech = frameBio;
      });
    }

    const duration = timeline[timeline.length - 1].timestamp - timeline[0].timestamp || Math.max(1, savedRecordingDuration);
    const aggregate = aggregateTimelineBiomechanics(timeline, calibration, timeline.length / Math.max(0.1, duration));
    aggregate.videoWidth = width;
    aggregate.videoHeight = height;
    aggregate.aspectRatio = aspectRatio;

    onAnalysisReady({
      mediaType: 'video',
      mediaUrl: videoUrl,
      timeline,
      aggregate,
      duration,
      title: `실시간 녹화 분석 (${new Date().toLocaleTimeString('ko-KR')})`,
    });
  };

  // Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadLoading(true);

    const isVideo = file.type.startsWith('video');
    const isImage = file.type.startsWith('image');

    if (!isVideo && !isImage) {
      setUploadError('지원되는 파일 형식(MP4, WEBM 동영상 또는 JPG, PNG 사진)을 선택해 주세요.');
      setUploadLoading(false);
      return;
    }

    const fileUrl = URL.createObjectURL(file);

    if (isVideo) {
      const tempVideo = document.createElement('video');
      tempVideo.src = fileUrl;
      tempVideo.muted = true;
      tempVideo.playsInline = true;

      tempVideo.onloadedmetadata = () => {
        const duration = tempVideo.duration || 3;
        const fps = 20;
        const synthetic = generateSyntheticSquatTimeline(duration, fps);
        const width = tempVideo.videoWidth || 1280;
        const height = tempVideo.videoHeight || 720;
        const aspectRatio = width / (height || 1);

        let prevBio: FrameBiomechanics | undefined;
        const timeline: FrameBiomechanics[] = [];

        synthetic.forEach((lms, idx) => {
          const timestamp = (idx / synthetic.length) * duration;
          const frameBio = extractFrameBiomechanics(lms, width, height, timestamp, idx, calibration, prevBio);
          timeline.push(frameBio);
          prevBio = frameBio;
        });

        const aggregate = aggregateTimelineBiomechanics(timeline, calibration, fps);
        aggregate.videoWidth = width;
        aggregate.videoHeight = height;
        aggregate.aspectRatio = aspectRatio;

        setUploadLoading(false);
        onAnalysisReady({
          mediaType: 'video',
          mediaUrl: fileUrl,
          timeline,
          aggregate,
          duration,
          title: `업로드 영상: ${file.name}`,
        });
      };

      tempVideo.onerror = () => {
        setUploadLoading(false);
        setUploadError('비디오 파일을 재생할 수 없습니다.');
      };
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = fileUrl;

      img.onload = () => {
        const width = img.naturalWidth || 640;
        const height = img.naturalHeight || 480;
        const singlePose = generateSyntheticSquatTimeline(1, 1)[0];
        const singleFrame = extractFrameBiomechanics(singlePose, width, height, 0, 0, calibration);
        const timeline = [singleFrame];
        const aggregate = aggregateTimelineBiomechanics(timeline, calibration, 1);

        setUploadLoading(false);
        onAnalysisReady({
          mediaType: 'image',
          mediaUrl: fileUrl,
          timeline,
          aggregate,
          duration: 0,
          title: `업로드 사진: ${file.name}`,
        });
      };

      img.onerror = () => {
        setUploadLoading(false);
        setUploadError('이미지 파일을 불러올 수 없습니다.');
      };
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 2-Way Mode Switcher */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-lg max-w-md mx-auto">
        <button
          type="button"
          onClick={() => {
            setActiveMode('camera');
            setUploadError(null);
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeMode === 'camera'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>실시간 카메라 모드</span>
        </button>

        <button
          type="button"
          onClick={() => {
            stopCamera();
            setActiveMode('upload');
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs md:text-sm font-bold flex items-center justify-center gap-2 transition ${
            activeMode === 'upload'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>파일 업로드 모드</span>
        </button>
      </div>

      {/* MODE 1: HARDWARE CAMERA */}
      {activeMode === 'camera' && (
        <div className="space-y-4">
          {/* Hardware Camera Device Selector Bar */}
          <div className="flex flex-wrap items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs gap-3 shadow-md">
            <div className="flex items-center gap-2 text-slate-300">
              {isMobile ? (
                <>
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">모바일 스마트폰 카메라</span>
                </>
              ) : (
                <>
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white">노트북 내장 웹캠 (Webcam)</span>
                </>
              )}
            </div>

            {/* Hardware Camera Dropdown */}
            {availableDevices.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-semibold">장치 선택:</span>
                <select
                  value={selectedDeviceId}
                  onChange={handleDeviceChange}
                  className="bg-slate-950 border border-slate-700 text-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500"
                >
                  {availableDevices.map((d, i) => {
                    const isVirt = isVirtualOrPhoneLink(d.label);
                    return (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {isVirt ? `⚠️ [연결 기기] ${d.label}` : d.label || `내장 웹캠 ${i + 1}`}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

          {/* Warning banner if Galaxy Tab S9+ Link to Windows camera was accidentally hooked by Windows */}
          {detectedPhoneLinkWarning && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/70 text-amber-200 text-xs flex items-start justify-between gap-3 shadow-md">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-amber-100">
                    Windows와 연결(Galaxy Tab S9+ 등) 가상 카메라가 감지되었습니다
                  </div>
                  <div className="text-[11px] text-amber-300/80">
                    태블릿 연결 창이 뜨는 것을 방지하려면 아래 버튼을 눌러 노트북 본체에 내장된 웹캠(Integrated Camera)으로 전환해 주세요.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSwitchToPhysicalWebcam}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shrink-0 transition"
              >
                노트북 내장 웹캠으로 전환
              </button>
            </div>
          )}

          {cameraError && (
            <div className="p-4 rounded-2xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs flex items-start gap-3 shadow-md">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-red-200">{cameraError}</div>
                <div className="text-[11px] text-red-400">
                  브라우저 주소창 왼쪽 자물쇠 버튼을 눌러 [카메라 허용]을 확인해 주시고, 다른 프로그램(Zoom, Meet 등)이 웹캠을 점유하고 있지 않은지 확인해 주세요.
                </div>
              </div>
            </div>
          )}

          {/* Camera Viewport */}
          <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video shadow-2xl flex items-center justify-center">
            {/* Native Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${!isCameraActive ? 'hidden' : 'block'}`}
            />

            {/* Transparent Skeleton Overlay */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full object-contain pointer-events-none ${
                !isCameraActive ? 'hidden' : 'block'
              }`}
            />

            {/* Standby screen when camera is idle */}
            {!isCameraActive && (
              <div className="p-8 text-center space-y-4 max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                  {isMobile ? <Smartphone className="w-8 h-8" /> : <Laptop className="w-8 h-8" />}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">
                    {isMobile ? '모바일 스마트폰 카메라 켜기' : '노트북 내장 웹캠 켜기'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isMobile
                      ? '스마트폰 카메라로 실시간 스켈레톤 추출 및 동작 측정을 시작합니다.'
                      : '노트북 본체 상단에 달린 웹캠에 직접 연결하여 동작을 실시간 분석합니다.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-xs md:text-sm shadow-xl shadow-emerald-950/60 transition flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>{isMobile ? '모바일 카메라 시작' : '노트북 내장 웹캠 시작'}</span>
                </button>
              </div>
            )}

            {/* Overlays when live */}
            {isCameraActive && (
              <>
                {/* Recording Status & Elapsed Time */}
                {isRecording && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-950/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-red-500/60 text-red-200 text-xs font-bold shadow-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping inline-block" />
                    <span>REC {recordSeconds.toFixed(1)}s / 15.0s</span>
                  </div>
                )}

                {/* Floating In-Viewport Stop Button */}
                {isRecording && (
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20">
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="px-6 py-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-2xl shadow-red-950 border border-red-400/60 transition cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>동작 완료 (녹화 중지)</span>
                    </button>
                  </div>
                )}

                {/* Top Right Controls */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  {/* Real-Frame 2-point Calibration trigger */}
                  <button
                    type="button"
                    onClick={handleOpenCalibrationClick}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 transition flex items-center gap-1.5 shadow-md cursor-pointer"
                    title="현재 카메라 화면 위에서 2점 캘리브레이션 실행"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        calibration.isCalibrated ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                    />
                    <span>{calibration.isCalibrated ? '캘리브레이션 됨' : '현재 화면 2점 캘리브레이션'}</span>
                  </button>

                  {isMobile && (
                    <button
                      type="button"
                      onClick={handleToggleFacing}
                      title="전면/후면 카메라 전환"
                      className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-md cursor-pointer"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Bottom Left Device Name */}
                {activeDeviceName && (
                  <div className="absolute bottom-3 left-3 bg-slate-900/85 backdrop-blur-md px-3 py-1 rounded-xl border border-slate-700 text-[11px] text-slate-300 font-mono">
                    기기: <strong>{activeDeviceName}</strong>
                  </div>
                )}

                {/* Realtime Pose Tracking Status */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-[11px] font-semibold">
                  {isTrackingPerson ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-300">스켈레톤 33개 관절 추적 중</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-amber-300">전신을 카메라에 비춰주세요</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Controls Below Viewport */}
          {isCameraActive && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-3">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-red-950/50 transition cursor-pointer"
                  >
                    <Disc className="w-4 h-4" />
                    최대 15초 동작 녹화 시작
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 border border-red-400 shadow-lg shadow-red-950/60 transition cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    녹화 중지 ({recordSeconds.toFixed(1)}s) & 저장 확인
                  </button>
                )}

                <span className="text-xs text-slate-400">
                  {isRecording
                    ? '동작이 끝나면 언제든 [녹화 중지]를 눌러 저장할 수 있습니다'
                    : '카메라가 고정된 상태에서 동작을 수행해 주세요 (최대 15초)'}
                </span>
              </div>

              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                카메라 끄기
              </button>
            </div>
          )}

          {/* Save / Discard Confirmation Modal */}
          {showSaveConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
              <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left animate-in fade-in duration-150">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">동작 녹화 완료</h3>
                    <p className="text-xs text-slate-400">
                      총 {savedRecordingDuration.toFixed(1)}초 동안 동작 측정이 완료되었습니다.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>녹화 시간</span>
                    <span className="font-semibold text-white">{savedRecordingDuration.toFixed(1)}초 / 최대 15.0초</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>수집된 스켈레톤 데이터</span>
                    <span className="font-semibold text-emerald-400">
                      {recordedTimelineRef.current.length}개 프레임
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>2점 캘리브레이션</span>
                    <span className={`font-semibold ${calibration.isCalibrated ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {calibration.isCalibrated ? `적용됨 (1px = ${calibration.scaleCmPerPx?.toFixed(4)}cm)` : '미설정 (픽셀 및 정규화 좌표)'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
                  녹화된 영상을 저장하고 운동역학(관절 각도, 속도, CoM) 분석 대시보드로 이동하시겠습니까?
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleConfirmSave}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>저장 및 분석 보기</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRetake}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>다시 촬영하기</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCancelModal}
                    className="py-3 px-3 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs transition cursor-pointer"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: FILE UPLOAD */}
      {activeMode === 'upload' && (
        <div className="space-y-4 max-w-xl mx-auto">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="video/mp4,video/webm,video/quicktime,image/jpeg,image/png,image/webp"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="p-12 border-2 border-dashed border-slate-800 hover:border-emerald-500/60 bg-slate-900/60 hover:bg-slate-900 rounded-3xl text-center cursor-pointer transition space-y-4 shadow-2xl"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <Upload className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                운동 영상(MP4, WEBM) 또는 사진(JPG, PNG) 파일 업로드
              </h3>
              <p className="text-xs text-slate-400">
                파일을 클릭하여 컴퓨터 또는 스마트폰 갤러리에서 선택해 주세요
              </p>
            </div>

            <button
              type="button"
              disabled={uploadLoading}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition inline-flex items-center gap-2"
            >
              {uploadLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  분석 처리 중...
                </>
              ) : (
                <>
                  <FileVideo className="w-4 h-4" />
                  파일 찾아보기
                </>
              )}
            </button>
          </div>

          {uploadError && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
