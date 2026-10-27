import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  AlertOctagon,
  BookOpen,
  Crown,
  ArrowRight,
  CheckCircle2,
  Tv,
} from 'lucide-react';
import { useDailyPlayLimit } from '../context/DailyPlayLimitContext';
import { useAuth } from '../context/AuthContext';
import { RedeemVipModal } from './RedeemVipModal';
import { AdBanner } from './AdBanner';

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
  const [adCountdown, setAdCountdown] = useState<number>(10);
  const [rewardSuccessMsg, setRewardSuccessMsg] = useState<string | null>(null);

  // Bộ đếm lùi 10 giây khi mở popup quảng cáo có thưởng
  useEffect(() => {
    if (!isWatchingAd) return;

    if (adCountdown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setAdCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [isWatchingAd, adCountdown]);

  if (!isOpen || isUnlimited) return null;

  const handleOpenRewardedAd = () => {
    setAdCountdown(10);
    setIsWatchingAd(true);
  };

  const handleClaimReward = async () => {
    await addBonusPlays(rewardBonusPlaysCount);
    setIsWatchingAd(false);
    setRewardSuccessMsg('Đã mở khóa lượt thi sa hình thành công!');
    setTimeout(() => {
      setRewardSuccessMsg(null);
      onClose();
    }, 1500);
  };

  const handleCloseAdOverlay = () => {
    if (adCountdown > 0) {
      if (
        window.confirm(
          'Bạn chưa xem hết quảng cáo! Nếu đóng bây giờ, lượt thi sẽ không được mở khóa. Bạn có chắc muốn đóng?'
        )
      ) {
        setIsWatchingAd(false);
      }
    } else {
      handleClaimReward();
    }
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
            {/* Usage Info (không ghi cộng bao nhiêu lượt) */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Số lượt đã sử dụng:</span>
                <span className="font-mono font-bold text-rose-400">
                  {playsUsed} / {dailyLimit + bonusPlays} lượt
                </span>
              </div>

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

            {/* Thẻ Quảng Cáo Tặng Thưởng (Chỉ hiện icon Ads, không ghi cộng bao nhiêu lượt) */}
            <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-950 to-teal-950/50 border-2 border-emerald-500/50 shadow-xl shadow-emerald-950/40 flex flex-col gap-3 group">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                  <Tv className="w-5 h-5 animate-pulse text-emerald-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Xem Quảng Cáo Để Tiếp Tục Thi
                    </h3>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider shrink-0">
                      Ads
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                    Xem 1 quảng cáo ngắn để mở khóa lượt thi tiếp tục thực hành sa hình.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={isWatchingAd || rewardSuccessMsg !== null}
                onClick={handleOpenRewardedAd}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-slate-950 text-xs font-black shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Tv className="w-4 h-4 fill-slate-950" />
                <span>XEM QUẢNG CÁO ĐỂ THI TIẾP</span>
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
            <div className="pt-2 flex justify-center">
              <AdBanner
                format="horizontal_leaderboard"
                slotId="out_of_plays_bottom_banner"
                className="w-full !max-w-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Overlay Xem Quảng Cáo 10s (Rewarded Ad Overlay Cách 2) */}
      {isWatchingAd && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200 pointer-events-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Tv className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Xem Quảng Cáo Mở Khóa Lượt Thi</span>
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider">
                      Ads
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {adCountdown > 0
                      ? `Vui lòng xem trong ${adCountdown} giây để mở khóa...`
                      : 'Đã hoàn thành! Bấm nút bên dưới để mở khóa lượt thi'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseAdOverlay}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Đóng quảng cáo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 h-1.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-1000 ease-linear"
                style={{ width: `${((10 - adCountdown) / 10) * 100}%` }}
              />
            </div>

            {/* Banner Quảng Cáo */}
            <div className="p-4 sm:p-6 flex flex-col items-center justify-center min-h-[220px] bg-slate-950/70">
              <div className="w-full flex justify-center py-2">
                <AdBanner
                  format="header_top"
                  closable={false}
                  slotId="rewarded_ad_overlay"
                  className="w-full"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs">
                {adCountdown > 0 ? (
                  <span className="flex items-center gap-1.5 text-amber-300 font-medium">
                    <Clock className="w-4 h-4 animate-spin text-amber-400" />
                    Đang xem: <strong className="font-mono text-white text-sm">{adCountdown}s</strong>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Đã xem xong quảng cáo!
                  </span>
                )}
              </div>

              <button
                disabled={adCountdown > 0}
                onClick={handleClaimReward}
                className={`py-2 px-5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                  adCountdown > 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/30 cursor-pointer animate-pulse'
                }`}
              >
                {adCountdown > 0 ? (
                  <span>CHỜ {adCountdown}S</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 fill-slate-950 text-emerald-400" />
                    <span>MỞ KHÓA LƯỢT THI NGAY</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
