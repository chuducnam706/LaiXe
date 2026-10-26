import React from 'react';
import { Ticket, Crown, Tv } from 'lucide-react';
import { useDailyPlayLimit } from '../context/DailyPlayLimitContext';
import { useAuth } from '../context/AuthContext';

interface DailyPlaysBadgeProps {
  className?: string;
  onClick?: () => void;
}

export const DailyPlaysBadge: React.FC<DailyPlaysBadgeProps> = ({ className = '', onClick }) => {
  const { currentUser, isVip, isAdmin } = useAuth();
  const {
    dailyLimit,
    playsRemaining,
    isUnlimited,
    bonusPlays,
    rewardBonusPlaysCount,
  } = useDailyPlayLimit();

  // Khách không hiển thị số lượt chơi
  if (!currentUser) return null;

  // VIP hiển thị huy hiệu vàng ánh kim và biểu tượng vô hạn ∞ (không click được)
  if (isVip || isUnlimited) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm select-none bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 text-amber-300 border-amber-500/50 cursor-default pointer-events-none ${className}`}
      >
        <Crown className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-mono text-xs font-black tracking-wider text-amber-300 flex items-center gap-1">
          VIP <span className="text-sm font-black">∞</span>
        </span>
      </div>
    );
  }

  // Admin hiển thị badge vô hạn (không click được)
  if (isAdmin) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm select-none bg-rose-500/20 text-rose-300 border-rose-500/40 cursor-default pointer-events-none ${className}`}
      >
        <Crown className="w-3.5 h-3.5 text-rose-400" />
        <span className="font-mono text-xs font-black tracking-wider text-rose-300 flex items-center gap-1">
          Admin <span className="text-sm font-black">∞</span>
        </span>
      </div>
    );
  }

  const isLow = playsRemaining <= 1;
  const isOut = playsRemaining === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer shadow-sm ${
        isOut
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
          : isLow
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white'
      } ${className}`}
      title={
        isOut
          ? `Đã hết lượt thi hôm nay! Bấm để xem video nhận thêm +${rewardBonusPlaysCount} lượt`
          : `Lượt thi sa hình hôm nay: Còn ${playsRemaining}/${dailyLimit + bonusPlays} lượt`
      }
    >
      <Ticket className={`w-3.5 h-3.5 ${isOut ? 'text-rose-400' : isLow ? 'text-amber-400' : 'text-sky-400'}`} />
      <span className="font-mono text-[11px] font-bold">
        {playsRemaining}/{dailyLimit + bonusPlays} lượt
      </span>

      {/* Icon Ads nhỏ báo hiệu xem video nhận thêm lượt khi hết 5 lượt */}
      {isOut && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 border border-amber-400/50 text-[10px] font-black animate-pulse shadow-sm shadow-amber-500/20">
          <Tv className="w-3 h-3 text-amber-300" />
          <span>Ads +{rewardBonusPlaysCount}</span>
        </span>
      )}
    </button>
  );
};
