import React, { useState } from 'react';
import { X, Clock, AlertOctagon, BookOpen, Crown, ArrowRight } from 'lucide-react';
import { useDailyPlayLimit } from '../context/DailyPlayLimitContext';
import { RedeemVipModal } from './RedeemVipModal';

interface OutOfPlaysModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTheory: () => void;
}

export const OutOfPlaysModal: React.FC<OutOfPlaysModalProps> = ({
  isOpen,
  onClose,
  onOpenTheory,
}) => {
  const { dailyLimit, playsUsed, timeUntilMidnightVi } = useDailyPlayLimit();
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 pointer-events-auto">
        <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-900 border-b border-slate-800 text-center">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <h2 className="text-lg font-bold text-white">Đã Hết Lượt Thi Hôm Nay!</h2>
            <p className="text-xs text-slate-400 mt-1">
              Mỗi học viên có tối đa <span className="text-white font-semibold">{dailyLimit} lượt thi / ngày</span>.
            </p>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Số lượt đã dùng:</span>
                <span className="font-mono font-bold text-rose-400">
                  {playsUsed} / {dailyLimit} lượt
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Làm mới lượt thi sau:
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {timeUntilMidnightVi}
                </span>
              </div>
            </div>

            {/* Nút Kích hoạt VIP */}
            <button
              onClick={() => setIsRedeemOpen(true)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Crown className="w-4 h-4 text-slate-950" />
              <span>Nhập Mã VIP Để Thi Tiếp Không Giới Hạn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <div className="p-3.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-slate-300 flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                Trong lúc chờ làm mới lượt thực hành sa hình, bạn có thể ôn tập bộ <strong>600 câu hỏi lý thuyết sát hạch</strong> hoàn toàn miễn phí không giới hạn!
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={() => {
                  onClose();
                  onOpenTheory();
                }}
                className="w-full py-2 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Ôn Luyện Lý Thuyết Ngay
              </button>

              <button
                onClick={onClose}
                className="w-full py-1.5 px-4 bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </div>

      <RedeemVipModal
        isOpen={isRedeemOpen}
        onClose={() => {
          setIsRedeemOpen(false);
          onClose();
        }}
      />
    </>
  );
};
