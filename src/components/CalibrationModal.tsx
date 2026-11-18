import React, { useState, useRef, useEffect } from 'react';
import { Ruler, Check, RefreshCw, AlertTriangle, X, Target, Camera } from 'lucide-react';
import { CalibrationState } from '../types/motion';
import { calculateCalibrationScale } from '../utils/biomechanics';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFrameCanvas: HTMLCanvasElement | null;
  calibration: CalibrationState;
  onApplyCalibration: (newCalibration: CalibrationState) => void;
  onRefreshSnapshot?: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  currentFrameCanvas,
  calibration,
  onApplyCalibration,
  onRefreshSnapshot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pointA, setPointA] = useState<{ x: number; y: number } | null>(calibration.pointA);
  const [pointB, setPointB] = useState<{ x: number; y: number } | null>(calibration.pointB);
  const [realDistanceCm, setRealDistanceCm] = useState<number>(calibration.realDistanceCm || 100);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPointA(calibration.pointA);
      setPointB(calibration.pointB);
      setRealDistanceCm(calibration.realDistanceCm || 100);
    }
  }, [isOpen, calibration]);

  // Redraw canvas with real frame snapshot
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentFrameCanvas && currentFrameCanvas.width > 0) {
      canvas.width = currentFrameCanvas.width;
      canvas.height = currentFrameCanvas.height;

      // Draw ACTUAL Real Camera/Video frame
      ctx.drawImage(currentFrameCanvas, 0, 0, canvas.width, canvas.height);

      // Very subtle contrast overlay (15%) so real world objects are completely clear
      ctx.fillStyle = 'rgba(15, 23, 42, 0.15)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      canvas.width = 640;
      canvas.height = 480;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('카메라를 켜거나 영상을 재생하면 실제 화면이 이곳에 표시됩니다', 320, 240);
      ctx.textAlign = 'left';
    }

    // Draw Point A
    if (pointA) {
      ctx.beginPath();
      ctx.arc(pointA.x, pointA.y, 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#f59e0b'; // amber-500
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText('기준점 A (Point A)', pointA.x + 14, pointA.y - 8);
      ctx.shadowBlur = 0;
    }

    // Draw Point B
    if (pointB) {
      ctx.beginPath();
      ctx.arc(pointB.x, pointB.y, 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.fill();
      ctx.stroke();

      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = '#a7f3d0';
      ctx.shadowColor = 'black';
      ctx.shadowBlur = 4;
      ctx.fillText('기준점 B (Point B)', pointB.x + 14, pointB.y - 8);
      ctx.shadowBlur = 0;
    }

    // Connecting line and distance label
    if (pointA && pointB) {
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(pointA.x, pointA.y);
      ctx.lineTo(pointB.x, pointB.y);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.setLineDash([]);

      const dist = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
      const midX = (pointA.x + pointB.x) / 2;
      const midY = (pointA.y + pointB.y) / 2;
      const label = `${realDistanceCm} cm (${Math.round(dist)} px)`;

      ctx.font = 'bold 14px monospace';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(midX - textW / 2 - 10, midY - 15, textW + 20, 30);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(midX - textW / 2 - 10, midY - 15, textW + 20, 30);

      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, midX, midY);
      ctx.textAlign = 'left';
    }

    // Hover crosshair
    if (hoverPos && (!pointA || !pointB)) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, 0);
      ctx.lineTo(hoverPos.x, canvas.height);
      ctx.moveTo(0, hoverPos.y);
      ctx.lineTo(canvas.width, hoverPos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [isOpen, pointA, pointB, realDistanceCm, hoverPos, currentFrameCanvas]);

  if (!isOpen) return null;

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (!pointA) {
      setPointA({ x, y });
    } else if (!pointB) {
      setPointB({ x, y });
    } else {
      setPointA({ x, y });
      setPointB(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    setHoverPos({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  };

  const handleReset = () => {
    setPointA(null);
    setPointB(null);
  };

  const calculated = pointA && pointB ? calculateCalibrationScale(pointA, pointB, realDistanceCm) : null;

  const handleSave = () => {
    if (pointA && pointB && calculated) {
      onApplyCalibration({
        pointA,
        pointB,
        realDistanceCm,
        pixelDistance: calculated.pixelDistance,
        scaleCmPerPx: calculated.scaleCmPerPx,
        isCalibrated: true,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                실제 화면 2점 캘리브레이션 (Real-Frame 2-Point Calibration)
              </h2>
              <p className="text-xs text-slate-400">
                실제 카메라 화면 속 기준 물체(자, 기준봉, 신장 등)의 시작점과 끝점 2개를 클릭하세요
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefreshSnapshot && (
              <button
                type="button"
                onClick={onRefreshSnapshot}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                title="카메라의 현재 프레임을 다시 캡처"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>화면 다시 캡처</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Step Guide Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              className={`p-3 rounded-xl border transition ${
                !pointA
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold mb-0.5">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[11px] font-bold">
                  1
                </span>
                기준점 A 클릭 (예: 자의 0cm 또는 머리)
              </div>
              <p className="text-[11px] text-slate-400">
                {pointA ? `지정 완료 (${Math.round(pointA.x)}px, ${Math.round(pointA.y)}px)` : '화면에서 시작점을 클릭하세요'}
              </p>
            </div>

            <div
              className={`p-3 rounded-xl border transition ${
                pointA && !pointB
                  ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold mb-0.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[11px] font-bold">
                  2
                </span>
                기준점 B 클릭 (예: 자의 100cm 또는 발끝)
              </div>
              <p className="text-[11px] text-slate-400">
                {pointB ? `지정 완료 (${Math.round(pointB.x)}px, ${Math.round(pointB.y)}px)` : '화면에서 끝점을 클릭하세요'}
              </p>
            </div>

            <div
              className={`p-3 rounded-xl border transition ${
                pointA && pointB
                  ? 'bg-sky-950/40 border-sky-500/60 text-sky-200'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-bold mb-0.5">
                <span className="w-5 h-5 rounded-full bg-sky-500 text-slate-950 flex items-center justify-center text-[11px] font-bold">
                  3
                </span>
                실제 거리(cm) 입력 & 비율 계산
              </div>
              <p className="text-[11px] text-slate-400">
                {calculated ? `1 px = ${calculated.scaleCmPerPx} cm` : '실제 거리를 아래에 입력하세요'}
              </p>
            </div>
          </div>

          {/* Interactive Frame Canvas */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center cursor-crosshair shadow-inner">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverPos(null)}
              className="max-h-[50vh] w-auto max-w-full object-contain"
            />
            {(!pointA || !pointB) && (
              <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-200 flex items-center gap-2 shadow-lg">
                <Target className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>{!pointA ? '화면 위 기준점 A를 클릭해 주세요' : '기준점 B를 클릭해 주세요'}</span>
              </div>
            )}
          </div>

          {/* Fixed Camera Notice as per specs */}
          <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl flex items-center gap-2 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>카메라는 고정된 상태에서 촬영해야 합니다:</strong> 촬영 도중 카메라가 흔들리거나 거리가 변하면 환산 비율이 달라집니다.
            </span>
          </div>

          {/* Real distance input controls */}
          <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-300">
                실제 기준 거리 (Real Distance):
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={realDistanceCm}
                  onChange={(e) => setRealDistanceCm(Number(e.target.value))}
                  className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-emerald-400 text-right focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs font-bold text-slate-400">cm</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 mr-1">빠른 선택:</span>
              <button
                type="button"
                onClick={() => setRealDistanceCm(30)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                30cm 자
              </button>
              <button
                type="button"
                onClick={() => setRealDistanceCm(100)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                100cm 기준봉
              </button>
              <button
                type="button"
                onClick={() => setRealDistanceCm(175)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
              >
                175cm 신장 기준
              </button>
            </div>
          </div>

          {/* Calculated Output summary */}
          {calculated && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>
                  화면 거리: <strong>{calculated.pixelDistance} px</strong> ➔ 환산 계수: <strong>{calculated.scaleCmPerPx} cm/px</strong>
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700 font-semibold">
                길이(cm) 및 선형속도(cm/s) 활성화 완료
              </span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            기준점 다시 찍기
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              닫기
            </button>
            <button
              type="button"
              disabled={!pointA || !pointB}
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold shadow-md transition ${
                pointA && pointB
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              캘리브레이션 적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
