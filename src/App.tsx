import React, { useState, useEffect } from 'react';
import {
  Camera, Activity, Sparkles, Bookmark, User, Ruler, LogOut,
  ChevronRight, Compass, ShieldCheck, CheckCircle2, AlertTriangle
} from 'lucide-react';
import {
  UserProfile, CalibrationState, FrameBiomechanics, BiomechanicsAggregate,
  GeminiAnalysisFeedback, AnalysisRecord
} from './types/motion';
import {
  getCurrentUser, setCurrentUser as persistCurrentUser, logoutUser,
  getUserAnalyses, saveAnalysisRecord, loadRecordMediaUrl
} from './services/authAndStorageService';
import { testFirestoreConnection } from './services/firebase';
import { aggregateTimelineBiomechanics } from './utils/biomechanics';
import { AuthPortal } from './components/AuthPortal';
import { CalibrationModal } from './components/CalibrationModal';
import { MotionCapture } from './components/MotionCapture';
import { MotionDashboard } from './components/MotionDashboard';
import { GeminiReport } from './components/GeminiReport';
import { AnalysisHistory } from './components/AnalysisHistory';

export default function App() {
  // Firestore connection check
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // Requirement 1: If currentUser is null, unconditionally show AuthPortal!
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
  const [currentSnapshotCanvas, setCurrentSnapshotCanvas] = useState<HTMLCanvasElement | null>(null);

  const handleOpenCalibration = (snapshotCanvas: HTMLCanvasElement | null) => {
    setCurrentSnapshotCanvas(snapshotCanvas);
    setIsCalibrationModalOpen(true);
  };

  // Requirement 2: Main workflow views
  const [activeView, setActiveView] = useState<'capture' | 'dashboard' | 'report' | 'history'>('capture');

  // Calibration state
  const [calibration, setCalibration] = useState<CalibrationState>({
    pointA: null,
    pointB: null,
    realDistanceCm: 100,
    scaleCmPerPx: null,
    pixelDistance: null,
    isCalibrated: false,
  });

  // Active analysis data
  const [currentAnalysis, setCurrentAnalysis] = useState<{
    mediaType: 'image' | 'video';
    mediaUrl: string;
    timeline: FrameBiomechanics[];
    aggregate: BiomechanicsAggregate | null;
    duration: number;
    title: string;
    feedback: GeminiAnalysisFeedback | null;
  } | null>(null);

  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<AnalysisRecord[]>(() => getUserAnalyses());
  const [isCurrentSaved, setIsCurrentSaved] = useState(false);

  // If user is not logged in, render dedicated AuthPortal (Login / Signup / Find ID / Find PW)
  if (!currentUser) {
    return (
      <AuthPortal
        onLoginSuccess={(user) => {
          persistCurrentUser(user);
          setCurrentUser(user);
          setActiveView('capture');
        }}
      />
    );
  }

  // Handle Logout (direct execution without window.confirm to avoid iframe sandbox block)
  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setCurrentAnalysis(null);
    setActiveView('capture');
  };

  // Called when video recording or file upload finishes
  const handleAnalysisReady = (data: {
    mediaType: 'image' | 'video';
    mediaUrl: string;
    timeline: FrameBiomechanics[];
    aggregate: BiomechanicsAggregate;
    duration: number;
    title: string;
  }) => {
    setCurrentAnalysis({
      ...data,
      feedback: null,
    });
    setIsCurrentSaved(false);
    setActiveView('dashboard');
  };

  // Request Gemini AI Biomechanical Assessment
  const handleRequestGeminiReport = async () => {
    if (!currentAnalysis || !currentAnalysis.aggregate) return;
    setIsGeminiLoading(true);

    try {
      const response = await fetch('/api/analyze-motion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userProfile: currentUser,
          calibration: {
            isCalibrated: calibration.isCalibrated,
            scaleCmPerPx: calibration.scaleCmPerPx,
            realDistanceCm: calibration.realDistanceCm,
            pixelDistance: calibration.pixelDistance,
          },
          metrics: {
            motionType: currentAnalysis.title,
            durationSeconds: currentAnalysis.duration,
            totalFrames: currentAnalysis.timeline.length,
            fps: currentAnalysis.aggregate.fps,
            jointAngles: {
              leftKnee: currentAnalysis.aggregate.joints.leftKnee,
              rightKnee: currentAnalysis.aggregate.joints.rightKnee,
              leftHip: currentAnalysis.aggregate.joints.leftHip,
              rightHip: currentAnalysis.aggregate.joints.rightHip,
              leftElbow: currentAnalysis.aggregate.joints.leftElbow,
              rightElbow: currentAnalysis.aggregate.joints.rightElbow,
              trunkAngle: currentAnalysis.aggregate.joints.trunkAngle,
            },
            linearVelocities: {
              unit: calibration.isCalibrated ? 'cm/s' : 'px/s',
              comPeak: currentAnalysis.aggregate.comSummary.peakVelocity,
              comAverage: currentAnalysis.aggregate.comSummary.avgVelocity,
              leftWristPeak: currentAnalysis.aggregate.velocities.leftWrist?.peakVelocity,
              rightWristPeak: currentAnalysis.aggregate.velocities.rightWrist?.peakVelocity,
              leftKneePeak: currentAnalysis.aggregate.velocities.leftKnee?.peakVelocity,
              rightKneePeak: currentAnalysis.aggregate.velocities.rightKnee?.peakVelocity,
            },
            comModelUsed: currentAnalysis.aggregate.comSummary.modelUsed,
            symmetryIndex: {
              kneeRomDiff: currentAnalysis.aggregate.symmetry.kneeRomDiffPct,
              hipRomDiff: currentAnalysis.aggregate.symmetry.hipRomDiffPct,
              armRomDiff: currentAnalysis.aggregate.symmetry.elbowRomDiffPct,
            },
            segmentLengths: currentAnalysis.aggregate.segmentLengths,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`서버 응답 오류 (${response.status})`);
      }

      const feedbackData: GeminiAnalysisFeedback = await response.json();
      setCurrentAnalysis((prev) => (prev ? { ...prev, feedback: feedbackData } : null));
      setActiveView('report');
    } catch (err: any) {
      console.error('Gemini motion assessment failed:', err);
      alert(`AI 분석 오류: ${err.message}`);
    } finally {
      setIsGeminiLoading(false);
    }
  };

  // Save to history & IndexedDB
  const handleSaveToHistory = async () => {
    if (!currentAnalysis || !currentAnalysis.aggregate) return;

    const newRecord: AnalysisRecord = {
      id: `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser.id,
      createdAt: new Date().toISOString(),
      title: currentAnalysis.title,
      mediaType: currentAnalysis.mediaType,
      calibration,
      aggregate: currentAnalysis.aggregate,
      timeline: currentAnalysis.timeline,
      feedback: currentAnalysis.feedback || undefined,
      videoDuration: currentAnalysis.duration,
      mediaUrl: currentAnalysis.mediaUrl,
      videoWidth: currentAnalysis.aggregate.videoWidth || 1280,
      videoHeight: currentAnalysis.aggregate.videoHeight || 720,
      aspectRatio: currentAnalysis.aggregate.aspectRatio || 1.7778,
    };

    await saveAnalysisRecord(newRecord, currentAnalysis.mediaUrl);
    setHistoryRecords(getUserAnalyses());
    setIsCurrentSaved(true);
  };

  const handleSelectRecord = async (record: AnalysisRecord) => {
    // Restore persistent video blob from IndexedDB if available
    const restoredMediaUrl = await loadRecordMediaUrl(record);

    setCurrentAnalysis({
      mediaType: record.mediaType,
      mediaUrl: restoredMediaUrl || record.mediaUrl || '',
      timeline: record.timeline,
      aggregate: record.aggregate,
      duration: record.videoDuration || 3,
      title: record.title,
      feedback: record.feedback || null,
    });
    setCalibration(record.calibration);
    setIsCurrentSaved(true);
    setActiveView('dashboard');
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-950/40">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                <span>AI MotionLab</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold hidden sm:inline">
                  카메라 동작 분석
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 hidden md:block">
                MediaPipe 2D 운동역학 변인 추출 및 Gemini AI 피드백
              </p>
            </div>
          </div>

          {/* Clean Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveView('capture')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeView === 'capture'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              동작 입력 (카메라/업로드)
            </button>

            <button
              onClick={() => setActiveView('dashboard')}
              disabled={!currentAnalysis}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeView === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : currentAnalysis
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              운동역학 대시보드
            </button>

            <button
              onClick={() => setActiveView('report')}
              disabled={!currentAnalysis}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeView === 'report'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : currentAnalysis
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              AI 리포트
            </button>

            <button
              onClick={() => setActiveView('history')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeView === 'history'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              보관함 ({historyRecords.length})
            </button>
          </nav>

          {/* User Info & Prominent Logout Button */}
          <div className="flex items-center gap-2">
            {/* User profile tag */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">{currentUser.name}</span>
              <span className="text-[11px] text-slate-400">
                ({currentUser.height}cm / {currentUser.weight}kg)
              </span>
            </div>

            {/* Requirement 4: Prominent Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 hover:text-red-200 border border-red-800/50 text-xs font-semibold transition"
              title="로그아웃"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-slate-800 bg-slate-900 px-2 py-1 justify-around text-xs">
          <button
            onClick={() => setActiveView('capture')}
            className={`py-1.5 px-2 rounded-lg flex items-center gap-1 ${
              activeView === 'capture' ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            카메라/업로드
          </button>
          <button
            onClick={() => setActiveView('dashboard')}
            disabled={!currentAnalysis}
            className={`py-1.5 px-2 rounded-lg flex items-center gap-1 ${
              activeView === 'dashboard' ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            대시보드
          </button>
          <button
            onClick={() => setActiveView('report')}
            disabled={!currentAnalysis}
            className={`py-1.5 px-2 rounded-lg flex items-center gap-1 ${
              activeView === 'report' ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            리포트
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`py-1.5 px-2 rounded-lg flex items-center gap-1 ${
              activeView === 'history' ? 'text-emerald-400 font-bold' : 'text-slate-400'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            보관함
          </button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* VIEW 1: MOTION CAPTURE (Real-time camera | File upload ONLY) */}
        {activeView === 'capture' && (
          <div className="space-y-6">
            <div className="text-center max-w-md mx-auto space-y-1">
              <h2 className="text-xl font-bold text-white">
                동작 촬영 및 관절점 추출
              </h2>
              <p className="text-xs text-slate-400">
                실시간 카메라(웹캠/모바일)로 동작을 녹화하거나 소장하고 계신 영상/사진을 업로드해 주세요.
              </p>
            </div>

            <MotionCapture
              calibration={calibration}
              onOpenCalibration={handleOpenCalibration}
              onAnalysisReady={handleAnalysisReady}
            />
          </div>
        )}

        {/* VIEW 2: CLEAN DASHBOARD & CHART SYNC */}
        {activeView === 'dashboard' && currentAnalysis && currentAnalysis.aggregate && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono font-bold text-emerald-400 uppercase">
                  Motion Analysis Dashboard
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {currentAnalysis.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setActiveView('capture')}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
              >
                새 동작 촬영/업로드
              </button>
            </div>

            <MotionDashboard
              mediaType={currentAnalysis.mediaType}
              mediaUrl={currentAnalysis.mediaUrl}
              timeline={currentAnalysis.timeline}
              aggregate={currentAnalysis.aggregate}
              duration={currentAnalysis.duration}
              title={currentAnalysis.title}
              calibration={calibration}
              onOpenCalibration={handleOpenCalibration}
              onRequestGeminiReport={handleRequestGeminiReport}
              isGeminiLoading={isGeminiLoading}
            />
          </div>
        )}

        {/* VIEW 3: GEMINI AI ASSESSMENT REPORT */}
        {activeView === 'report' && currentAnalysis && (
          <div className="space-y-6">
            {currentAnalysis.feedback ? (
              <GeminiReport
                feedback={currentAnalysis.feedback}
                aggregate={currentAnalysis.aggregate!}
                userProfile={currentUser}
                onSaveToHistory={handleSaveToHistory}
                isSaved={isCurrentSaved}
              />
            ) : (
              <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-4 max-w-lg mx-auto shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-7 h-7 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">
                    Gemini AI 동작 평가 리포트 생성
                  </h3>
                  <p className="text-xs text-slate-400">
                    추출된 운동역학 지표(관절 ROM, CoM 속도, 좌우 대칭성)를 바탕으로 AI 심층 분석 및 맞춤형 운동 처방을 생성합니다.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isGeminiLoading}
                  onClick={handleRequestGeminiReport}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50 transition inline-flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isGeminiLoading ? 'Gemini 3.8 Flash 연산 중...' : '지금 분석 리포트 생성하기'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: SAVED HISTORY */}
        {activeView === 'history' && (
          <AnalysisHistory
            records={historyRecords}
            onSelectRecord={handleSelectRecord}
            onRefreshRecords={() => setHistoryRecords(getUserAnalyses())}
          />
        )}
      </main>

      {/* 2-POINT CALIBRATION MODAL */}
      <CalibrationModal
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
        currentFrameCanvas={currentSnapshotCanvas}
        calibration={calibration}
        onApplyCalibration={(newCal) => {
          setCalibration(newCal);
          if (currentAnalysis && currentAnalysis.aggregate) {
            const reAgg = aggregateTimelineBiomechanics(
              currentAnalysis.timeline,
              newCal,
              currentAnalysis.aggregate.fps || 30
            );
            setCurrentAnalysis({
              ...currentAnalysis,
              aggregate: reAgg,
            });
          }
        }}
      />
    </div>
  );
}
