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
        className={`relative w-[300px] h-[250px] overflow-hidden bg-transparent border-0 shadow-none flex flex-col justify-between p-2 select-none ${className}`}
      >
        {/* Close Button */}
        {closable && (
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute top-1 right-1 z-30 p-1 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm border-0"
            title="Đóng quảng cáo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Realistic Monetag Creative Container */}
        <div ref={bannerContainerRef} id={`monetag_${slotId}`} className="flex-1 flex flex-col items-center justify-center text-center my-2 px-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 flex items-center justify-center text-sky-400 mb-2">
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
      </div>
    );
  }

  // Format 2: Header Top Banner (468x60 - Adsterra Banner trực tiếp không viền, không solid)
  if (format === 'header_top') {
    return (
      <div
        className={`relative inline-flex items-center justify-center bg-transparent border-0 shadow-none select-none ${className}`}
      >
        {closable && (
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute -top-2 -right-2 z-30 p-1 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm border-0"
            title="Đóng quảng cáo"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <div className="w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center bg-transparent border-0">
          <iframe
            title="Adsterra 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className="w-[468px] h-[60px] border-0 overflow-hidden bg-transparent"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style></head><body><script type="text/javascript">atOptions = {'key' : '${ADSTERRA_468x60_KEY}','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script type="text/javascript" src="${ADSTERRA_468x60_SCRIPT}"></script></body></html>`}
          />
        </div>
      </div>
    );
  }

  // Format 4: Horizontal Leaderboard
  if (format === 'horizontal_leaderboard') {
    return (
      <div
        className={`relative inline-flex items-center justify-center bg-transparent border-0 shadow-none select-none ${className}`}
      >
        {closable && (
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute -top-2 -right-2 z-30 p-1 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm border-0"
            title="Đóng quảng cáo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center bg-transparent border-0">
          <iframe
            title="Adsterra Leaderboard 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className="w-[468px] h-[60px] border-0 overflow-hidden bg-transparent"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style></head><body><script type="text/javascript">atOptions = {'key' : '${ADSTERRA_468x60_KEY}','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script type="text/javascript" src="${ADSTERRA_468x60_SCRIPT}"></script></body></html>`}
          />
        </div>
      </div>
    );
  }

  // Format 5: Compact Strip
  if (format === 'compact_strip') {
    return (
      <div
        className={`relative inline-flex items-center justify-center bg-transparent border-0 shadow-none mx-auto select-none ${className}`}
      >
        {closable && (
          <button
            onClick={() => setIsDismissed(true)}
            className="absolute -top-2 -right-2 z-30 p-1 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm border-0"
            title="Ẩn"
          >
            <X className="w-3 h-3" />
          </button>
        )}
        <div className="w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center bg-transparent border-0">
          <iframe
            title="Adsterra Strip 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className="w-[468px] h-[60px] border-0 overflow-hidden bg-transparent"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style></head><body><script type="text/javascript">atOptions = {'key' : '${ADSTERRA_468x60_KEY}','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script type="text/javascript" src="${ADSTERRA_468x60_SCRIPT}"></script></body></html>`}
          />
        </div>
      </div>
    );
  }

  // Format 6: Side Skyscraper (Quảng cáo 2 bên trái & phải của màn hình / modal thông báo)
  if (format === 'side_skyscraper') {
    return (
      <div
        className={`relative w-[130px] xl:w-[150px] h-[480px] xl:h-[540px] overflow-hidden bg-transparent border-0 shadow-none flex flex-col justify-between p-3 select-none ${className}`}
      >
        <div className="flex items-center justify-end pb-2">
          {closable && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white transition-colors cursor-pointer border-0 shadow-sm"
              title="Đóng"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center my-3 px-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-600/20 flex items-center justify-center text-sky-400 mb-2.5">
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
        </div>
      </div>
    );
  }

  // Format 3: Mini Floating Banner in Simulation (In-Game Driving Screen)
  return (
    <div
      className={`pointer-events-auto relative inline-flex items-center justify-center bg-transparent border-0 shadow-none select-none ${className}`}
    >
      {closable && (
        <button
          onClick={() => setIsDismissed(true)}
          className="absolute -top-1.5 -right-1.5 z-30 p-1 rounded-full bg-black/70 hover:bg-black text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm border-0"
          title="Đóng quảng cáo"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <div className="w-[320px] h-[44px] overflow-hidden flex items-center justify-center bg-transparent border-0">
        <div className="w-[468px] h-[60px] origin-center scale-[0.68] shrink-0 bg-transparent">
          <iframe
            title="Adsterra In-Game Banner"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className="w-[468px] h-[60px] border-0 overflow-hidden bg-transparent"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style></head><body><script type="text/javascript">atOptions = {'key' : '${ADSTERRA_468x60_KEY}','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};</script><script type="text/javascript" src="${ADSTERRA_468x60_SCRIPT}"></script></body></html>`}
          />
        </div>
      </div>
    </div>
  );
};
