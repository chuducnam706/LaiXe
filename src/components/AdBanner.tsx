import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, Sparkles } from 'lucide-react';
import { MONETAG_TAG_ID, ADSTERRA_468x60_KEY, ADSTERRA_468x60_SCRIPT } from '../utils/ads';
import { useAuth } from '../context/AuthContext';

export type AdBannerFormat =
  | 'header_top'
  | 'mrec_300x250'
  | 'mini_floating'
  | 'horizontal_leaderboard'
  | 'compact_strip'
  | 'side_skyscraper';

interface AdBannerProps {
  format: AdBannerFormat;
  slotId?: string;
  className?: string;
  closable?: boolean;
}

export const AdBanner: React.FC<AdBannerProps> = ({
  format,
  slotId = 'monetag_slot_01',
  className = '',
  closable = false,
}) => {
  const { enableAds, isVip, isAdmin } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [_adLoaded, _setAdLoaded] = useState(false);
  const bannerContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enableAds || isVip || isAdmin) return;
    // Sẵn sàng nạp Monetag Banner khi script hoạt động
  }, [enableAds, isVip, isAdmin]);

  if (!enableAds || isVip || isAdmin || isDismissed) return null;

  // Format 1: MREC 300x250
  if (format === 'mrec_300x250') {
    return (
      <div
        className={`relative w-[300px] h-[250px] rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900/90 shadow-2xl backdrop-blur-md flex flex-col justify-between p-3.5 select-none transition-all hover:border-amber-500/50 ${className}`}
      >
        {/* Ad Badge & Close Button */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Quảng cáo
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Monetag · 300x250</span>
          </div>
          {closable && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
              title="Đóng quảng cáo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Realistic Monetag Creative Container */}
        <div ref={bannerContainerRef} id={`monetag_${slotId}`} className="flex-1 flex flex-col items-center justify-center text-center my-2 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mb-2">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-white line-clamp-1">
            Khóa Học Bổ Túc Sa Hình B2 & C
          </h4>
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 leading-relaxed">
            Thầy dạy 1 kèm 1, cam kết đỗ 100%. Luyện dốc cầu, lùi chuồng dọc ngang thực tế.
          </p>
          <div className="mt-3 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow-md shadow-sky-500/20 transition-all cursor-pointer">
            <span>Đăng Ký Học Ngay</span>
            <ExternalLink className="w-3 h-3" />
          </div>
        </div>

        <div className="text-[9px] text-slate-500 text-center font-mono pt-1 border-t border-slate-800/60">
          Monetag Banner Active
        </div>
      </div>
    );
  }

  // Format 2: Header Top Banner (468x60 - Adsterra Banner trực tiếp vào khung)
  if (format === 'header_top') {
    return (
      <div
        className={`relative w-full max-w-[480px] h-[64px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/95 shadow-lg backdrop-blur-md flex items-center justify-center p-0.5 select-none transition-all hover:border-slate-700 ${className}`}
      >
        {closable && (
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-1 right-1 z-20 p-0.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng quảng cáo"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <div className="w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center">
          <iframe
            title="Adsterra 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className="w-[468px] h-[60px] border-0 overflow-hidden"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style></head><body><script type="text/javascript">atOptions = {'key' : '${ADSTERRA_468x60_KEY}','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script type="text/javascript" src="${ADSTERRA_468x60_SCRIPT}"></script></body></html>`}
          />
        </div>
      </div>
    );
  }

  // Format 4: Horizontal Leaderboard (Banner dài nằm dưới bottom của Home hoặc Modal thông báo)
  if (format === 'horizontal_leaderboard') {
    return (
      <div
        className={`relative w-full max-w-[728px] h-[66px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-md flex items-center justify-center p-0.5 select-none transition-all hover:border-slate-700 ${className}`}
      >
        {closable && (
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-1 right-1 z-20 p-0.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Đóng quảng cáo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center">
          <iframe
            title="Adsterra Leaderboard 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className="w-[468px] h-[60px] border-0 overflow-hidden"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style></head><body><script type="text/javascript">atOptions = {'key' : '${ADSTERRA_468x60_KEY}','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script type="text/javascript" src="${ADSTERRA_468x60_SCRIPT}"></script></body></html>`}
          />
        </div>
      </div>
    );
  }

  // Format 5: Compact Strip (Xen kẽ ở giữa khối màu đỏ và màu xanh trong bảng thông báo)
  if (format === 'compact_strip') {
    return (
      <div
        className={`relative w-full h-[46px] rounded-xl overflow-hidden border border-amber-500/30 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 shadow-md flex items-center justify-between px-3 select-none transition-all hover:border-amber-500/50 ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 shrink-0">
            Tài trợ
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              Mẹo Căn Điểm Chuẩn Xác 100 Điểm Sa Hình
            </p>
            <p className="text-[10px] text-slate-400 truncate hidden sm:block">
              Bí quyết căn dốc cầu, lọt vệt bánh xe hàng đinh, lùi chuồng dọc ngang an toàn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-2">
          <div className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/40 flex items-center gap-1 cursor-pointer">
            <span>Xem Mẹo</span>
            <ExternalLink className="w-3 h-3" />
          </div>
          {closable && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Ẩn"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Format 6: Side Skyscraper (Quảng cáo 2 bên trái & phải của màn hình / modal thông báo)
  if (format === 'side_skyscraper') {
    return (
      <div
        className={`relative w-[130px] xl:w-[150px] h-[480px] xl:h-[540px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-md flex flex-col justify-between p-3 select-none transition-all hover:border-amber-500/40 ${className}`}
      >
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Quảng Cáo
          </span>
          {closable && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center my-3 px-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 mb-2.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold text-white line-clamp-2 leading-tight">
            Khóa Bổ Túc Sa Hình B2 & C
          </h4>
          <p className="text-[10px] text-slate-400 line-clamp-4 mt-2 leading-relaxed">
            Thầy 1 kèm 1, cam kết đỗ 100%. Luyện dốc cầu, lùi chuồng dọc ngang thực tế.
          </p>
        </div>

        <div className="space-y-2">
          <div className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-1 shadow-md shadow-sky-500/20 transition-all cursor-pointer">
            <span>Chi Tiết</span>
            <ExternalLink className="w-3 h-3" />
          </div>
          <div className="text-[8px] text-slate-500 text-center font-mono">
            Monetag · 160x600
          </div>
        </div>
      </div>
    );
  }

  // Format 3: Mini Floating Banner in Simulation (320x50 - In-Game Driving Screen)
  return (
    <div
      className={`pointer-events-auto relative w-[280px] sm:w-[320px] h-[46px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950/90 shadow-xl backdrop-blur-md flex items-center justify-between px-2.5 select-none transition-all ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
          Ad
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-200 truncate">
            Ôn Luyện Sát Hạch Lái Xe 2026
          </p>
          <p className="text-[9px] text-slate-400 truncate">
            Trọn bộ 600 câu hỏi lý thuyết & mô phỏng
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 pl-1.5">
        <div className="px-2 py-0.5 rounded bg-sky-600/30 text-sky-300 text-[10px] font-bold border border-sky-500/30 cursor-pointer">
          Xem
        </div>
        {closable && (
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
            title="Ẩn"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
