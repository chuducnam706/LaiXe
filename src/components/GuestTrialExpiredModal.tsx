import React from 'react';
import { Clock, Lock, ArrowRight, UserPlus, Home, AlertTriangle } from 'lucide-react';

interface GuestTrialExpiredModalProps {
  isOpen: boolean;
  trialMinutes: number;
  onOpenAuth: () => void;
  onReturnHome: () => void;
}

export const GuestTrialExpiredModal: React.FC<GuestTrialExpiredModalProps> = ({
  isOpen,
  trialMinutes,
  onOpenAuth,
  onReturnHome,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 pointer-events-auto">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/50 rounded-2xl shadow-[0_0_50px_rgba(245,158,11,0.25)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with visual warning */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-amber-500/15 via-slate-900 to-slate-900 border-b border-slate-800 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 animate-pulse">
            <Clock className="w-7 h-7" />
          </div>

          <span className="inline-block px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider mb-1.5">
            Thông Báo Hết Giờ Lái Thử
          </span>

          <h2 className="text-lg font-extrabold text-white">
            Hết Thời Gian Lái Thử ({trialMinutes} Phút)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Chế độ khách bị giới hạn {trialMinutes} phút mỗi lượt lái (cấu hình bởi Firebase Remote Config).
          </p>
        </div>

        {/* Body Info */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Xe đã dừng và phiên lái kết thúc!</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Để thi trọn vẹn 11 bài sa hình không giới hạn thời gian, <strong>mở khóa xe số tự động (AT)</strong> và lưu điểm số lên hệ thống, vui lòng đăng nhập tài khoản.
            </p>
          </div>

          {/* Action buttons: strictly NO retry, NO practice mode */}
          <div className="flex flex-col gap-2.5 pt-1">
            <button
              onClick={onOpenAuth}
              className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.99] text-white text-xs font-bold rounded-xl shadow-lg shadow-sky-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              Đăng Ký / Đăng Nhập Tài Khoản
            </button>

            <button
              onClick={onReturnHome}
              className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              Về Màn Hình Chính
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
