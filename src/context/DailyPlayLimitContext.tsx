import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { fetchDailyPlayLimit, fetchGuestTrialMinutes, fetchRewardBonusPlays, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface DailyPlayLimitContextType {
  dailyLimit: number;
  guestTrialMinutes: number;
  playsUsed: number;
  bonusPlays: number;
  rewardBonusPlaysCount: number;
  effectiveDailyLimit: number;
  playsRemaining: number;
  isUnlimited: boolean;
  canPlay: boolean;
  consumePlay: () => boolean;
  addBonusPlays: (count?: number) => Promise<number>;
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
  const { currentUser, isAdmin, isVip, enableVipFeatures } = useAuth();
  const [dailyLimit, setDailyLimit] = useState<number>(3);
  const [guestTrialMinutes, setGuestTrialMinutes] = useState<number>(3);
  const [playsUsed, setPlaysUsed] = useState<number>(0);
  const [bonusPlays, setBonusPlays] = useState<number>(0);
  const [rewardBonusPlaysCount, setRewardBonusPlaysCount] = useState<number>(3);
  const [isOutOfPlaysModalOpen, setIsOutOfPlaysModalOpen] = useState<boolean>(false);
  const [timeUntilMidnightVi, setTimeUntilMidnightVi] = useState<string>('');

  const todayKey = getLocalDateKey();

  // 1. Fetch remote config limit, guest trial duration, and rewarded ad bonus plays on mount
  const refreshLimitFromRemoteConfig = useCallback(async () => {
    try {
      const [limit, trialMins, rewardPlays] = await Promise.all([
        fetchDailyPlayLimit(),
        fetchGuestTrialMinutes(),
        fetchRewardBonusPlays(),
      ]);
      setDailyLimit(limit);
      setGuestTrialMinutes(trialMins);
      setRewardBonusPlaysCount(rewardPlays);
    } catch (err) {
      console.warn('Error fetching remote config values:', err);
    }
  }, []);

  useEffect(() => {
    refreshLimitFromRemoteConfig();
  }, [refreshLimitFromRemoteConfig]);

  // 2. Load plays used and bonus plays for today
  useEffect(() => {
    const loadUsage = async () => {
      if (currentUser) {
        // User logged in: load from localStorage first for instant response, then Firestore
        const localKey = `play_usage_${currentUser.uid}_${todayKey}`;
        const bonusKey = `play_bonus_${currentUser.uid}_${todayKey}`;
        const cached = localStorage.getItem(localKey);
        const cachedBonus = localStorage.getItem(bonusKey);
        if (cached !== null) {
          setPlaysUsed(parseInt(cached, 10) || 0);
        }
        if (cachedBonus !== null) {
          setBonusPlays(parseInt(cachedBonus, 10) || 0);
        }

        try {
          const docRef = doc(db, 'users', currentUser.uid, 'daily_usage', todayKey);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            const count = data.playsUsed || 0;
            const bPlays = data.bonusPlays || 0;
            setPlaysUsed(count);
            setBonusPlays(bPlays);
            localStorage.setItem(localKey, String(count));
            localStorage.setItem(bonusKey, String(bPlays));
          } else if (cached === null) {
            setPlaysUsed(0);
            setBonusPlays(0);
          }
        } catch (e) {
          console.warn('Could not sync daily usage from Firestore:', e);
        }
      } else {
        // Guest user: load from localStorage
        const guestKey = `guest_play_usage_${todayKey}`;
        const guestBonusKey = `guest_play_bonus_${todayKey}`;
        const count = parseInt(localStorage.getItem(guestKey) || '0', 10);
        const bPlays = parseInt(localStorage.getItem(guestBonusKey) || '0', 10);
        setPlaysUsed(count);
        setBonusPlays(bPlays);
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
    if (isAdmin || isVip || enableVipFeatures) {
      return true;
    }

    const localKey = `play_usage_${currentUser.uid}_${todayKey}`;
    const storedCount = parseInt(localStorage.getItem(localKey) || '0', 10);
    const currentCount = Math.max(playsUsed, storedCount);
    const effectiveLimit = dailyLimit + bonusPlays;

    if (currentCount >= effectiveLimit) {
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
  }, [playsUsed, dailyLimit, bonusPlays, currentUser, todayKey, isAdmin, isVip, enableVipFeatures]);

  // 5. Cộng thêm lượt thi khi xem xong quảng cáo có thưởng (Rewarded Ad)
  const addBonusPlays = useCallback(async (count?: number): Promise<number> => {
    const added = typeof count === 'number' && count > 0 ? count : rewardBonusPlaysCount;
    const newBonus = bonusPlays + added;
    setBonusPlays(newBonus);

    if (currentUser) {
      const bonusKey = `play_bonus_${currentUser.uid}_${todayKey}`;
      localStorage.setItem(bonusKey, String(newBonus));
      try {
        const docRef = doc(db, 'users', currentUser.uid, 'daily_usage', todayKey);
        await setDoc(docRef, { bonusPlays: newBonus, updatedAt: new Date().toISOString() }, { merge: true });
      } catch (err) {
        console.warn('Failed to update bonusPlays in Firestore:', err);
      }
    } else {
      const guestBonusKey = `guest_play_bonus_${todayKey}`;
      localStorage.setItem(guestBonusKey, String(newBonus));
    }

    // Tự động đóng modal hết lượt để học viên vào thi ngay
    setIsOutOfPlaysModalOpen(false);
    return newBonus;
  }, [bonusPlays, rewardBonusPlaysCount, currentUser, todayKey]);

  const isUnlimited = isAdmin || isVip || enableVipFeatures;
  const effectiveDailyLimit = dailyLimit + bonusPlays;
  const playsRemaining = isUnlimited ? dailyLimit : Math.max(0, effectiveDailyLimit - playsUsed);
  const canPlay = isUnlimited || playsRemaining > 0;

  useEffect(() => {
    if (isUnlimited && isOutOfPlaysModalOpen) {
      setIsOutOfPlaysModalOpen(false);
    }
  }, [isUnlimited, isOutOfPlaysModalOpen]);

  return (
    <DailyPlayLimitContext.Provider
      value={{
        dailyLimit,
        guestTrialMinutes,
        playsUsed,
        bonusPlays,
        rewardBonusPlaysCount,
        effectiveDailyLimit,
        playsRemaining,
        isUnlimited,
        canPlay,
        consumePlay,
        addBonusPlays,
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
