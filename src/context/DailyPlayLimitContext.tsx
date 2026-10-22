import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchDailyPlayLimit, fetchGuestTrialMinutes, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface DailyPlayLimitContextType {
  dailyLimit: number;
  guestTrialMinutes: number;
  playsUsed: number;
  playsRemaining: number;
  canPlay: boolean;
  consumePlay: () => boolean;
  timeUntilMidnightVi: string;
  isOutOfPlaysModalOpen: boolean;
  setIsOutOfPlaysModalOpen: (open: boolean) => void;
  refreshLimitFromRemoteConfig: () => Promise<void>;
}

const DailyPlayLimitContext = createContext<DailyPlayLimitContextType | undefined>(undefined);

// Helper to get local date string YYYY-MM-DD
function getLocalDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const DailyPlayLimitProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAdmin, isVip } = useAuth();
  const [dailyLimit, setDailyLimit] = useState<number>(5);
  const [guestTrialMinutes, setGuestTrialMinutes] = useState<number>(3);
  const [playsUsed, setPlaysUsed] = useState<number>(0);
  const [isOutOfPlaysModalOpen, setIsOutOfPlaysModalOpen] = useState<boolean>(false);
  const [timeUntilMidnightVi, setTimeUntilMidnightVi] = useState<string>('');

  const todayKey = getLocalDateKey();

  // 1. Fetch remote config limit and guest trial duration on mount
  const refreshLimitFromRemoteConfig = useCallback(async () => {
    try {
      const [limit, trialMins] = await Promise.all([
        fetchDailyPlayLimit(),
        fetchGuestTrialMinutes(),
      ]);
      setDailyLimit(limit);
      setGuestTrialMinutes(trialMins);
    } catch (err) {
      console.warn('Error fetching remote config values:', err);
    }
  }, []);

  useEffect(() => {
    refreshLimitFromRemoteConfig();
  }, [refreshLimitFromRemoteConfig]);

  // 2. Load plays used for today
  useEffect(() => {
    const loadUsage = async () => {
      if (currentUser) {
        // User logged in: load from localStorage first for instant response, then Firestore
        const localKey = `play_usage_${currentUser.uid}_${todayKey}`;
        const cached = localStorage.getItem(localKey);
        if (cached !== null) {
          setPlaysUsed(parseInt(cached, 10) || 0);
        }

        try {
          const docRef = doc(db, 'users', currentUser.uid, 'daily_usage', todayKey);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const count = snap.data().playsUsed || 0;
            setPlaysUsed(count);
            localStorage.setItem(localKey, String(count));
          } else if (cached === null) {
            setPlaysUsed(0);
          }
        } catch (e) {
          console.warn('Could not sync daily usage from Firestore:', e);
        }
      } else {
        // Guest user: load from localStorage
        const guestKey = `guest_play_usage_${todayKey}`;
        const count = parseInt(localStorage.getItem(guestKey) || '0', 10);
        setPlaysUsed(count);
      }
    };

    loadUsage();
  }, [currentUser, todayKey]);

  // 3. Time until midnight timer
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diffMs = midnight.getTime() - now.getTime();

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setTimeUntilMidnightVi(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  // 4. Consume 1 play when starting or retrying a practice session
  const consumePlay = useCallback((): boolean => {
    // Guest users have unlimited plays (no daily limit, free to enter), but each session is capped by trial timer (3 mins)
    if (!currentUser) {
      return true;
    }

    // Admin (Role 0) and VIP users have unlimited plays
    if (isAdmin || isVip) {
      return true;
    }

    const localKey = `play_usage_${currentUser.uid}_${todayKey}`;
    const storedCount = parseInt(localStorage.getItem(localKey) || '0', 10);
    const currentCount = Math.max(playsUsed, storedCount);

    if (currentCount >= dailyLimit) {
      setIsOutOfPlaysModalOpen(true);
      return false;
    }

    const nextCount = currentCount + 1;
    setPlaysUsed(nextCount);
    localStorage.setItem(localKey, String(nextCount));

    // Sync to Firestore
    try {
      const docRef = doc(db, 'users', currentUser.uid, 'daily_usage', todayKey);
      setDoc(docRef, { playsUsed: nextCount, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.warn('Failed to update daily usage in Firestore:', err);
    }

    return true;
  }, [playsUsed, dailyLimit, currentUser, todayKey, isAdmin, isVip]);

  const isUnlimited = isAdmin || isVip;
  const playsRemaining = isUnlimited ? dailyLimit : Math.max(0, dailyLimit - playsUsed);
  const canPlay = isUnlimited || playsRemaining > 0;

  return (
    <DailyPlayLimitContext.Provider
      value={{
        dailyLimit,
        guestTrialMinutes,
        playsUsed,
        playsRemaining,
        canPlay,
        consumePlay,
        timeUntilMidnightVi,
        isOutOfPlaysModalOpen,
        setIsOutOfPlaysModalOpen,
        refreshLimitFromRemoteConfig,
      }}
    >
      {children}
    </DailyPlayLimitContext.Provider>
  );
};

export const useDailyPlayLimit = () => {
  const context = useContext(DailyPlayLimitContext);
  if (!context) {
    throw new Error('useDailyPlayLimit must be used within DailyPlayLimitProvider');
  }
  return context;
};
