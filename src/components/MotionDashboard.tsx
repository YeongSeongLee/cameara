import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight, Ruler, Eye,
  Activity, Zap, Sparkles, Scale, Compass, CheckCircle2, AlertTriangle, ArrowRight
} from 'lucide-react';
import { FrameBiomechanics, BiomechanicsAggregate, CalibrationState } from '../types/motion';
import { drawPoseSkeleton, POSE_LANDMARKS } from '../utils/biomechanics';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface MotionDashboardProps {
  mediaType: 'image' | 'video';
  mediaUrl: string;
  timeline: FrameBiomechanics[];
  aggregate: BiomechanicsAggregate;
  duration: number;
  title: string;
  calibration: CalibrationState;
  onOpenCalibration: (snapshotCanvas: HTMLCanvasElement | null) => void;
  onRequestGeminiReport: () => void;
  isGeminiLoading: boolean;
}

export const MotionDashboard: React.FC<MotionDashboardProps> = ({
  mediaType,
  mediaUrl,
  timeline,
  aggregate,
  duration,
  title,
  calibration,
  onOpenCalibration,
  onRequestGeminiReport,
  isGeminiLoading,
}) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Overlay toggles
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [showCoM, setShowCoM] = useState(true);
  const [selectedJoint, setSelectedJoint] = useState<string>('leftKnee');
  const [activeChartMetric, setActiveChartMetric] = useState<'angles' | 'velocities' | 'com'>('angles');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const totalFrames = timeline.length;
  const currentFrame = timeline[currentFrameIndex] || timeline[0];

  // Draw current frame's ACTUAL skeleton on transparent canvas overlay
  useEffect(() => {
    if (!canvasRef.current || timeline.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = videoRef.current?.videoWidth || aggregate.videoWidth || currentFrame.frameWidth || 1280;
    const h = videoRef.current?.videoHeight || aggregate.videoHeight || currentFrame.frameHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    // Transparent clear so the real video behind remains visible!
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showSkeleton && currentFrame) {
      // Use the REAL detected landmarks from this video frame!
      const lmsToDraw = currentFrame.landmarks && currentFrame.landmarks.length > 0
        ? currentFrame.landmarks
        : null;

      if (lmsToDraw) {
        drawPoseSkeleton(ctx, lmsToDraw, canvas.width, canvas.height, {
          showAngles,
          showCoM,
          calibration,
          selectedJoint,
          frameAngles: currentFrame.angles,
        });
      }
    }
  }, [currentFrameIndex, showSkeleton, showAngles, showCoM, calibration, selectedJoint, timeline, currentFrame, aggregate]);

  // Synchronize native video playback with playbackSpeed and isPlaying state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaType !== 'video') return;

    video.playbackRate = playbackSpeed;

    if (isPlaying) {
      video.play().catch((err) => {
        console.warn('Video play error:', err);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, playbackSpeed, mediaType]);

  // Video timeupdate syncs currentFrameIndex with real playback time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaType !== 'video') return;

    const handleTimeUpdate = () => {
      if (duration > 0 && totalFrames > 0) {
        const frameIdx = Math.min(
          totalFrames - 1,
          Math.max(0, Math.floor((video.currentTime / duration) * totalFrames))
        );
        setCurrentFrameIndex(frameIdx);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentFrameIndex(0);
      video.currentTime = 0;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [duration, totalFrames, mediaType]);

  // Chart.js sync setup
  useEffect(() => {
    if (!chartCanvasRef.current || timeline.length === 0) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const labels = timeline.map((f) => `${f.timestamp.toFixed(2)}s`);
    let datasets: any[] = [];

    if (activeChartMetric === 'angles') {
      datasets = [
        {
          label: '왼쪽 무릎 각도 (°)',
          data: timeline.map((f) => f.angles.leftKnee),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
        },
        {
          label: '오른쪽 무릎 각도 (°)',
          data: timeline.map((f) => f.angles.rightKnee),
          borderColor: '#38bdf8',
          borderWidth: 2,
          borderDash: [4, 4],
          tension: 0.3,
        },
        {
          label: '상체 기울기 (°)',
          data: timeline.map((f) => f.angles.trunkAngle),
          borderColor: '#f59e0b',
          borderWidth: 2,
          tension: 0.3,
        },
      ];
    } else if (activeChartMetric === 'velocities') {
      const unit = calibration.isCalibrated ? 'cm/s' : 'px/s';
      datasets = [
        {
          label: `왼쪽 무릎 속도 (${unit})`,
          data: timeline.map((f) => f.velocities.leftKnee),
          borderColor: '#10b981',
          borderWidth: 2,
          tension: 0.3,
        },
        {
          label: `오른쪽 무릎 속도 (${unit})`,
          data: timeline.map((f) => f.velocities.rightKnee),
          borderColor: '#38bdf8',
          borderWidth: 2,
          tension: 0.3,
        },
      ];
    } else {
      const unit = calibration.isCalibrated ? 'cm/s' : 'px/s';
      datasets = [
        {
          label: `신체질량중심(CoM) 속도 (${unit}) [Dempster Model]`,
          data: timeline.map((f) => f.velocities.comVelocity),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderWidth: 2.5,
          tension: 0.3,
          fill: true,
        },
      ];
    }

    // Video-Chart Red Scrub Line Plugin
    const scrubLinePlugin = {
      id: 'scrubLine',
      afterDraw: (chart: any) => {
        const { ctx, chartArea } = chart;
        const meta = chart.getDatasetMeta(0);
        if (!meta || !meta.data || !meta.data[currentFrameIndex]) return;

        const xPos = meta.data[currentFrameIndex].x;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPos, chartArea.top);
        ctx.lineTo(xPos, chartArea.bottom);
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(xPos, chartArea.top - 2, 5, 0, 2 * Math.PI);
        ctx.fillStyle = '#f43f5e';
        ctx.fill();
        ctx.restore();
      },
    };

    const chart = new Chart(chartCanvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: { color: '#64748b', font: { size: 10 } },
            title: { display: true, text: '시간 (초 / Seconds)', color: '#64748b', font: { size: 10 } },
          },
          y: {
            grid: { color: 'rgba(51, 65, 85, 0.2)' },
            ticks: { color: '#64748b', font: { size: 10 } },
          },
        },
        onClick: (event, elements, activeChart) => {
          const { chartArea } = activeChart;
          if (!chartArea || event.x === null || event.x === undefined) return;
          const chartWidth = chartArea.right - chartArea.left;
          const relativeX = Math.max(0, Math.min(1, (event.x - chartArea.left) / chartWidth));
          const targetIndex = Math.floor(relativeX * (totalFrames - 1));

          setCurrentFrameIndex(targetIndex);
          if (videoRef.current) {
            videoRef.current.currentTime = (targetIndex / totalFrames) * duration;
          }
        },
      },
      plugins: [scrubLinePlugin],
    });

    chartInstanceRef.current = chart;

    return () => {
      chart.destroy();
    };
  }, [timeline, activeChartMetric, currentFrameIndex, calibration]);

  const handleSeek = (targetIndex: number) => {
    const next = Math.max(0, Math.min(totalFrames - 1, targetIndex));
    setCurrentFrameIndex(next);
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = (next / (totalFrames - 1 || 1)) * duration;
    }
  };

  const handleStep = (delta: number) => {
    setIsPlaying(false);
    handleSeek(currentFrameIndex + delta);
  };

  const handleOpenCalibration = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const snap = document.createElement('canvas');
      snap.width = videoRef.current.videoWidth;
      snap.height = videoRef.current.videoHeight;
      const ctx = snap.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, snap.width, snap.height);
        onOpenCalibration(snap);
        return;
      }
    }
    if (canvasRef.current) {
      const snap = document.createElement('canvas');
      snap.width = canvasRef.current.width || 640;
      snap.height = canvasRef.current.height || 480;
      const ctx = snap.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvasRef.current, 0, 0, snap.width, snap.height);
        onOpenCalibration(snap);
        return;
      }
    }
    onOpenCalibration(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Status Bar: 2D Notice & Calibration Indicator */}
      <div className="flex flex-wrap items-center justify-between p-3.5 bg-slate-900 border border-slate-800 rounded-2xl gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Compass className="w-4 h-4 text-emerald-400" />
          <span>본 결과는 단일 카메라 기반의 2D 추정값입니다 (Dempster 1955 모델 적용).</span>
        </div>

        <div className="flex items-center gap-2">
          {calibration.isCalibrated ? (
            <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              캘리브레이션 완료 ({calibration.scaleCmPerPx} cm/px)
            </span>
          ) : (
            <span className="text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              캘리브레이션 미적용 (px 단위 표시 중)
            </span>
          )}

          <button
            type="button"
            onClick={handleOpenCalibration}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-semibold flex items-center gap-1 transition"
          >
            <Ruler className="w-3.5 h-3.5 text-amber-400" />
            현재 화면 2점 캘리브레이션
          </button>
        </div>
      </div>

      {/* Main Grid: Left Video Viewer / Right Key Biomechanics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Canvas Viewport */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video shadow-2xl flex items-center justify-center">
            {/* Real User Video Element (native playback, not hidden!) */}
            {mediaUrl && mediaType === 'video' && (
              <video
                ref={videoRef}
                src={mediaUrl}
                playsInline
                muted
                preload="auto"
                className="w-full h-full object-contain"
                onLoadedMetadata={() => {
                  if (canvasRef.current && videoRef.current) {
                    canvasRef.current.width = videoRef.current.videoWidth || 640;
                    canvasRef.current.height = videoRef.current.videoHeight || 480;
                  }
                }}
              />
            )}

            {/* Real User Image Element */}
            {mediaUrl && mediaType === 'image' && (
              <img
                src={mediaUrl}
                alt="동작 분석 사진"
                className="w-full h-full object-contain"
              />
            )}

            {/* Real Skeleton Overlay (Transparent canvas over the actual video) */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            />

            {/* Time badge */}
            <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-mono text-slate-300">
              {currentFrame.timestamp.toFixed(2)}s / {duration.toFixed(2)}s (프레임 {currentFrameIndex + 1}/{totalFrames})
            </div>
          </div>

          {/* Timeline and Playback Controls */}
          {mediaType === 'video' && (
            <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2.5 shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 w-10 text-right">
                  {currentFrame.timestamp.toFixed(2)}s
                </span>
                <input
                  type="range"
                  min={0}
                  max={totalFrames - 1}
                  value={currentFrameIndex}
                  onChange={(e) => handleSeek(Number(e.target.value))}
                  className="flex-1 accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-400 w-10">
                  {duration.toFixed(2)}s
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStep(-1)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition"
                  >
                    {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isPlaying ? '정지' : '재생'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStep(1)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentFrameIndex(0);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span>배속:</span>
                  {[0.5, 1.0].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                        playbackSpeed === s ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Key Biomechanics Summary & CTA */}
        <div className="lg:col-span-5 space-y-4">
          {/* Big Prominent Action Button: Request Gemini AI Motion Assessment */}
          <button
            type="button"
            disabled={isGeminiLoading}
            onClick={onRequestGeminiReport}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold rounded-2xl text-xs md:text-sm shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 transition hover:scale-[1.01]"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{isGeminiLoading ? 'Gemini AI 운동역학 분석 중...' : 'Gemini AI 동작 평가 리포트 받기'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* 4 Clean Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1 shadow-md">
              <div className="text-[11px] text-slate-400 font-medium">무릎 가동범위 (ROM)</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {aggregate.joints.leftKnee?.rom}°
              </div>
              <div className="text-[10px] text-slate-500">
                최소 {aggregate.joints.leftKnee?.minAngle}° ~ 최대 {aggregate.joints.leftKnee?.maxAngle}°
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1 shadow-md">
              <div className="text-[11px] text-slate-400 font-medium">고관절 가동범위 (ROM)</div>
              <div className="text-xl font-bold font-mono text-sky-400">
                {aggregate.joints.leftHip?.rom}°
              </div>
              <div className="text-[10px] text-slate-500">
                최소 {aggregate.joints.leftHip?.minAngle}° ~ 최대 {aggregate.joints.leftHip?.maxAngle}°
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1 shadow-md">
              <div className="text-[11px] text-slate-400 font-medium">CoM 피크 속도</div>
              <div className="text-xl font-bold font-mono text-red-400">
                {aggregate.comSummary.peakVelocity}{' '}
                <span className="text-xs font-normal text-slate-400">{aggregate.comSummary.unit}</span>
              </div>
              <div className="text-[10px] text-slate-500">Dempster 1955 인체모델</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1 shadow-md">
              <div className="text-[11px] text-slate-400 font-medium">좌우 대칭성 점수</div>
              <div className="text-xl font-bold font-mono text-purple-400">
                {aggregate.symmetry.overallSymmetryScore}{' '}
                <span className="text-xs font-normal text-slate-400">/ 100점</span>
              </div>
              <div className="text-[10px] text-slate-500">
                무릎 비대칭률: {aggregate.symmetry.kneeRomDiffPct}%
              </div>
            </div>
          </div>

          {/* Interactive Joint Selector */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-md">
            <div className="text-xs font-bold text-slate-300">관절별 실시간 각도 확인</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'leftKnee', name: '왼쪽 무릎', rom: aggregate.joints.leftKnee?.rom },
                { id: 'rightKnee', name: '오른쪽 무릎', rom: aggregate.joints.rightKnee?.rom },
                { id: 'leftHip', name: '고관절', rom: aggregate.joints.leftHip?.rom },
                { id: 'trunkAngle', name: '상체 기울기', rom: aggregate.joints.trunkAngle?.rom },
              ].map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => setSelectedJoint(j.id)}
                  className={`p-2 rounded-xl text-left border text-xs transition ${
                    selectedJoint === j.id
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{j.name}</span>
                    <span className="font-mono text-emerald-400">ROM {j.rom}°</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {selectedJoint === 'leftKnee'
                  ? '왼쪽 무릎'
                  : selectedJoint === 'rightKnee'
                  ? '오른쪽 무릎'
                  : selectedJoint === 'leftHip'
                  ? '고관절'
                  : selectedJoint === 'trunkAngle'
                  ? '상체 기울기'
                  : selectedJoint}{' '}
                현재 각도:
              </span>
              <span className="text-sm font-bold font-mono text-white">
                {((currentFrame.angles as any)[selectedJoint] || 0).toFixed(1)}°
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart-Video Sync Area */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-xs md:text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              영상-그래프 실시간 연동 타임라인 (Chart.js Sync)
            </h3>
            <p className="text-[11px] text-slate-400">
              그래프 타임라인을 클릭하면 영상 위치가 이동하고, 영상 재생 시 붉은색 타임라인 바가 실시간 연동됩니다.
            </p>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveChartMetric('angles')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                activeChartMetric === 'angles' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              관절 각도
            </button>
            <button
              type="button"
              onClick={() => setActiveChartMetric('velocities')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                activeChartMetric === 'velocities' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              선형 속도
            </button>
            <button
              type="button"
              onClick={() => setActiveChartMetric('com')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                activeChartMetric === 'com' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              CoM 속도
            </button>
          </div>
        </div>

        <div className="h-60 w-full relative">
          <canvas ref={chartCanvasRef} />
        </div>
      </div>
    </div>
  );
};
