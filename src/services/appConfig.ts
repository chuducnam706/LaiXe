import {
  fetchEnableAds,
  fetchTheoryQuestionsPerAd,
  fetchDailyPlayLimit,
  fetchGuestTrialMinutes,
  fetchHistoryRetentionHours,
  fetchRewardBonusPlays,
} from '../firebase';

export interface AppConfig {
  enableAds: boolean;
  theoryQuestionsPerAd: number;
  dailyPlayLimit: number;
  guestTrialMinutes: number;
  historyRetentionHours: number;
  rewardBonusPlays: number;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  enableAds: true,
  theoryQuestionsPerAd: 5,
  dailyPlayLimit: 5,
  guestTrialMinutes: 3,
  historyRetentionHours: 3,
  rewardBonusPlays: 3,
};

const STORAGE_CACHE_KEY = 'app_global_system_config_v1';

// Read any previously cached config from localStorage for instant start
function getInitialConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_APP_CONFIG,
        ...parsed,
      };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULT_APP_CONFIG };
}

let cachedConfig: AppConfig = getInitialConfig();
let cachedTheoryDataset: any = null;
let preloadPromise: Promise<AppConfig> | null = null;

/**
 * Lấy cấu hình hệ thống hiện tại (truy xuất tức thì 0ms từ bộ nhớ RAM).
 */
export function getAppConfig(): AppConfig {
  return cachedConfig;
}

/**
 * Lấy số lượng câu hỏi lý thuyết cần chuyển tiếp trước khi reload quảng cáo mới.
 * Luôn fallback an toàn về 5 nếu không có hoặc giá trị <= 0.
 */
export function getTheoryQuestionsPerAd(): number {
  return typeof cachedConfig.theoryQuestionsPerAd === 'number' &&
    cachedConfig.theoryQuestionsPerAd > 0
    ? cachedConfig.theoryQuestionsPerAd
    : 5;
}

/**
 * Lấy bộ dữ liệu 600 câu hỏi lý thuyết đã được nạp sẵn từ Splash.
 */
export function getCachedTheoryDataset(): any | null {
  return cachedTheoryDataset;
}

export function setCachedTheoryDataset(data: any): void {
  cachedTheoryDataset = data;
}

/**
 * Helper thêm timeout cho Promise để đảm bảo ứng dụng không bao giờ bị treo nếu mạng lag.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, timeoutMs);

    promise
      .then((res) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(res);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

/**
 * Tải tập trung toàn bộ cấu hình Firebase + dữ liệu 600 câu hỏi ngay trong màn hình Splash.
 * Chạy song song tất cả các request, hoàn tất trong ~1-2 giây.
 */
export async function preloadAppConfigAndData(
  onProgress?: (progress: number, message: string) => void
): Promise<AppConfig> {
  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = (async () => {
    onProgress?.(25, 'Đang nạp cấu hình hệ thống & máy chủ Firebase...');

    // 1. Tải song song tất cả các key từ Firebase (timeout an toàn 2.5s)
    const configFetchPromise = Promise.allSettled([
      fetchEnableAds(),
      fetchTheoryQuestionsPerAd(),
      fetchDailyPlayLimit(),
      fetchGuestTrialMinutes(),
      fetchHistoryRetentionHours(),
      fetchRewardBonusPlays(),
    ]).then(([adsRes, theoryRes, dailyRes, guestRes, historyRes, bonusRes]) => {
      const newConfig: AppConfig = {
        enableAds: adsRes.status === 'fulfilled' ? adsRes.value : cachedConfig.enableAds,
        theoryQuestionsPerAd:
          theoryRes.status === 'fulfilled' && theoryRes.value > 0
            ? theoryRes.value
            : cachedConfig.theoryQuestionsPerAd,
        dailyPlayLimit:
          dailyRes.status === 'fulfilled' && dailyRes.value > 0
            ? dailyRes.value
            : cachedConfig.dailyPlayLimit,
        guestTrialMinutes:
          guestRes.status === 'fulfilled' && guestRes.value > 0
            ? guestRes.value
            : cachedConfig.guestTrialMinutes,
        historyRetentionHours:
          historyRes.status === 'fulfilled' && historyRes.value > 0
            ? historyRes.value
            : cachedConfig.historyRetentionHours,
        rewardBonusPlays:
          bonusRes.status === 'fulfilled' && bonusRes.value > 0
            ? bonusRes.value
            : cachedConfig.rewardBonusPlays,
      };

      cachedConfig = newConfig;

      try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(newConfig));
      } catch {
        // ignore
      }

      return newConfig;
    });

    // 2. Tải sẵn bộ dữ liệu 600 câu hỏi lý thuyết (timeout an toàn 3.0s)
    const questionsFetchPromise = (async () => {
      if (cachedTheoryDataset) return cachedTheoryDataset;
      try {
        const res = await fetch('/data/questions600.json');
        if (res.ok) {
          const json = await res.json();
          cachedTheoryDataset = json;
          return json;
        }
      } catch {
        // ignore, will retry on modal open if needed
      }
      return null;
    })();

    // Chạy song song và cập nhật tiến độ
    await withTimeout(configFetchPromise, 2500, cachedConfig);
    onProgress?.(65, 'Đang nạp bộ đề 600 câu hỏi lý thuyết chuẩn Bộ GTVT...');

    await withTimeout(questionsFetchPromise, 3000, null);
    onProgress?.(95, 'Đồng bộ hệ thống dữ liệu hoàn tất!');

    return cachedConfig;
  })();

  return preloadPromise;
}
