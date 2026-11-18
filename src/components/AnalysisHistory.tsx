import React from 'react';
import { Bookmark, Calendar, ArrowRight, Trash2, Activity, Ruler, Download, Upload } from 'lucide-react';
import { AnalysisRecord } from '../types/motion';
import { deleteAnalysisRecord } from '../services/authAndStorageService';

interface AnalysisHistoryProps {
  records: AnalysisRecord[];
  onSelectRecord: (record: AnalysisRecord) => void;
  onRefreshRecords: () => void;
}

export const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({
  records,
  onSelectRecord,
  onRefreshRecords,
}) => {
  const handleDelete = async (e: React.MouseEvent, id: string, userId?: string) => {
    e.stopPropagation();
    if (confirm('이 분석 기록을 보관함에서 삭제하시겠습니까?')) {
      await deleteAnalysisRecord(id, userId);
      onRefreshRecords();
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `motion_analysis_history_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-emerald-400" />
            저장된 동작 분석 기록 보관함 ({records.length}건)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            이전의 관절 가동성, CoM 속도, 캘리브레이션 수치 및 Gemini AI 리포트를 다시 불러옵니다.
          </p>
        </div>

        {records.length > 0 && (
          <button
            type="button"
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            전체 백업 다운로드 (JSON)
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
            <Bookmark className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-300">저장된 분석 기록이 없습니다</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            실시간 카메라 촬영 또는 영상 업로드 후 'Gemini AI 동작 평가' 리포트에서 [보관함에 저장]을 클릭하시면 이곳에 보관됩니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {records.map((rec) => (
            <div
              key={rec.id}
              onClick={() => onSelectRecord(rec)}
              className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850 cursor-pointer transition space-y-3 shadow-lg group relative"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                    {rec.mediaType === 'video' ? '영상 분석' : '사진 분석'}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-1 group-hover:text-emerald-300 transition">
                    {rec.title}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, rec.id, rec.userId)}
                  title="삭제"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Metrics preview */}
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div>
                  <div className="text-slate-500 text-[10px]">무릎 ROM</div>
                  <div className="font-bold text-emerald-400 font-mono mt-0.5">
                    {rec.aggregate.joints.leftKnee?.rom}°
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">대칭성 점수</div>
                  <div className="font-bold text-sky-400 font-mono mt-0.5">
                    {rec.aggregate.symmetry.overallSymmetryScore}점
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px]">CoM 피크</div>
                  <div className="font-bold text-red-400 font-mono mt-0.5">
                    {rec.aggregate.comSummary.peakVelocity}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-850">
                <span className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3 h-3 text-slate-500" />
                  {new Date(rec.createdAt).toLocaleDateString('ko-KR')}
                </span>
                <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 group-hover:translate-x-1 transition">
                  불러오기 <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
