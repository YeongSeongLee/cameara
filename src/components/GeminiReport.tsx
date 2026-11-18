import React from 'react';
import {
  Sparkles, CheckCircle2, AlertTriangle, AlertCircle, Dumbbell, ShieldAlert,
  ArrowRight, Share2, Printer, BookmarkCheck, Activity, Award, Scale
} from 'lucide-react';
import { GeminiAnalysisFeedback, BiomechanicsAggregate, UserProfile } from '../types/motion';

interface GeminiReportProps {
  feedback: GeminiAnalysisFeedback;
  aggregate: BiomechanicsAggregate;
  userProfile?: UserProfile | null;
  onSaveToHistory: () => void;
  isSaved?: boolean;
}

export const GeminiReport: React.FC<GeminiReportProps> = ({
  feedback,
  aggregate,
  userProfile,
  onSaveToHistory,
  isSaved,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const reportText = `[AI 운동역학 동작 분석 리포트]\n대상: ${userProfile?.name || '분석 대상자'}\n\n1. 총평: ${feedback.overview}\n\n2. 대칭성 평가: ${feedback.symmetryAssessment.symmetryGrade} - ${feedback.symmetryAssessment.details}\n\n3. 부상 위험: ${feedback.injuryRisks.join(', ')}\n\n4. 추천 교정 운동: ${feedback.correctiveActions.map((c) => `${c.title} (${c.target})`).join(', ')}`;
    navigator.clipboard.writeText(reportText);
    alert('리포트 요약 내용이 클립보드에 복사되었습니다.');
  };

  const getStatusBadge = (status: 'good' | 'caution' | 'warning') => {
    switch (status) {
      case 'good':
        return (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 정상 가동
          </span>
        );
      case 'caution':
        return (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> 주의 필요
          </span>
        );
      case 'warning':
        return (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30 font-semibold flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> 불균형/위험
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Report Header Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold tracking-wider uppercase">
                  Gemini 3.8 Flash Biomechanics Engine
                </span>
                <span className="text-xs text-slate-400">
                  {new Date().toLocaleDateString('ko-KR')} 분석
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5">
                AI 운동역학 정밀 동작 평가 리포트
              </h2>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition flex items-center gap-1.5"
              title="리포트 텍스트 복사"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>복사</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition flex items-center gap-1.5"
              title="리포트 인쇄 및 PDF 저장"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>인쇄</span>
            </button>
            <button
              type="button"
              onClick={onSaveToHistory}
              disabled={isSaved}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                isSaved
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent shadow-md'
              }`}
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>{isSaved ? '보관함에 저장됨' : '보관함에 저장'}</span>
            </button>
          </div>
        </div>

        {/* Executive Overview */}
        <div className="pt-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            종합 동작 수행 소견 (Executive Summary)
          </h3>
          <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800/60">
            {feedback.overview}
          </p>
        </div>
      </div>

      {/* Movement Phases Breakdown (동작 국면별 분석) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          1. 동작 단계별 운동역학 분석 (Movement Phases & Scoring)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {feedback.movementPhases.map((phase, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">
                  Phase {idx + 1}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {phase.score} / 10 점
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{phase.phase}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {phase.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Joint Kinematics & Symmetry Assessment (관절 운동학 및 대칭성) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Joint Kinematics Quality */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-sky-400" />
            2. 주요 관절별 가동성 평가 (Joint Kinematics Quality)
          </h3>

          <div className="space-y-3">
            {feedback.kinematicsEvaluation.map((k, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-3"
              >
                <div className="space-y-1 flex-1">
                  <div className="text-xs font-bold text-white">{k.joint}</div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    {k.observation}
                  </div>
                </div>
                <div>{getStatusBadge(k.status)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Symmetry Assessment */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-400" />
              3. 좌우 대칭성 및 보상작용 (Symmetry & Asymmetry Index)
            </h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {feedback.symmetryAssessment.symmetryGrade}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">무릎 비대칭률</div>
                <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
                  {aggregate.symmetry.kneeRomDiffPct}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">고관절 비대칭률</div>
                <div className="text-sm font-bold font-mono text-purple-400 mt-0.5">
                  {aggregate.symmetry.hipRomDiffPct}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[10px] text-slate-400">대칭성 점수</div>
                <div className="text-sm font-bold font-mono text-sky-400 mt-0.5">
                  {aggregate.symmetry.overallSymmetryScore}점
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {feedback.symmetryAssessment.details}
            </p>
          </div>

          {/* Injury Risk Factors */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              주의해야 할 잠재적 부상 요인
            </h4>
            <div className="space-y-1.5">
              {feedback.injuryRisks.map((risk, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-200 flex items-start gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                  <span>{risk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Corrective Exercise Prescription (맞춤형 교정 운동 처방) */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Dumbbell className="w-4 h-4 text-emerald-400" />
          4. 운동역학 기반 맞춤형 교정 운동 처방 (Corrective Exercises)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {feedback.correctiveActions.map((action, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-emerald-400">처방 0{idx + 1}</span>
                  <span className="text-[10px] text-slate-400">{action.target}</span>
                </div>
                <h4 className="text-xs font-bold text-white mb-1.5">{action.title}</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {action.exercise}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-emerald-400">
                권장 빈도: {action.frequency}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Biomechanical Insights & Medical Disclaimer */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1.5">
        <p className="leading-relaxed">
          <strong className="text-slate-200">역학적 통찰: </strong>
          {feedback.biomechanicalInsights}
        </p>
        <p className="text-[11px] text-slate-500 italic">
          {feedback.disclaimer}
        </p>
      </div>
    </div>
  );
};
