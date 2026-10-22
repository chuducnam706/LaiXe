import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
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
      daily_play_limit: 5,
      guest_trial_minutes: 3,
      history_retention_hours: 3,
      enable_vip_features: true,
      enable_ads: 1, // 1: Bật quảng cáo, 0: Tắt quảng cáo
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
 * Returns the configured daily play limit (default: 5).
 */
export async function fetchDailyPlayLimit(): Promise<number> {
  if (!remoteConfig) return 5;
  await syncRemoteConfig();
  const limit = getNumber(remoteConfig, "daily_play_limit");
  return limit > 0 ? limit : 5;
}

/**
 * Fetches and activates the latest guest trial duration in minutes from Remote Config.
 * Value 1, 2, 3... corresponding to number of minutes (default: 3).
 */
export async function fetchGuestTrialMinutes(): Promise<number> {
  if (!remoteConfig) return 3;
  await syncRemoteConfig();
  const mins = getNumber(remoteConfig, "guest_trial_minutes");
  return mins > 0 ? mins : 3;
}

/**
 * Fetches the history retention duration in hours from Remote Config (default: 3 hours).
 * Records older than this duration will be automatically purged.
 */
export async function fetchHistoryRetentionHours(): Promise<number> {
  if (!remoteConfig) return 3;
  await syncRemoteConfig();
  const hours = getNumber(remoteConfig, "history_retention_hours");
  return hours > 0 ? hours : 3;
}

/**
 * Fetches and activates the latest VIP features toggle from Remote Config (default: true).
 * When true, activates VIP mode (unlimited drives, VIP badge).
 * When false, behaves as standard mode with daily play limits.
 */
export async function fetchEnableVipFeatures(): Promise<boolean> {
  if (!remoteConfig) return true;
  await syncRemoteConfig();
  return getBoolean(remoteConfig, "enable_vip_features");
}

/**
 * Fetches and activates the latest Ads toggle from Remote Config (default: 1 / true).
 * 1 (hoặc true) => Bật quảng cáo.
 * 0 (hoặc false) => Tắt quảng cáo hoàn toàn.
 */
export async function fetchEnableAds(): Promise<boolean> {
  if (!remoteConfig) return true;
  await syncRemoteConfig();
  try {
    const valStr = getString(remoteConfig, "enable_ads").trim().toLowerCase();
    if (valStr === "0" || valStr === "false" || valStr === "off") return false;
    if (valStr === "1" || valStr === "true" || valStr === "on") return true;
    const valNum = getNumber(remoteConfig, "enable_ads");
    if (valNum === 0) return false;
    const valBool = getBoolean(remoteConfig, "enable_ads");
    if (valBool === false) return false;
  } catch (e) {
    console.warn("fetchEnableAds parse error:", e);
  }
  return true;
}

