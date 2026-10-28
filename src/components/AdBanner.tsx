import React, { useEffect, useId, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ADSTERRA_468x60_KEY, ADSTERRA_468x60_SCRIPT } from '../utils/ads';
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

function buildAdsterraSrcDoc(instanceId: string): string {
  const safeId = instanceId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden;background:transparent;display:flex;align-items:center;justify-content:center;}</style></head><body><script type="text/javascript">
(function(){
  var sent = false;
  function notifyLoaded() {
    if (sent) return;
    sent = true;
    try { window.parent.postMessage({ type: 'ADSTERRA_LOADED', id: '${safeId}' }, '*'); } catch(e) {}
  }
  var obs = new MutationObserver(function() {
    var innerIframe = document.querySelector('iframe, img, a');
    if (innerIframe) {
      if (innerIframe.tagName === 'IFRAME' || innerIframe.tagName === 'IMG') {
        innerIframe.addEventListener('load', function() { setTimeout(notifyLoaded, 120); });
        setTimeout(notifyLoaded, 650);
      } else {
        setTimeout(notifyLoaded, 350);
      }
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', function() { setTimeout(notifyLoaded, 800); });
})();
atOptions = {'key' : '${ADSTERRA_468x60_KEY}','format' : 'iframe','height' : 60,'width' : 468,'params' : {}};
</script><script type="text/javascript" src="${ADSTERRA_468x60_SCRIPT}"></script></body></html>`;
}

const AdShimmerOverlay: React.FC<{ visible: boolean }> = ({ visible }) => (
  <div
    aria-hidden="true"
    className={`ad-shimmer absolute inset-0 z-10 rounded-lg flex items-center justify-between px-3 transition-opacity duration-300 ${
      visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
    }`}
  >
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      <div className="w-7 h-7 rounded-md bg-slate-700/60 shrink-0" />
      <div className="space-y-1.5 flex-1 max-w-[200px]">
        <div className="h-2.5 w-3/4 rounded bg-slate-700/60" />
        <div className="h-2 w-1/2 rounded bg-slate-800/70" />
      </div>
    </div>
    <span className="text-[9px] font-mono text-slate-400/80 tracking-wider uppercase shrink-0 pl-2">
      Đang tải Ads...
    </span>
  </div>
);

export const AdBanner: React.FC<AdBannerProps> = ({
  format,
  slotId = 'monetag_slot_01',
  className = '',
  closable = false,
}) => {
  const { enableAds, isVip, isAdmin } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const reactId = useId();
  const instanceId = useMemo(
    () => `${slotId}_${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
    [slotId, reactId]
  );
  const srcDoc = useMemo(() => buildAdsterraSrcDoc(instanceId), [instanceId]);

  useEffect(() => {
    if (!enableAds || isVip || isAdmin || isDismissed) return;
    setIsLoaded(false);

    const handleMessage = (e: MessageEvent) => {
      if (
        e.data &&
        typeof e.data === 'object' &&
        e.data.type === 'ADSTERRA_LOADED' &&
        e.data.id === instanceId
      ) {
        setIsLoaded(true);
      }
    };

    window.addEventListener('message', handleMessage);
    // Fallback timeout so shimmer never stays forever if ad network is slow
    const fallbackTimer = window.setTimeout(() => {
      setIsLoaded(true);
    }, 2200);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(fallbackTimer);
    };
  }, [enableAds, isVip, isAdmin, isDismissed, instanceId]);

  if (!enableAds || isVip || isAdmin || isDismissed) return null;

  // Format 1: MREC 300x250
  if (format === 'mrec_300x250') {
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
        <div className="relative w-[300px] h-[44px] overflow-hidden flex items-center justify-center bg-transparent border-0 rounded-lg">
          <AdShimmerOverlay visible={!isLoaded} />
          <div
            className={`w-[468px] h-[60px] origin-center scale-[0.64] shrink-0 bg-transparent transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <iframe
              title={`Adsterra MREC ${slotId}`}
              width={468}
              height={60}
              scrolling="no"
              frameBorder="0"
              className="w-[468px] h-[60px] border-0 overflow-hidden bg-transparent"
              srcDoc={srcDoc}
            />
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
        <div className="relative w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center bg-transparent border-0 rounded-lg">
          <AdShimmerOverlay visible={!isLoaded} />
          <iframe
            title="Adsterra 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className={`w-[468px] h-[60px] border-0 overflow-hidden bg-transparent transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            srcDoc={srcDoc}
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
        <div className="relative w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center bg-transparent border-0 rounded-lg">
          <AdShimmerOverlay visible={!isLoaded} />
          <iframe
            title="Adsterra Leaderboard 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className={`w-[468px] h-[60px] border-0 overflow-hidden bg-transparent transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            srcDoc={srcDoc}
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
        <div className="relative w-[468px] h-[60px] max-w-full overflow-hidden flex items-center justify-center bg-transparent border-0 rounded-lg">
          <AdShimmerOverlay visible={!isLoaded} />
          <iframe
            title="Adsterra Strip 468x60"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className={`w-[468px] h-[60px] border-0 overflow-hidden bg-transparent transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            srcDoc={srcDoc}
          />
        </div>
      </div>
    );
  }

  // Format 6: Side Skyscraper (Quảng cáo 2 bên trái & phải của màn hình / modal thông báo)
  if (format === 'side_skyscraper') {
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
        <div className="relative w-[280px] 2xl:w-[400px] h-[44px] 2xl:h-[54px] overflow-hidden flex items-center justify-center bg-transparent border-0 rounded-lg">
          <AdShimmerOverlay visible={!isLoaded} />
          <div
            className={`w-[468px] h-[60px] origin-center scale-[0.60] 2xl:scale-[0.85] shrink-0 bg-transparent transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <iframe
              title={`Adsterra Side Banner ${slotId}`}
              width={468}
              height={60}
              scrolling="no"
              frameBorder="0"
              className="w-[468px] h-[60px] border-0 overflow-hidden bg-transparent"
              srcDoc={srcDoc}
            />
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
      <div className="relative w-[320px] h-[44px] overflow-hidden flex items-center justify-center bg-transparent border-0 rounded-lg">
        <AdShimmerOverlay visible={!isLoaded} />
        <div
          className={`w-[468px] h-[60px] origin-center scale-[0.68] shrink-0 bg-transparent transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <iframe
            title="Adsterra In-Game Banner"
            width={468}
            height={60}
            scrolling="no"
            frameBorder="0"
            className="w-[468px] h-[60px] border-0 overflow-hidden bg-transparent"
            srcDoc={srcDoc}
          />
        </div>
      </div>
    </div>
  );
};
