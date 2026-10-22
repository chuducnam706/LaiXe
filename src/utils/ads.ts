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
export const MONETAG_ZONE_ID = '300595';
export const MONETAG_SCRIPT_URL = 'https://quge5.com/88/tag.min.js';

let adDismissObserver: MutationObserver | null = null;

/**
 * Tự động chỉnh vị trí (không che nút Chọn Bài) và tự động tắt banner thông báo sau 6 giây
 */
export const setupAdAutoDismiss = () => {
  if (typeof window === 'undefined' || adDismissObserver) return;

  adDismissObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          // Nhận diện banner quảng cáo In-Page Push của Monetag
          const text = node.innerText || '';
          const hasAdBadge =
            text.includes('Ad\n') ||
            text.includes('Download paused') ||
            text.includes('Finish setup') ||
            node.querySelector('[class*="close"], svg, button');

          const isFixedOrAbsolute =
            window.getComputedStyle(node).position === 'fixed' ||
            window.getComputedStyle(node).position === 'absolute';

          if (isFixedOrAbsolute && (hasAdBadge || node.id?.includes('monetag'))) {
            // 1. Tự động dịch chuyển xuống dưới thanh Menu để không che nút "Chọn Bài"
            try {
              const currentTop = parseInt(window.getComputedStyle(node).top, 10);
              if (!isNaN(currentTop) && currentTop < 65) {
                node.style.setProperty('top', '70px', 'important');
              }
            } catch {
              // ignore
            }

            // 2. Tự động ẩn đi sau 6 giây
            setTimeout(() => {
              if (document.body.contains(node)) {
                const closeBtn = node.querySelector<HTMLElement>(
                  'button, [class*="close"], [aria-label*="close"], [title*="close"], svg'
                );
                if (closeBtn && typeof closeBtn.click === 'function') {
                  closeBtn.click();
                } else {
                  node.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                  node.style.opacity = '0';
                  node.style.transform = 'translateY(-20px)';
                  setTimeout(() => {
                    try {
                      node.remove();
                    } catch {}
                  }, 650);
                }
              }
            }, 6000);
          }
        }
      }
    }
  });

  try {
    adDismissObserver.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    console.warn('[AdAutoDismiss] Error observing body:', e);
  }
};

/**
 * Đồng bộ trạng thái bật/tắt quảng cáo Monetag dựa theo Firebase Remote Config (enable_ads)
 */
export const syncMonetagAds = (enabled: boolean) => {
  if (typeof window === 'undefined') return;

  const scriptId = 'monetag-multitag-script';
  const existingScript = document.getElementById(scriptId);

  if (!enabled) {
    console.log('[Monetag] 🔴 Đã tắt quảng cáo theo cấu hình Firebase Remote Config (enable_ads = 0/false)');
    // Gỡ bỏ thẻ script nếu đang có
    if (existingScript) {
      existingScript.remove();
    }
    // Dọn dẹp observer nếu có
    if (adDismissObserver) {
      adDismissObserver.disconnect();
      adDismissObserver = null;
    }
    return;
  }

  // Nếu được bật (enabled === true):
  if (!existingScript) {
    console.log('[Monetag] 🟢 Đang kích hoạt quảng cáo Monetag (enable_ads = 1/true)');
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = MONETAG_SCRIPT_URL;
    script.dataset.zone = MONETAG_ZONE_ID;
    script.async = true;
    script.dataset.cfasync = 'false';
    document.head.appendChild(script);

    // Kích hoạt tính năng tự động ẩn thông báo sau 6 giây & không che nút Chọn Bài
    setupAdAutoDismiss();
  }
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
