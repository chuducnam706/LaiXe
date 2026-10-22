import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db, fetchHistoryRetentionHours } from '../firebase';
import { PracticeAttemptResult } from '../types/course';

export type UserRole = 0 | 1; // 0: Admin, 1: User

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  licenseClass: string; // 'B1' | 'B2' | 'C'
  role: UserRole; // 0: Admin, 1: User
  vipExpiresAt?: string; // ISO date string when VIP expires
  createdAt: string;
}

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  isAdmin: boolean;
  isUser: boolean;
  isOwner: boolean;
  isCustomer: boolean;
  isVip: boolean;
  vipExpiresAt: string | null;
  vipRemainingText: string | null;
  loading: boolean;
  guestName: string;
  effectiveName: string;
  isGuest: boolean;
  register: (email: string, pass: string, displayName: string, licenseClass: string) => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  saveExamResult: (result: PracticeAttemptResult) => Promise<void>;
  examHistory: PracticeAttemptResult[];
  refreshHistory: () => Promise<void>;
  retentionHours: number;
  updateUserRole: (uid: string, newRole: UserRole) => Promise<void>;
  changeAdminPassword: (newPass: string) => boolean;
  getAdminPassword: () => string;
  loginAsPresetRole: (role: UserRole) => void;
  generateVipCode: (days: number) => Promise<string>;
  redeemVipCode: (code: string) => Promise<{ success: boolean; message: string; days?: number }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [retentionHours, setRetentionHours] = useState<number>(3);
  const guestName = 'user';
  const [examHistory, setExamHistory] = useState<PracticeAttemptResult[]>([]);

  // Listen to Auth State and custom sessions
  useEffect(() => {
    // 1. Check local custom admin session first
    const customSession = localStorage.getItem('custom_auth_session');
    if (customSession) {
      try {
        const parsed = JSON.parse(customSession);
        if (parsed.user && parsed.profile) {
          setCurrentUser(parsed.user);
          setUserProfile(parsed.profile);
          setLoading(false);
          return;
        }
      } catch {
        localStorage.removeItem('custom_auth_session');
      }
    }

    // 2. Listen to Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Don't overwrite active custom admin session
      if (localStorage.getItem('custom_auth_session')) {
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      if (user) {
        await loadUserProfile(user.uid, user.email || '', user.displayName || '');
        await loadUserExamHistory(user.uid);
      } else {
        setUserProfile(null);
        setExamHistory([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loadUserProfile = async (uid: string, email: string, defaultName: string) => {
    const cachedRole = localStorage.getItem(`user_role_${uid}`);

    try {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const role: UserRole =
          cachedRole !== null
            ? (Number(cachedRole) === 0 ? 0 : 1)
            : data.role !== undefined
            ? (Number(data.role) === 0 ? 0 : 1)
            : (email.toLowerCase().includes('admin') ? 0 : 1);

        const localVipExp = localStorage.getItem(`vip_expires_${uid}`);
        let vipExpiresAt = data.vipExpiresAt || localVipExp || undefined;
        if (vipExpiresAt && new Date(vipExpiresAt).getTime() <= Date.now()) {
          vipExpiresAt = undefined;
          localStorage.removeItem(`vip_expires_${uid}`);
          setDoc(userDocRef, { vipExpiresAt: null }, { merge: true }).catch(() => {});
        } else if (vipExpiresAt) {
          localStorage.setItem(`vip_expires_${uid}`, vipExpiresAt);
        }

        setUserProfile({
          uid,
          email,
          displayName: data.displayName || defaultName || email.split('@')[0],
          licenseClass: data.licenseClass || 'B2',
          role,
          vipExpiresAt,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      } else {
        const initialRole: UserRole =
          cachedRole !== null
            ? (Number(cachedRole) === 0 ? 0 : 1)
            : (email.toLowerCase().includes('admin') ? 0 : 1);

        const localVipExp = localStorage.getItem(`vip_expires_${uid}`);
        const vipExpiresAt = localVipExp && new Date(localVipExp).getTime() > Date.now() ? localVipExp : undefined;

        const fallbackProfile: UserProfile = {
          uid,
          email,
          displayName: defaultName || email.split('@')[0],
          licenseClass: 'B2',
          role: initialRole,
          vipExpiresAt,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userDocRef, fallbackProfile, { merge: true });
        setUserProfile(fallbackProfile);
      }
    } catch (err) {
      console.warn('Cannot load profile from Firestore, using local fallback:', err);
      const role: UserRole =
        cachedRole !== null
          ? (Number(cachedRole) === 0 ? 0 : 1)
          : (email.toLowerCase().includes('admin') ? 0 : 1);

      const localVipExp = localStorage.getItem(`vip_expires_${uid}`);
      const vipExpiresAt = localVipExp && new Date(localVipExp).getTime() > Date.now() ? localVipExp : undefined;

      const localProfile: UserProfile = {
        uid,
        email,
        displayName: defaultName || email.split('@')[0],
        licenseClass: 'B2',
        role,
        vipExpiresAt,
        createdAt: new Date().toISOString(),
      };
      setUserProfile(localProfile);
    }
  };

  const loadUserExamHistory = async (uid: string) => {
    let hours = 3;
    try {
      hours = await fetchHistoryRetentionHours();
      setRetentionHours(hours);
    } catch {
      hours = 3;
    }
    const cutoffTimeMs = Date.now() - hours * 60 * 60 * 1000;

    try {
      const q = query(
        collection(db, 'exam_records'),
        where('userId', '==', uid)
      );
      const snap = await getDocs(q);
      const records: PracticeAttemptResult[] = [];
      const expiredDocIds: string[] = [];

      snap.forEach((d) => {
        const item = d.data().result as PracticeAttemptResult;
        const itemTimeMs = new Date(item.timestampIso).getTime();

        // Chỉ giữ lại kết quả trong vòng 3 giờ
        if (itemTimeMs >= cutoffTimeMs) {
          records.push(item);
        } else {
          // Các bài thi cũ hơn 3 giờ tự động đưa vào danh sách xóa trên Firestore
          expiredDocIds.push(d.id);
        }
      });

      // Sắp xếp bài mới nhất lên đầu
      records.sort((a, b) => new Date(b.timestampIso).getTime() - new Date(a.timestampIso).getTime());
      setExamHistory(records);
      localStorage.setItem(`exam_history_${uid}`, JSON.stringify(records));

      // Xóa ngầm các document cũ hơn 3 giờ khỏi Firestore để giải phóng bộ nhớ
      if (expiredDocIds.length > 0) {
        Promise.all(expiredDocIds.map((docId) => deleteDoc(doc(db, 'exam_records', docId)))).catch((err) => {
          console.warn('Could not auto-purge expired exam records from Firestore:', err);
        });
      }
    } catch (err) {
      console.warn('Firestore history load failed, trying localStorage:', err);
      const cached = localStorage.getItem(`exam_history_${uid}`);
      if (cached) {
        try {
          const allCached = JSON.parse(cached) as PracticeAttemptResult[];
          const validCached = allCached.filter(
            (item) => new Date(item.timestampIso).getTime() >= cutoffTimeMs
          );
          setExamHistory(validCached);
          localStorage.setItem(`exam_history_${uid}`, JSON.stringify(validCached));
        } catch {
          setExamHistory([]);
        }
      }
    }
  };

  const register = async (email: string, pass: string, displayName: string, licenseClass: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName });

    const role: UserRole = email.toLowerCase().includes('admin') ? 0 : 1;

    const profileData: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: displayName || email.split('@')[0],
      licenseClass: licenseClass || 'B2',
      role, // Default: 1 (User)
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', cred.user.uid), profileData);
    } catch (e) {
      console.warn('Could not save profile to firestore:', e);
    }

    setUserProfile(profileData);
  };

  const login = async (identifier: string, pass: string) => {
    const cleanId = identifier.trim().toLowerCase();
    const storedAdminPass = localStorage.getItem('system_admin_password') || 'admin';

    // 1. Admin login check: tài khoản admin, mật khẩu admin (hoặc mật khẩu admin đã đổi)
    if (
      (cleanId === 'admin' || cleanId === 'admin@laixe.vn' || cleanId === 'admin@gmail.com') &&
      pass === storedAdminPass
    ) {
      const adminUser = {
        uid: 'admin_master_001',
        email: 'admin@laixe.vn',
        displayName: 'Quản Trị Viên (Admin)',
        emailVerified: true,
        isAnonymous: false,
      } as unknown as User;

      const adminProfile: UserProfile = {
        uid: 'admin_master_001',
        email: 'admin@laixe.vn',
        displayName: 'Quản Trị Viên (Admin)',
        licenseClass: 'C',
        role: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      setCurrentUser(adminUser);
      setUserProfile(adminProfile);
      localStorage.setItem(
        'custom_auth_session',
        JSON.stringify({ user: adminUser, profile: adminProfile })
      );
      return;
    }

    // 2. Regular Firebase Auth Login
    const emailToUse = cleanId.includes('@') ? cleanId : `${cleanId}@laixe.vn`;
    await signInWithEmailAndPassword(auth, emailToUse, pass);
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await loadUserProfile(
      result.user.uid,
      result.user.email || '',
      result.user.displayName || ''
    );
  };

  const logout = async () => {
    localStorage.removeItem('custom_auth_session');
    await signOut(auth);
    setCurrentUser(null);
    setUserProfile(null);
    setExamHistory([]);
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    localStorage.setItem(`user_role_${uid}`, String(newRole));
    if (currentUser?.uid === uid && userProfile) {
      const updatedProfile = { ...userProfile, role: newRole };
      setUserProfile(updatedProfile);
      const customSession = localStorage.getItem('custom_auth_session');
      if (customSession) {
        try {
          const parsed = JSON.parse(customSession);
          parsed.profile = updatedProfile;
          localStorage.setItem('custom_auth_session', JSON.stringify(parsed));
        } catch {}
      }
    }
    try {
      await setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true });
    } catch (e) {
      console.warn('Could not sync updated role to Firestore:', e);
    }
  };

  const changeAdminPassword = (newPass: string): boolean => {
    if (!newPass || newPass.trim().length === 0) return false;
    localStorage.setItem('system_admin_password', newPass.trim());
    return true;
  };

  const getAdminPassword = (): string => {
    return localStorage.getItem('system_admin_password') || 'admin';
  };

  const loginAsPresetRole = (role: UserRole) => {
    const roleTitles: Record<UserRole, { uid: string; email: string; name: string; license: string }> = {
      0: { uid: 'admin_master_001', email: 'admin@laixe.vn', name: 'Quản Trị Viên (Admin)', license: 'C' },
      1: { uid: 'user_demo_001', email: 'hocvien@laixe.vn', name: 'Người Dùng Luyện Tập (User)', license: 'B2' },
    };
    const info = roleTitles[role];
    const user = {
      uid: info.uid,
      email: info.email,
      displayName: info.name,
      emailVerified: true,
      isAnonymous: false,
    } as unknown as User;

    const profile: UserProfile = {
      uid: info.uid,
      email: info.email,
      displayName: info.name,
      licenseClass: info.license,
      role,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    setCurrentUser(user);
    setUserProfile(profile);
    localStorage.setItem('custom_auth_session', JSON.stringify({ user, profile }));
  };

  const saveExamResult = async (result: PracticeAttemptResult) => {
    if (!currentUser) return;

    let hours = 3;
    try {
      hours = await fetchHistoryRetentionHours();
      setRetentionHours(hours);
    } catch {
      hours = 3;
    }
    const cutoffTimeMs = Date.now() - hours * 60 * 60 * 1000;
    const expireAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    // 1. Lưu local và tự động lọc bỏ bản ghi cũ hơn 3 giờ
    setExamHistory((prev) => {
      const updated = [result, ...prev].filter(
        (item) => new Date(item.timestampIso).getTime() >= cutoffTimeMs
      );
      localStorage.setItem(`exam_history_${currentUser.uid}`, JSON.stringify(updated));
      return updated;
    });

    // 2. Đồng bộ Firestore kèm trường expireAt (hết hạn sau 3 giờ)
    try {
      await addDoc(collection(db, 'exam_records'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: userProfile?.displayName || 'Học viên',
        result,
        createdAt: serverTimestamp(),
        expireAt, // 3 giờ sau
      });
    } catch (err) {
      console.warn('Could not sync exam record to Firestore (check rules):', err);
    }
  };

  const refreshHistory = async () => {
    if (currentUser) {
      await loadUserExamHistory(currentUser.uid);
    }
  };

  const generateVipCode = async (days: number): Promise<string> => {
    const validDays = Math.max(1, Math.floor(days));
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let rand = '';
    for (let i = 0; i < 5; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `VIP${validDays}D-${rand}`;

    const keyData = {
      code,
      days: validDays,
      createdAt: new Date().toISOString(),
      isRedeemed: false,
    };

    // 1. Lưu Firestore
    try {
      await setDoc(doc(db, 'vip_keys', code), keyData);
    } catch (err) {
      console.warn('Could not save VIP key to Firestore:', err);
    }

    // 2. Lưu local cache
    try {
      const stored = localStorage.getItem('system_vip_keys');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(keyData);
      localStorage.setItem('system_vip_keys', JSON.stringify(list));
    } catch {}

    return code;
  };

  const redeemVipCode = async (
    inputCode: string
  ): Promise<{ success: boolean; message: string; days?: number }> => {
    if (!currentUser) {
      return { success: false, message: 'Vui lòng đăng nhập trước khi kích hoạt mã VIP!' };
    }

    const cleanCode = inputCode.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: 'Vui lòng nhập mã VIP!' };
    }

    let keyData: any = null;

    // 1. Kiểm tra Firestore
    try {
      const snap = await getDoc(doc(db, 'vip_keys', cleanCode));
      if (snap.exists()) {
        keyData = snap.data();
      }
    } catch (err) {
      console.warn('Firestore VIP check failed, checking local:', err);
    }

    // 2. Kiểm tra local nếu Firestore chưa có
    if (!keyData) {
      try {
        const stored = localStorage.getItem('system_vip_keys');
        if (stored) {
          const list = JSON.parse(stored);
          keyData = list.find((k: any) => k.code === cleanCode);
        }
      } catch {}
    }

    if (!keyData) {
      return { success: false, message: 'Mã VIP không tồn tại trên hệ thống!' };
    }

    if (keyData.isRedeemed) {
      return { success: false, message: 'Mã VIP này đã được sử dụng!' };
    }

    const days = Number(keyData.days) || 1;
    const now = Date.now();
    const currentExpiry =
      userProfile?.vipExpiresAt && new Date(userProfile.vipExpiresAt).getTime() > now
        ? new Date(userProfile.vipExpiresAt).getTime()
        : now;

    const newExpiryTime = currentExpiry + days * 24 * 60 * 60 * 1000;
    const newExpiresAt = new Date(newExpiryTime).toISOString();

    // Cập nhật UserProfile
    const updatedProfile: UserProfile = {
      ...(userProfile || {
        uid: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || 'User',
        licenseClass: 'B2',
        role: 1,
        createdAt: new Date().toISOString(),
      }),
      vipExpiresAt: newExpiresAt,
    };
    setUserProfile(updatedProfile);
    localStorage.setItem(`vip_expires_${currentUser.uid}`, newExpiresAt);

    // Cập nhật session nếu có
    const customSession = localStorage.getItem('custom_auth_session');
    if (customSession) {
      try {
        const parsed = JSON.parse(customSession);
        parsed.profile = updatedProfile;
        localStorage.setItem('custom_auth_session', JSON.stringify(parsed));
      } catch {}
    }

    // Cập nhật Firestore User
    try {
      await setDoc(
        doc(db, 'users', currentUser.uid),
        { vipExpiresAt: newExpiresAt },
        { merge: true }
      );
    } catch (e) {
      console.warn('Could not update user VIP on Firestore:', e);
    }

    // Đánh dấu Key đã được kích hoạt và gán expiresAt để tự động xóa khi hết hạn
    const updatedKey = {
      ...keyData,
      isRedeemed: true,
      redeemedBy: currentUser.uid,
      redeemedAt: new Date().toISOString(),
      expiresAt: newExpiresAt,
    };

    try {
      await setDoc(doc(db, 'vip_keys', cleanCode), updatedKey, { merge: true });
    } catch {}

    try {
      const stored = localStorage.getItem('system_vip_keys');
      if (stored) {
        const list = JSON.parse(stored);
        const idx = list.findIndex((k: any) => k.code === cleanCode);
        if (idx >= 0) {
          list[idx] = updatedKey;
        }
        localStorage.setItem('system_vip_keys', JSON.stringify(list));
      }
    } catch {}

    return {
      success: true,
      message: `Kích hoạt thành công ${days} ngày VIP!`,
      days,
    };
  };

  // Dọn dẹp các mã VIP đã hết hạn khỏi Firestore & LocalStorage để giải phóng dung lượng
  useEffect(() => {
    const purgeExpiredKeys = async () => {
      const now = Date.now();

      // Dọn local
      try {
        const stored = localStorage.getItem('system_vip_keys');
        if (stored) {
          const list = JSON.parse(stored);
          const valid = list.filter((k: any) => !k.expiresAt || new Date(k.expiresAt).getTime() > now);
          localStorage.setItem('system_vip_keys', JSON.stringify(valid));
        }
      } catch {}

      // Dọn Firestore
      try {
        const q = query(collection(db, 'vip_keys'), where('isRedeemed', '==', true));
        const snap = await getDocs(q);
        snap.forEach((d) => {
          const data = d.data();
          if (data.expiresAt && new Date(data.expiresAt).getTime() <= now) {
            deleteDoc(doc(db, 'vip_keys', d.id)).catch(() => {});
          }
        });
      } catch {}
    };

    purgeExpiredKeys();
  }, []);

  const nowMs = Date.now();
  const currentRole: UserRole | null = userProfile?.role !== undefined ? userProfile.role : null;
  const isAdmin = currentRole === 0;
  const isUser = currentRole === 1;
  const isOwner = false;
  const isCustomer = currentRole === 1;

  const isVip =
    !isAdmin &&
    !!userProfile?.vipExpiresAt &&
    new Date(userProfile.vipExpiresAt).getTime() > nowMs;

  const vipExpiresAt = isVip && userProfile?.vipExpiresAt ? userProfile.vipExpiresAt : null;

  const vipRemainingText = (() => {
    if (!isVip || !userProfile?.vipExpiresAt) return null;
    const diffMs = new Date(userProfile.vipExpiresAt).getTime() - nowMs;
    if (diffMs <= 0) return null;
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
    if (days >= 1) {
      return `Còn ${days} ngày ${hours > 0 ? `${hours}h` : ''}`.trim();
    }
    return `Còn ${hours}h ${mins}p`;
  })();

  const effectiveName = currentUser
    ? (userProfile?.displayName || currentUser.email?.split('@')[0] || 'Học viên')
    : guestName;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        userRole: currentRole,
        isAdmin,
        isUser,
        isOwner,
        isCustomer,
        isVip,
        vipExpiresAt,
        vipRemainingText,
        loading,
        guestName,
        effectiveName,
        isGuest: !currentUser,
        register,
        login,
        loginWithGoogle,
        logout,
        saveExamResult,
        examHistory,
        refreshHistory,
        retentionHours,
        updateUserRole,
        changeAdminPassword,
        getAdminPassword,
        loginAsPresetRole,
        generateVipCode,
        redeemVipCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
