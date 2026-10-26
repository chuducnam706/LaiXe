import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  AlertOctagon,
  BookOpen,
  Crown,
  ArrowRight,
  Play,
  Sparkles,
  CheckCircle2,
  Tv,
} from 'lucide-react';
import { useDailyPlayLimit } from '../context/DailyPlayLimitContext';
import { useAuth } from '../context/AuthContext';
import { RedeemVipModal } from './RedeemVipModal';
import { AdBanner } from './AdBanner';
import { triggerAdBreak } from '../utils/ads';

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
  const {
    dailyLimit,
    playsUsed,
    bonusPlays,
    rewardBonusPlaysCount,
    timeUntilMidnightVi,
    isUnlimited,
    addBonusPlays,
  } = useDailyPlayLimit();
  const { enableVipFeatures } = useAuth();
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [simulatedCountdown, setSimulatedCountdown] = useState<number | null>(null);
  const [rewardSuccessMsg, setRewardSuccessMsg] = useState<string | null>(null);

  // Simulated countdown for local test environment
  useEffect(() => {
    if (simulatedCountdown === null) return;
    if (simulatedCountdown <= 0) {
      // Completed simulated ad
      setSimulatedCountdown(null);
      setIsWatchingAd(false);
      handleGrantReward();
      return;
    }
    const timer = setTimeout(() => {
      setSimulatedCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [simulatedCountdown]);

  if (!isOpen || isUnlimited) return null;

  const handleGrantReward = async () => {
    const newTotal = await addBonusPlays(rewardBonusPlaysCount);
    setRewardSuccessMsg(`+${rewardBonusPlaysCount} lượt thi sa hình đã được cộng vào tài khoản hôm nay!`);
    setTimeout(() => {
      setRewardSuccessMsg(null);
      onClose();
    }, 1800);
  };

  const handleWatchRewardedAd = () => {
    setIsWatchingAd(true);
    triggerAdBreak('reward', 'extra_daily_plays', {
      beforeReward: (showAdFn) => {
        showAdFn();
      },
      adViewed: async () => {
        setIsWatchingAd(false);
        await handleGrantReward();
      },
      adDismissed: () => {
        setIsWatchingAd(false);
      },
      adBreakDone: (info: any) => {
        // Nếu chạy ở môi trường Local dev hoặc AFG chưa có quảng cáo thật của Google,
        // kích hoạt chế độ mô phỏng 5 giây để test mượt mà tính năng nhận thưởng!
        if (
          info?.breakStatus === 'not_ready' ||
          info?.breakStatus === 'disabled_by_remote_config' ||
          !info?.breakStatus
        ) {
          setSimulatedCountdown(5);
        } else {
          setIsWatchingAd(false);
        }
      },
    });
  };

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
              Mỗi học viên có tiêu chuẩn <span className="text-white font-semibold">{dailyLimit} lượt thi / ngày</span>.
            </p>
          </div>

          {/* Content Body */}
          <div className="p-6 space-y-4">
            {/* Usage Info */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Số lượt đã sử dụng:</span>
                <span className="font-mono font-bold text-rose-400">
                  {playsUsed} / {dailyLimit + bonusPlays} lượt
                </span>
              </div>

              {bonusPlays > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Lượt thưởng đã nhận từ Ads:
                  </span>
                  <span className="font-mono font-bold">+{bonusPlays} lượt</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Làm mới tự động sau:
                </span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {timeUntilMidnightVi}
                </span>
              </div>
            </div>

            {/* Notification on Success */}
            {rewardSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center gap-2.5 text-emerald-300 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{rewardSuccessMsg}</span>
              </div>
            )}

            {/* Thẻ Quảng Cáo Tặng Thưởng (Rewarded Video Ad) */}
            <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-950 to-teal-950/50 border-2 border-emerald-500/50 shadow-xl shadow-emerald-950/40 flex flex-col gap-3 group">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                  <Tv className="w-5 h-5 animate-pulse text-emerald-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Xem Video Nhận +{rewardBonusPlaysCount} Lượt Thi
                    </h3>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider shrink-0">
                      Ads
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Xem 1 video ngắn (15s) để mở khóa ngay +{rewardBonusPlaysCount} lượt thi tiếp tục thực hành.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isWatchingAd || rewardSuccessMsg !== null}
                onClick={handleWatchRewardedAd}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {simulatedCountdown !== null ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Đang xem quảng cáo ({simulatedCountdown}s)...</span>
                  </>
                ) : isWatchingAd ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Đang tải video có thưởng...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>XEM VIDEO NHẬN NGAY +{rewardBonusPlaysCount} LƯỢT</span>
                  </>
                )}
              </button>
            </div>

            {/* Nút Kích hoạt VIP */}
            {enableVipFeatures && (
              <button
                onClick={() => setIsRedeemOpen(true)}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Crown className="w-4 h-4 text-slate-950" />
                <span>Nhập Mã VIP Để Thi Tiếp Không Giới Hạn</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs text-slate-300 flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <span>
                Bạn cũng có thể ôn tập bộ <strong>600 câu hỏi lý thuyết sát hạch</strong> hoàn toàn miễn phí không giới hạn!
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

            {/* Banner Quảng Cáo Bottom */}
            <div className="pt-2 border-t border-slate-800/80 flex justify-center">
              <AdBanner
                format="horizontal_leaderboard"
                slotId="out_of_plays_bottom_banner"
                className="w-full !max-w-none"
              />
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
