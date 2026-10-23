// Google AdSense for Games / H5 Games Ads Helper
// https://developers.google.com/ad-placement/docs/quickstart

declare global {
  interface Window {
    adsbygoogle?: any[];
    adBreak?: (options: any) => void;
    adConfig?: (options: any) => void;
  }
}

export const GOOGLE_ADSENSE_CLIENT_ID = 'ca-pub-4568419367261236';

/**
 * Xóa bỏ triệt để mọi dấu vết của Monetag và các mạng quảng cáo bên thứ ba
 */
export const purgeThirdPartyAds = () => {
  if (typeof window === 'undefined') return;

  // 1. Gỡ bỏ tất cả các thẻ script liên quan đến Monetag / nap5k
  const scripts = document.querySelectorAll(
    'script[src*="nap5k"], script[src*="monetag"], script[id*="monetag"], script[data-zone]'
  );
  scripts.forEach((s) => {
    try {
      s.remove();
      console.log('[AdPurge] 🧹 Đã gỡ bỏ script bên thứ ba:', (s as HTMLScriptElement).src || s.id);
    } catch {}
  });

  // 2. Tìm và xóa sạch mọi phần tử popup / push banner mà script trước đó đã tiêm vào DOM
  const suspiciousNodes = document.querySelectorAll('div, iframe, aside, section');
  suspiciousNodes.forEach((node) => {
    const el = node as HTMLElement;
    const text = el.innerText || '';
    const hasSpamText =
      text.includes('Missed call') ||
      text.includes('bonus of') ||
      text.includes('Download paused') ||
      text.includes('Finish setup') ||
      text.includes('nap5k');

    const hasSpamId =
      el.id?.includes('monetag') ||
      el.id?.includes('nap5k') ||
      el.getAttribute('data-zone') ||
      el.className?.toString().includes('monetag');

    if (hasSpamText || hasSpamId) {
      try {
        el.remove();
        console.log('[AdPurge] 🧹 Đã xóa phần tử quảng cáo lạ:', el);
      } catch {}
    }
  });

  // 3. Hủy bỏ mọi Service Worker lạ (nếu script quảng cáo từng cố đăng ký)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        if (reg.scope && !reg.scope.includes(window.location.origin)) {
          reg.unregister();
        }
      }
    }).catch(() => {});
  }
};

/**
 * Hàm tương thích ngược: Luôn dọn sạch quảng cáo bên thứ ba
 */
export const syncMonetagAds = (_enabled?: boolean) => {
  purgeThirdPartyAds();
};

export const isAdsGloballyEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  const cached = localStorage.getItem('sys_enable_ads');
  if (cached === 'false') return false;
  const isVip = localStorage.getItem('sys_user_is_vip') === 'true';
  if (isVip) return false;
  return true;
};

/**
 * Trigger an AdBreak in Google H5 Games Ads
 */
export const triggerAdBreak = (
  type: 'start' | 'next' | 'pause' | 'browse' | 'reward',
  name: string,
  callbacks?: {
    beforeAd?: () => void;
    afterAd?: () => void;
    adBreakDone?: (placementInfo: any) => void;
    beforeReward?: (showAdFn: () => void) => void;
    adViewed?: () => void;
    adDismissed?: () => void;
  }
) => {
  if (!isAdsGloballyEnabled()) {
    console.log(`[Google Ads AFG] Ads disabled via Firebase Remote Config enable_ads=0 (type=${type}, name=${name})`);
    callbacks?.afterAd?.();
    callbacks?.adBreakDone?.({ breakStatus: 'disabled_by_remote_config' });
    return;
  }

  if (typeof window !== 'undefined' && typeof window.adBreak === 'function') {
    try {
      console.log(`[Google Ads AFG] Calling adBreak: type=${type}, name=${name}`);
      window.adBreak({
        type,
        name,
        beforeAd: () => {
          console.log('[Google Ads AFG] beforeAd triggered');
          callbacks?.beforeAd?.();
        },
        afterAd: () => {
          console.log('[Google Ads AFG] afterAd triggered');
          callbacks?.afterAd?.();
        },
        adBreakDone: (info: any) => {
          console.log('[Google Ads AFG] adBreakDone:', info);
          callbacks?.adBreakDone?.(info);
        },
        ...(type === 'reward'
          ? {
              beforeReward: (showAdFn: any) => {
                if (callbacks?.beforeReward) {
                  callbacks.beforeReward(showAdFn);
                } else {
                  showAdFn();
                }
              },
              adViewed: () => {
                console.log('[Google Ads AFG] adViewed - Reward granted!');
                callbacks?.adViewed?.();
              },
              adDismissed: () => {
                console.log('[Google Ads AFG] adDismissed');
                callbacks?.adDismissed?.();
              },
            }
          : {}),
      });
      return;
    } catch (err) {
      console.warn('[Google Ads AFG] adBreak execution error:', err);
    }
  }

  // Fallback
  callbacks?.afterAd?.();
  callbacks?.adBreakDone?.({ breakStatus: 'not_ready' });
};
