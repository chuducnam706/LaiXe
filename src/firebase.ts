import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import {
  getRemoteConfig,
  fetchAndActivate,
  getNumber,
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

// Remote Config for dynamic parameters (e.g. daily_play_limit)
let rc: RemoteConfig | null = null;
if (typeof window !== "undefined") {
  try {
    rc = getRemoteConfig(app);
    // In production, cache for 1 hour. During dev, shorter interval.
    rc.settings.minimumFetchIntervalMillis = 60000; // 1 minute
    rc.defaultConfig = {
      daily_play_limit: 5,
      guest_trial_minutes: 3,
      history_retention_hours: 3,
    };
  } catch (err) {
    console.warn("Firebase Remote Config initialization failed:", err);
  }
}
export const remoteConfig = rc;

/**
 * Fetches and activates the latest Remote Config values from Firebase.
 * Returns the configured daily play limit (default: 5).
 */
export async function fetchDailyPlayLimit(): Promise<number> {
  if (!remoteConfig) return 5;
  try {
    await fetchAndActivate(remoteConfig);
    const limit = getNumber(remoteConfig, "daily_play_limit");
    return limit > 0 ? limit : 5;
  } catch (err) {
    console.warn("Could not fetch remote config, using fallback default (5):", err);
    return 5;
  }
}

/**
 * Fetches and activates the latest guest trial duration in minutes from Remote Config.
 * Value 1, 2, 3... corresponding to number of minutes (default: 3).
 */
export async function fetchGuestTrialMinutes(): Promise<number> {
  if (!remoteConfig) return 3;
  try {
    await fetchAndActivate(remoteConfig);
    const mins = getNumber(remoteConfig, "guest_trial_minutes");
    return mins > 0 ? mins : 3;
  } catch (err) {
    console.warn("Could not fetch remote config guest trial minutes, using fallback (3):", err);
    return 3;
  }
}

/**
 * Fetches the history retention duration in hours from Remote Config (default: 3 hours).
 * Records older than this duration will be automatically purged.
 */
export async function fetchHistoryRetentionHours(): Promise<number> {
  if (!remoteConfig) return 3;
  try {
    await fetchAndActivate(remoteConfig);
    const hours = getNumber(remoteConfig, "history_retention_hours");
    return hours > 0 ? hours : 3;
  } catch (err) {
    console.warn("Could not fetch remote config history retention hours, using fallback (3):", err);
    return 3;
  }
}

