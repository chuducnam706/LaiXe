// Google AdSense for Games / H5 Games Ads Helper
// https://developers.google.com/ad-placement/docs/quickstart

declare global {
  interface Window {
    adsbygoogle?: any[];
    adBreak?: (options: any) => void;
    adConfig?: (options: any) => void;
  }
}

export const GOOGLE_ADSENSE_CLIENT_ID = 'ca-pub-PUBLISHER_ID';
 
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
