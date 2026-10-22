import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Car,
  AlertTriangle,
  RotateCcw,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ExamHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExamHistoryModal: React.FC<ExamHistoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { examHistory, userProfile, effectiveName, currentUser, refreshHistory, retentionHours } = useAuth();

  const ITEMS_PER_PAGE = 5;
  const [currentPage, setCurrentPage] = useState<number>(1);

  const totalAttempts = examHistory.length;
  const passedAttempts = examHistory.filter((item) => item.passed).length;
  const passRate = totalAttempts > 0 ? Math.round((passedAttempts / totalAttempts) * 100) : 0;
  const totalPages = Math.max(1, Math.ceil(totalAttempts / ITEMS_PER_PAGE));

  // Reset to page 1 if current page exceeds total pages
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  if (!isOpen) return null;

  const paginatedList = examHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 pointer-events-auto">
      <div className="w-full max-w-3xl max-h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Lịch Sử Sát Hạch Sa Hình</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3 text-sky-400" />
                  Lưu {retentionHours || 3} giờ
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Học viên: <span className="text-white font-medium">{effectiveName}</span> ·{' '}
                {currentUser ? (
                  <span>Hạng {userProfile?.licenseClass || 'B2'}</span>
                ) : (
                  <span className="text-amber-400 font-medium">Chế độ Khách (Không lưu dữ liệu)</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refreshHistory()}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Làm mới lịch sử"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Strip: Auto clean after 3 hours */}
        <div className="px-6 py-2 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 text-sky-300">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            Lịch sử tự động dọn dẹp sau <strong>{retentionHours || 3} giờ</strong> để chống tràn bộ nhớ và tối ưu tốc độ.
          </span>
          <span className="font-mono text-slate-400">
            Phân trang 5 bài/trang
          </span>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/60 border-b border-slate-800 text-center font-mono">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] text-slate-400">TỔNG LẦN THI</div>
            <div className="text-xl font-bold text-white mt-0.5">{totalAttempts}</div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] text-slate-400">SỐ LẦN ĐỖ (≥80Đ)</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{passedAttempts}</div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="text-[11px] text-slate-400">TỶ LỆ ĐẬU</div>
            <div className="text-xl font-bold text-sky-400 mt-0.5">{passRate}%</div>
          </div>
        </div>

        {/* List of Attempts (Paginated) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
          {totalAttempts === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium">Chưa có kết quả thi nào trong {retentionHours || 3} giờ qua</p>
              <p className="text-xs text-slate-500 mt-1">
                Hãy bắt đầu bài thi sa hình 3D để kết quả được lưu tự động lên hệ thống!
              </p>
            </div>
          ) : (
            paginatedList.map((item, idx) => {
              const dateStr = new Date(item.timestampIso).toLocaleString('vi-VN', {
                dateStyle: 'short',
                timeStyle: 'medium',
              });

              return (
                <div
                  key={item.id || idx}
                  className={`p-4 rounded-xl border transition-all ${
                    item.passed
                      ? 'bg-slate-950/80 border-emerald-500/30'
                      : 'bg-slate-950/80 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {item.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          {item.exerciseTitleVi}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {dateStr}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Car className="w-3 h-3" />
                            {item.vehicleNameVi}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-lg font-black font-mono ${
                          item.passed ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.finalScore} / {item.initialScore}
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          item.passed
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {item.passed ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'}
                      </span>
                    </div>
                  </div>

                  {item.violations && item.violations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5">
                      <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        Các lỗi bị trừ điểm ({item.violations.length}):
                      </div>
                      <div className="space-y-1">
                        {item.violations.map((v, vIdx) => (
                          <div
                            key={v.id || vIdx}
                            className="flex items-center justify-between text-[11px] text-slate-300 bg-slate-900/60 px-2.5 py-1 rounded"
                          >
                            <span>{v.titleVi}</span>
                            <span className="text-rose-400 font-mono font-bold">
                              -{v.pointsDeducted}đ
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls Footer */}
        {totalAttempts > 0 && (
          <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-slate-400 font-mono">
              Hiển thị <strong className="text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> - <strong className="text-white">{Math.min(currentPage * ITEMS_PER_PAGE, totalAttempts)}</strong> / <strong className="text-white">{totalAttempts}</strong> lượt thi
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Trước</span>
              </button>

              <div className="flex items-center gap-1 font-mono">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    onClick={() => setCurrentPage(pg)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === pg
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {pg}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors cursor-pointer"
              >
                <span>Sau</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
