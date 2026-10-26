import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import {
  getRemoteConfig,
  fetchAndActivate,
  getNumber,
  getBoolean,
  getString,
  RemoteConfig
} from "firebase/remote-config";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCFAYF0x79iVQd5Jb41zLmj4JW-JUv9qVQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "planar-courage-478104-s6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "planar-courage-478104-s6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "planar-courage-478104-s6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "61436398088",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:61436398088:web:0b866fe02175b80db69fbd",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-X46WEC02RL"
};

// Initialize Firebase once
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// Remote Config for dynamic parameters (e.g. daily_play_limit, enable_vip_features)
let rc: RemoteConfig | null = null;
if (typeof window !== "undefined") {
  try {
    rc = getRemoteConfig(app);
    // Realtime fetch for live admin adjustments
    rc.settings.minimumFetchIntervalMillis = 0;
    rc.defaultConfig = {
      daily_play_limit: 3, // Dự phòng mặc định luôn là 3 lượt (nếu Remote Config có cấu hình 5 thì lấy 5)
      guest_trial_minutes: 3, // Dự phòng mặc định luôn là 3 phút
      history_retention_hours: 3, // Dự phòng mặc định luôn là 3 giờ
      reward_bonus_plays: 3, // Dự phòng mặc định luôn là 3 lượt
      enable_vip_features: false, // VIP dự phòng luôn là false
      enable_ads: 1, // Quảng cáo dự phòng luôn bật (1 / true)
    };
  } catch (err) {
    console.warn("Firebase Remote Config initialization failed:", err);
  }
}
export const remoteConfig = rc;

let syncPromise: Promise<boolean> | null = null;
export async function syncRemoteConfig(): Promise<boolean> {
  if (!remoteConfig) return false;
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      const ok = await Promise.race([
        fetchAndActivate(remoteConfig),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('RC_TIMEOUT')), 4000)
        ),
      ]);
      return ok;
    } catch (err) {
      console.warn("Firebase Remote Config fetch warning, using defaults:", err);
      return false;
    } finally {
      setTimeout(() => {
        syncPromise = null;
      }, 500);
    }
  })();
  return syncPromise;
}

/**
 * Fetches and activates the latest Remote Config values from Firebase.
 * Returns the configured daily play limit (default fallback: 3).
 */
export async function fetchDailyPlayLimit(): Promise<number> {
  if (!remoteConfig) return 3;
  await syncRemoteConfig();
  const limit = getNumber(remoteConfig, "daily_play_limit");
  return limit > 0 ? limit : 3;
}

/**
 * Fetches and activates the latest guest trial duration in minutes from Remote Config.
 * Value 1, 2, 3... corresponding to number of minutes (default fallback: 3).
 */
export async function fetchGuestTrialMinutes(): Promise<number> {
  if (!remoteConfig) return 3;
  await syncRemoteConfig();
  const mins = getNumber(remoteConfig, "guest_trial_minutes");
  return mins > 0 ? mins : 3;
}

/**
 * Fetches the history retention duration in hours from Remote Config (default fallback: 3 hours).
 * Records older than this duration will be automatically purged.
 */
export async function fetchHistoryRetentionHours(): Promise<number> {
  if (!remoteConfig) return 3;
  await syncRemoteConfig();
  const hours = getNumber(remoteConfig, "history_retention_hours");
  return hours > 0 ? hours : 3;
}

/**
 * Fetches and activates the latest VIP features toggle from Remote Config (default fallback: false).
 * When true, activates VIP mode (unlimited drives, VIP badge).
 * When false, behaves as standard mode with daily play limits.
 */
export async function fetchEnableVipFeatures(): Promise<boolean> {
  if (!remoteConfig) return false;
  await syncRemoteConfig();
  try {
    return getBoolean(remoteConfig, "enable_vip_features");
  } catch {
    return false; // Mặc định VIP luôn là false
  }
}

/**
 * Fetches and activates the latest Ads toggle from Remote Config (default fallback: 1 / true).
 * 1 (hoặc true) => Bật quảng cáo.
 * 0 (hoặc false) => Tắt quảng cáo hoàn toàn.
 */
export async function fetchEnableAds(): Promise<boolean> {
  if (!remoteConfig) return true;
  await syncRemoteConfig();
  try {
    const isLocalhost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.'));

    const valStr = getString(remoteConfig, "enable_ads").trim().toLowerCase();
    if (valStr === "0" || valStr === "false" || valStr === "off") {
      if (isLocalhost) {
        console.log('[RemoteConfig] enable_ads trên Firebase là 0, nhưng chế độ test localhost luôn BẬT quảng cáo.');
        return true;
      }
      return false;
    }
    if (valStr === "1" || valStr === "true" || valStr === "on") return true;
    const valNum = getNumber(remoteConfig, "enable_ads");
    if (valNum === 0) {
      if (isLocalhost) {
        console.log('[RemoteConfig] enable_ads trên Firebase là 0, nhưng chế độ test localhost luôn BẬT quảng cáo.');
        return true;
      }
      return false;
    }
    const valBool = getBoolean(remoteConfig, "enable_ads");
    if (valBool === false) {
      if (isLocalhost) {
        console.log('[RemoteConfig] enable_ads trên Firebase là false, nhưng chế độ test localhost luôn BẬT quảng cáo.');
        return true;
      }
      return false;
    }
  } catch (e) {
    console.warn("fetchEnableAds parse error:", e);
  }
  return true; // Mặc định luôn bật
}

/**
 * Lấy số lượt thi được cộng sau khi xem quảng cáo có thưởng (Rewarded Ad).
 * Bạn có thể điều chỉnh linh hoạt trên Firebase:
 *  - Remote Config: key "reward_bonus_plays" (number: 3, 5...)
 *  - HOẶC Firestore: collection "system_config", document "ad_rewards", field "bonusPlays" (number)
 * Mặc định trả về 3 lượt nếu không lấy được key từ Firebase.
 */
export async function fetchRewardBonusPlays(): Promise<number> {
  // 1. Kiểm tra Remote Config
  if (remoteConfig) {
    try {
      await syncRemoteConfig();
      const val = getNumber(remoteConfig, "reward_bonus_plays");
      if (val > 0) return val;
    } catch {}
  }

  // 2. Kiểm tra Firestore (system_config/ad_rewards)
  try {
    const snap = await getDoc(doc(db, "system_config", "ad_rewards"));
    if (snap.exists()) {
      const data = snap.data();
      const val = data?.bonusPlays ?? data?.reward_bonus_plays;
      if (typeof val === "number" && val > 0) return val;
    }
  } catch {}

  // 3. Mặc định 3 lượt
  return 3;
}

