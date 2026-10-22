import {
  X,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
  ListChecks,
  ShieldCheck,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Home,
} from 'lucide-react';
import { PracticeAttemptResult } from '../types/course';
import { useAuth } from '../context/AuthContext';
import { useDailyPlayLimit } from '../context/DailyPlayLimitContext';

interface ExerciseResultsModalProps {
  result: PracticeAttemptResult | null;
  onClose: () => void;
  onRetryExercise: () => void;
  onNextExercise: () => void;
  onOpenCourseMenu: () => void;
  onReturnHome?: () => void;
}

export const ExerciseResultsModal: React.FC<ExerciseResultsModalProps> = ({
  result,
  onClose,
  onRetryExercise,
  onNextExercise,
  onOpenCourseMenu,
  onReturnHome,
}) => {
  const { currentUser } = useAuth();
  const { dailyLimit, playsRemaining, setIsOutOfPlaysModalOpen } = useDailyPlayLimit();

  if (!result) return null;

  const primaryViolation =
    !result.passed && result.violations && result.violations.length > 0
      ? result.violations[0]
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 pointer-events-auto">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            {result.passed ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {result.passed
                  ? 'BÁO CÁO KẾT QUẢ: ĐẠT YÊU CẦU SÁT HẠCH'
                  : 'BÁO CÁO KẾT QUẢ: CHƯA ĐẠT YÊU CẦU'}
              </h2>
              <p className="text-xs text-slate-400">
                {result.exerciseTitleVi} · {result.vehicleNameVi} (Hạng{' '}
                {result.licenseCategory})
              </p>
            </div>
          </div>

          <button
            onClick={!result.passed ? (onReturnHome || onClose) : onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label={!result.passed ? 'Thoát ra màn hình chính' : 'Đóng bảng kết quả'}
            title={!result.passed ? 'Thoát ra màn hình chính' : 'Đóng bảng kết quả'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Metrics Strip */}
        <div
          className={`grid ${
            currentUser ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
          } gap-2.5 sm:gap-3 p-4 sm:p-5 bg-slate-950/60 border-b border-slate-800 font-mono tabular-nums`}
        >
          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-[10px] sm:text-[11px] text-slate-400">
              ĐIỂM TỔNG KẾT
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold mt-0.5 ${
                result.passed ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {result.finalScore} / {result.initialScore}
            </div>
            <div className="text-[10px] text-slate-500">
              Điểm đạt: &ge; {result.passingScore} điểm
            </div>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-[10px] sm:text-[11px] text-slate-400">
              TRẠM CHECKPOINT
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-sky-400 mt-0.5">
              {result.completedCheckpoints} / {result.totalCheckpoints}
            </div>
            <div className="text-[10px] text-slate-500">
              Hoàn thành tuần tự
            </div>
          </div>

          <div className="p-2.5 sm:p-3 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-[10px] sm:text-[11px] text-slate-400">
              THỜI GIAN CHẠY
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              {result.elapsedSeconds}s
            </div>
            <div className="text-[10px] text-slate-500">
              {result.violations.length} lỗi trừ điểm
            </div>
          </div>

          {currentUser && (
            <div className="p-2.5 sm:p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[10px] sm:text-[11px] text-slate-400">
                LƯỢT THI CÒN LẠI
              </div>
              <div
                className={`text-xl sm:text-2xl font-extrabold mt-0.5 ${
                  playsRemaining === 0 ? 'text-rose-400' : 'text-amber-400'
                }`}
              >
                {playsRemaining} / {dailyLimit}
              </div>
              <div className="text-[10px] text-slate-500">
                {playsRemaining === 0 ? 'Đã hết lượt hôm nay' : 'Reset lúc 00:00'}
              </div>
            </div>
          )}
        </div>

        {/* Detailed Violations, Checkpoint Progress & Corrective Feedback */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Prominent Failure Callout Box */}
          {!result.passed && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/95 via-rose-900/80 to-slate-950 border-2 border-rose-500 shadow-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 text-rose-300 font-extrabold text-sm sm:text-base">
                  <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                  <span>
                    {result.summaryNoteVi.includes('Truất quyền') ||
                    result.summaryNoteVi.includes('trượt trực tiếp')
                      ? 'TRUẤT QUYỀN SÁT HẠCH (TRƯỢT TRỰC TIẾP)'
                      : `CHƯA ĐẠT YÊU CẦU (${result.finalScore}/100 ĐIỂM)`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRetryExercise}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Thi Lại (R)
                </button>
              </div>

              <div className="text-xs sm:text-sm font-bold text-white bg-rose-950/90 p-3 rounded-lg border border-rose-600/70 leading-relaxed shadow-inner">
                {result.summaryNoteVi}
              </div>

              {primaryViolation && (
                <div className="text-xs text-slate-200 bg-slate-950/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-rose-400 font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Lỗi vi phạm: {primaryViolation.titleVi}</span>
                    <span className="font-mono text-rose-400 font-extrabold ml-auto">
                      {primaryViolation.pointsDeducted > 0
                        ? `-${primaryViolation.pointsDeducted}đ`
                        : 'Truất quyền'}
                    </span>
                  </div>
                  {primaryViolation.stationNameVi && (
                    <div className="text-[11px] text-amber-300 font-mono">
                      Vị trí ghi nhận: {primaryViolation.stationNameVi} (tại {primaryViolation.timestampSeconds}s)
                    </div>
                  )}
                  <p className="text-xs text-slate-300">{primaryViolation.explanationVi}</p>
                  <div className="text-sky-300 text-[11px] pt-1">
                    <strong>💡 Hướng dẫn khắc phục:</strong> {primaryViolation.correctiveFeedbackVi}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 space-y-1">
            <div>
              <strong>Nhận xét tổng quát:</strong> {result.summaryNoteVi}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono pt-1">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Quy chuẩn áp dụng: {result.ruleSetVersion}</span>
            </div>
          </div>

          {/* Checkpoint-by-Checkpoint Completion Breakdown */}
          {result.checkpointProgress && result.checkpointProgress.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                TIẾN ĐỘ TỪNG TRẠM KIỂM TRA ({result.completedCheckpoints}/
                {result.totalCheckpoints})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.checkpointProgress.map((cp) => (
                  <div
                    key={cp.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs ${
                      cp.completed
                        ? 'bg-emerald-950/25 border-emerald-700/40 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="truncate pr-2 font-medium">
                      {cp.orderIndex}. {cp.nameVi}
                    </span>
                    <span className="font-mono text-[11px] shrink-0 flex items-center gap-1">
                      {cp.completed ? (
                        <>
                          <Clock className="w-3 h-3 text-emerald-400" />
                          {cp.completedAtSeconds}s
                        </>
                      ) : (
                        'Chưa qua'
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              NHẬT KÝ LỖI TRỪ ĐIỂM & HƯỚNG DẪN KHẮC PHỤC (
              {result.violations.length})
            </h3>

            {result.violations.length === 0 ? (
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-700/40 text-xs text-emerald-300">
                Tuyệt vời! Bạn đạt điểm tuyệt đối 100/100 — không mắc bất kỳ lỗi chạm cọc tiêu, đè vạch cảm biến, quên xi-nhan hay chết máy nào trong suốt lượt chạy.
              </div>
            ) : (
              <div className="space-y-2">
                {result.violations.map((v) => (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-rose-400">
                        {v.titleVi}
                      </span>
                      <span className="font-mono font-bold text-rose-400 tabular-nums shrink-0">
                        -{v.pointsDeducted} điểm (tại {v.timestampSeconds}s)
                      </span>
                    </div>
                    {v.stationNameVi && (
                      <div className="text-[11px] font-mono text-amber-300">
                        Vị trí ghi nhận: {v.stationNameVi}
                      </div>
                    )}
                    <p className="text-xs text-slate-300">{v.explanationVi}</p>
                    <p className="text-[11px] text-sky-400">
                      <strong>Hướng dẫn khắc phục:</strong>{' '}
                      {v.correctiveFeedbackVi}
                    </p>
                    {v.regulatorySourceVi && (
                      <div className="text-[10px] font-mono text-slate-500">
                        Căn cứ: {v.regulatorySourceVi}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-6 py-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center gap-2">
            {onReturnHome && (
              <button
                onClick={onReturnHome}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Thoát khỏi sa hình và quay về màn hình chính"
              >
                <Home className="w-4 h-4" />
                Về Màn Chính
              </button>
            )}

            <button
              onClick={onOpenCourseMenu}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ListChecks className="w-4 h-4" />
              11 Bài Thi
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentUser && playsRemaining === 0) {
                  setIsOutOfPlaysModalOpen(true);
                  return;
                }
                onRetryExercise();
              }}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
                currentUser && playsRemaining === 0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : !result.passed
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-800 hover:bg-slate-700 text-amber-400'
              }`}
              title={currentUser && playsRemaining === 0 ? 'Đã hết lượt thi sa hình hôm nay' : 'Đưa xe về vạch xuất phát và chơi lại từ đầu (Phím R hoặc Phím Space)'}
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {currentUser && playsRemaining === 0
                  ? `Hết Lượt Thi (0/${dailyLimit})`
                  : !result.passed
                  ? `Chơi Lại Từ Đầu (Phím R)${currentUser ? ` · Còn ${playsRemaining} lượt` : ''}`
                  : `Thử Lại Bài Này (R)${currentUser ? ` · Còn ${playsRemaining} lượt` : ''}`}
              </span>
            </button>

            <button
              onClick={onNextExercise}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white transition-colors"
            >
              Bài Tiếp Theo
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
