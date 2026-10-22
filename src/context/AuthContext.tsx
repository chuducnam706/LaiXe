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
import { auth, db, fetchHistoryRetentionHours, fetchEnableVipFeatures, fetchEnableAds } from '../firebase';
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

export interface StoredLocalUser {
  uid: string;
  email: string;
  pass: string;
  displayName: string;
  licenseClass: string;
  role: UserRole;
  createdAt: string;
  vipExpiresAt?: string;
}

const LOCAL_USERS_KEY = 'local_registered_users_db';

export const getStoredLocalUsers = (): StoredLocalUser[] => {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveStoredLocalUser = (user: StoredLocalUser) => {
  const list = getStoredLocalUsers();
  const idx = list.findIndex(
    (u) => u.email.toLowerCase() === user.email.toLowerCase() || u.uid === user.uid
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...user };
  } else {
    list.push(user);
  }
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
};

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  isAdmin: boolean;
  isUser: boolean;
  isOwner: boolean;
  isCustomer: boolean;
  enableVipFeatures: boolean;
  enableAds: boolean;
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
  const [enableVipFeatures, setEnableVipFeatures] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const cached = localStorage.getItem('sys_enable_vip_features');
    return cached !== null ? cached === 'true' : true;
  });
  const [enableAds, setEnableAds] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const cached = localStorage.getItem('sys_enable_ads');
    return cached !== null ? cached === 'true' : true;
  });
  const guestName = 'user';
  const [examHistory, setExamHistory] = useState<PracticeAttemptResult[]>([]);

  // Sync Remote Config enable_vip_features
  useEffect(() => {
    fetchEnableVipFeatures().then((enabled) => {
      setEnableVipFeatures(enabled);
      localStorage.setItem('sys_enable_vip_features', String(enabled));
    }).catch(() => {});
  }, []);

  // Sync Remote Config enable_ads
  useEffect(() => {
    fetchEnableAds().then((enabled) => {
      setEnableAds(enabled);
      localStorage.setItem('sys_enable_ads', String(enabled));
    }).catch(() => {});
  }, []);

  // Listen to Auth State and custom sessions
  useEffect(() => {
    // 1. Check local custom admin session or local user session first
    const customSession = localStorage.getItem('custom_auth_session');
    if (customSession) {
      try {
        const parsed = JSON.parse(customSession);
        if (parsed.user && parsed.profile) {
          setCurrentUser(parsed.user);
          setUserProfile(parsed.profile);
          loadUserExamHistory(parsed.user.uid).catch(() => {});
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

  const withFirestoreTimeout = <T,>(promise: Promise<T>, ms = 800): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms)),
    ]);
  };

  const loadUserProfile = async (uid: string, email: string, defaultName: string) => {
    const cachedRole = localStorage.getItem(`user_role_${uid}`);
    const localVipExp = localStorage.getItem(`vip_expires_${uid}`);
    const vipExpiresAt = localVipExp && new Date(localVipExp).getTime() > Date.now() ? localVipExp : undefined;
    const initialRole: UserRole =
      cachedRole !== null
        ? (Number(cachedRole) === 0 ? 0 : 1)
        : (email.toLowerCase().includes('admin') ? 0 : 1);

    // 1. Phục vụ ngay lập tức từ Local để ĐĂNG NHẬP SIÊU TỐC (0ms)
    const initialProfile: UserProfile = {
      uid,
      email,
      displayName: defaultName || email.split('@')[0],
      licenseClass: 'B2',
      role: initialRole,
      vipExpiresAt,
      createdAt: new Date().toISOString(),
    };
    setUserProfile(initialProfile);

    // 2. Thử cập nhật từ Firestore ngầm với timeout 800ms
    try {
      const userDocRef = doc(db, 'users', uid);
      const userSnap = await withFirestoreTimeout(getDoc(userDocRef), 800);

      if (userSnap.exists()) {
        const data = userSnap.data();
        const role: UserRole =
          cachedRole !== null
            ? (Number(cachedRole) === 0 ? 0 : 1)
            : data.role !== undefined
            ? (Number(data.role) === 0 ? 0 : 1)
            : initialRole;

        let serverVipExpiresAt = data.vipExpiresAt || localVipExp || undefined;
        if (serverVipExpiresAt && new Date(serverVipExpiresAt).getTime() <= Date.now()) {
          serverVipExpiresAt = undefined;
          localStorage.removeItem(`vip_expires_${uid}`);
          setDoc(userDocRef, { vipExpiresAt: null }, { merge: true }).catch(() => {});
        } else if (serverVipExpiresAt) {
          localStorage.setItem(`vip_expires_${uid}`, serverVipExpiresAt);
        }

        setUserProfile({
          uid,
          email,
          displayName: data.displayName || defaultName || email.split('@')[0],
          licenseClass: data.licenseClass || 'B2',
          role,
          vipExpiresAt: serverVipExpiresAt,
          createdAt: data.createdAt || initialProfile.createdAt,
        });
      } else {
        setDoc(userDocRef, initialProfile, { merge: true }).catch(() => {});
      }
    } catch {
      // Bỏ qua lỗi Firestore offline/disabled, giao diện đã hiển thị xong ngay từ bước 1
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

    // 1. Phục vụ ngay lập tức từ Local Storage (0ms)
    const cached = localStorage.getItem(`exam_history_${uid}`);
    if (cached) {
      try {
        const allCached = JSON.parse(cached) as PracticeAttemptResult[];
        const validCached = allCached.filter(
          (item) => new Date(item.timestampIso).getTime() >= cutoffTimeMs
        );
        setExamHistory(validCached);
      } catch {
        setExamHistory([]);
      }
    }

    // 2. Thử đồng bộ từ Firestore ngầm với timeout 800ms
    try {
      const q = query(
        collection(db, 'exam_records'),
        where('userId', '==', uid)
      );
      const snap = await withFirestoreTimeout(getDocs(q), 800);
      const records: PracticeAttemptResult[] = [];
      const expiredDocIds: string[] = [];

      snap.forEach((d) => {
        const item = d.data().result as PracticeAttemptResult;
        const itemTimeMs = new Date(item.timestampIso).getTime();

        if (itemTimeMs >= cutoffTimeMs) {
          records.push(item);
        } else {
          expiredDocIds.push(d.id);
        }
      });

      records.sort((a, b) => new Date(b.timestampIso).getTime() - new Date(a.timestampIso).getTime());
      setExamHistory(records);
      localStorage.setItem(`exam_history_${uid}`, JSON.stringify(records));

      if (expiredDocIds.length > 0) {
        Promise.all(expiredDocIds.map((docId) => deleteDoc(doc(db, 'exam_records', docId)))).catch(() => {});
      }
    } catch {
      // Đã có bản ghi local, không chặn luồng ứng dụng
    }
  };

  const register = async (email: string, pass: string, displayName: string, licenseClass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = displayName.trim() || cleanEmail.split('@')[0];
    const role: UserRole = cleanEmail.includes('admin') ? 0 : 1;

    // 1. Kiểm tra tài khoản trong Local DB trước
    const localUsers = getStoredLocalUsers();
    if (localUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
      const err: any = new Error('Email này đã được đăng ký tài khoản khác!');
      err.code = 'auth/email-already-in-use';
      throw err;
    }

    let cred: any = null;
    let fallbackToLocal = false;

    try {
      cred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      await updateProfile(cred.user, { displayName: cleanName });
    } catch (fbErr: any) {
      console.warn('Firebase createUser failed, evaluating local fallback:', fbErr);
      const code = fbErr?.code || '';

      // Nếu là lỗi nhập liệu hoặc email trùng trên Firebase, ném ra để người dùng sửa
      if (
        code === 'auth/email-already-in-use' ||
        code === 'auth/invalid-email' ||
        code === 'auth/weak-password'
      ) {
        throw fbErr;
      }

      // Khi Firebase Auth chưa bật trong Console (CONFIGURATION_NOT_FOUND) hoặc lỗi kết nối,
      // tự động chuyển sang lưu trữ cục bộ mượt mà
      fallbackToLocal = true;
    }

    if (fallbackToLocal || !cred) {
      const localUid = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const newLocalUser: StoredLocalUser = {
        uid: localUid,
        email: cleanEmail,
        pass,
        displayName: cleanName,
        licenseClass: licenseClass || 'B2',
        role,
        createdAt: new Date().toISOString(),
      };
      saveStoredLocalUser(newLocalUser);

      const fakeUser = {
        uid: localUid,
        email: cleanEmail,
        displayName: cleanName,
        emailVerified: true,
        isAnonymous: false,
      } as unknown as User;

      const profileData: UserProfile = {
        uid: localUid,
        email: cleanEmail,
        displayName: cleanName,
        licenseClass: licenseClass || 'B2',
        role,
        createdAt: newLocalUser.createdAt,
      };

      setCurrentUser(fakeUser);
      setUserProfile(profileData);
      localStorage.setItem(
        'custom_auth_session',
        JSON.stringify({ user: fakeUser, profile: profileData })
      );

      // Thử đồng bộ ngầm Firestore nếu mạng khả dụng
      setDoc(doc(db, 'users', localUid), profileData).catch(() => {});
      return;
    }

    // Luồng Firebase thông thường khi Firebase Cloud hoạt động
    const profileData: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email || cleanEmail,
      displayName: cleanName,
      licenseClass: licenseClass || 'B2',
      role,
      createdAt: new Date().toISOString(),
    };

    // Đồng bộ Firestore ngầm trong background (không await)
    setDoc(doc(db, 'users', cred.user.uid), profileData).catch(() => {});
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
      loadUserExamHistory(adminUser.uid).catch(() => {});
      return;
    }

    // 2. Kiểm tra tài khoản đã đăng ký trong Local DB
    const localUsers = getStoredLocalUsers();
    const matchedLocal = localUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.displayName.toLowerCase() === cleanId ||
        u.email.toLowerCase().split('@')[0] === cleanId
    );

    if (matchedLocal) {
      if (matchedLocal.pass !== pass) {
        const err: any = new Error('Mật khẩu không chính xác!');
        err.code = 'auth/wrong-password';
        throw err;
      }
      const fakeUser = {
        uid: matchedLocal.uid,
        email: matchedLocal.email,
        displayName: matchedLocal.displayName,
        emailVerified: true,
        isAnonymous: false,
      } as unknown as User;

      const profile: UserProfile = {
        uid: matchedLocal.uid,
        email: matchedLocal.email,
        displayName: matchedLocal.displayName,
        licenseClass: matchedLocal.licenseClass,
        role: matchedLocal.role,
        vipExpiresAt: matchedLocal.vipExpiresAt,
        createdAt: matchedLocal.createdAt,
      };

      setCurrentUser(fakeUser);
      setUserProfile(profile);
      localStorage.setItem(
        'custom_auth_session',
        JSON.stringify({ user: fakeUser, profile })
      );
      loadUserExamHistory(matchedLocal.uid).catch(() => {});
      return;
    }

    // 3. Regular Firebase Auth Login
    const emailToUse = cleanId.includes('@') ? cleanId : `${cleanId}@laixe.vn`;
    try {
      await signInWithEmailAndPassword(auth, emailToUse, pass);
    } catch (fbErr: any) {
      const code = fbErr?.code || '';
      const msg = fbErr?.message || '';

      // Nếu dịch vụ Firebase Auth chưa kích hoạt và không có trong local DB
      if (
        code === 'auth/configuration-not-found' ||
        code === 'auth/operation-not-allowed' ||
        msg.includes('CONFIGURATION_NOT_FOUND')
      ) {
        const customErr: any = new Error(
          'Tài khoản chưa được đăng ký! Vui lòng chuyển sang tab Đăng ký để tạo tài khoản mới.'
        );
        customErr.code = 'auth/user-not-found';
        throw customErr;
      }
      throw fbErr;
    }
  };

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await loadUserProfile(
        result.user.uid,
        result.user.email || '',
        result.user.displayName || ''
      );
    } catch (fbErr: any) {
      console.warn('Google sign-in error:', fbErr);
      const code = fbErr?.code || '';
      const msg = fbErr?.message || '';
      if (
        code === 'auth/configuration-not-found' ||
        code === 'auth/operation-not-allowed' ||
        code === 'auth/unauthorized-domain' ||
        msg.includes('CONFIGURATION_NOT_FOUND')
      ) {
        const customErr: any = new Error(
          'Đăng nhập Google cần được kích hoạt trên Firebase Console. Bạn vui lòng sử dụng tab Đăng Ký bằng Email/Mật khẩu bên trên!'
        );
        customErr.code = 'auth/operation-not-allowed';
        throw customErr;
      }
      throw fbErr;
    }
  };

  const logout = async () => {
    localStorage.removeItem('custom_auth_session');
    await signOut(auth).catch(() => {});
    setCurrentUser(null);
    setUserProfile(null);
    setExamHistory([]);
  };

  const updateUserRole = async (uid: string, newRole: UserRole) => {
    localStorage.setItem(`user_role_${uid}`, String(newRole));

    // Cập nhật cả trong Local DB nếu tài khoản cục bộ
    const localUsers = getStoredLocalUsers();
    const matched = localUsers.find((u) => u.uid === uid);
    if (matched) {
      matched.role = newRole;
      saveStoredLocalUser(matched);
    }

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
    // Đồng bộ Firestore ngầm trong background (không await)
    setDoc(doc(db, 'users', uid), { role: newRole }, { merge: true }).catch(() => {});
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

    // 1. Lưu local và tự động lọc bỏ bản ghi cũ hơn 3 giờ (tức thì 0ms)
    setExamHistory((prev) => {
      const updated = [result, ...prev].filter(
        (item) => new Date(item.timestampIso).getTime() >= cutoffTimeMs
      );
      localStorage.setItem(`exam_history_${currentUser.uid}`, JSON.stringify(updated));
      return updated;
    });

    // 2. Đồng bộ Firestore kèm trường expireAt (background ngầm, không await)
    addDoc(collection(db, 'exam_records'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: userProfile?.displayName || 'Học viên',
      result,
      createdAt: serverTimestamp(),
      expireAt,
    }).catch(() => {});
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

    // 1. Lưu Local Storage NGAY LẬP TỨC (0ms) - TUYỆT ĐỐI KHÔNG CHỜ ĐỢI
    try {
      const stored = localStorage.getItem('system_vip_keys');
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(keyData);
      localStorage.setItem('system_vip_keys', JSON.stringify(list));
    } catch {}

    // 2. Đồng bộ ngầm Firestore trong background (không await)
    setDoc(doc(db, 'vip_keys', code), keyData).catch(() => {});

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

    // 1. Kiểm tra Local Storage trước NGAY LẬP TỨC (0ms)
    try {
      const stored = localStorage.getItem('system_vip_keys');
      if (stored) {
        const list = JSON.parse(stored);
        keyData = list.find((k: any) => k.code === cleanCode);
      }
    } catch {}

    // 2. Nếu local chưa có, mới thử Firestore ngầm với timeout ngắn 800ms
    if (!keyData) {
      try {
        const snap = await withFirestoreTimeout(getDoc(doc(db, 'vip_keys', cleanCode)), 800);
        if (snap.exists()) {
          keyData = snap.data();
        }
      } catch (err) {
        console.warn('Firestore VIP check skipped or timed out:', err);
      }
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

    // Cập nhật UserProfile ngay lập tức (0ms)
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

    // Cập nhật cả trong Local DB nếu là tài khoản cục bộ
    const localUsers = getStoredLocalUsers();
    const matched = localUsers.find((u) => u.uid === currentUser.uid);
    if (matched) {
      matched.vipExpiresAt = newExpiresAt;
      saveStoredLocalUser(matched);
    }

    // Cập nhật session nếu có
    const customSession = localStorage.getItem('custom_auth_session');
    if (customSession) {
      try {
        const parsed = JSON.parse(customSession);
        parsed.profile = updatedProfile;
        localStorage.setItem('custom_auth_session', JSON.stringify(parsed));
      } catch {}
    }

    // Đánh dấu Key đã được kích hoạt trong Local Cache
    const updatedKey = {
      ...keyData,
      isRedeemed: true,
      redeemedBy: currentUser.uid,
      redeemedAt: new Date().toISOString(),
      expiresAt: newExpiresAt,
    };

    try {
      const stored = localStorage.getItem('system_vip_keys');
      if (stored) {
        const list = JSON.parse(stored);
        const idx = list.findIndex((k: any) => k.code === cleanCode);
        if (idx >= 0) {
          list[idx] = updatedKey;
        } else {
          list.unshift(updatedKey);
        }
        localStorage.setItem('system_vip_keys', JSON.stringify(list));
      }
    } catch {}

    // Cập nhật Firestore ngầm trong background (không await)
    setDoc(doc(db, 'users', currentUser.uid), { vipExpiresAt: newExpiresAt }, { merge: true }).catch(() => {});
    setDoc(doc(db, 'vip_keys', cleanCode), updatedKey, { merge: true }).catch(() => {});

    return {
      success: true,
      message: `Kích hoạt thành công ${days} ngày VIP!`,
      days,
    };
  };

  // Dọn dẹp các mã VIP đã hết hạn khỏi LocalStorage & Firestore
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

      // Dọn Firestore trong background không làm đơ giao diện
      try {
        withFirestoreTimeout(
          getDocs(query(collection(db, 'vip_keys'), where('isRedeemed', '==', true))),
          800
        )
          .then((snap) => {
            snap.forEach((d) => {
              const data = d.data();
              if (data.expiresAt && new Date(data.expiresAt).getTime() <= now) {
                deleteDoc(doc(db, 'vip_keys', d.id)).catch(() => {});
              }
            });
          })
          .catch(() => {});
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

  const hasUserVipCode =
    !!userProfile?.vipExpiresAt &&
    new Date(userProfile.vipExpiresAt).getTime() > nowMs;

  // Khi enableVipFeatures là true (từ Firebase Remote Config) hoặc có mã VIP:
  // Toàn bộ học viên được hưởng quyền VIP (lái xe vô hạn lượt, có huy hiệu VIP).
  // Chỉ tài khoản đã đăng nhập (currentUser) mới có thể là VIP:
  const isVip =
    !isAdmin &&
    Boolean(currentUser) &&
    (enableVipFeatures || hasUserVipCode);

  const vipExpiresAt = userProfile?.vipExpiresAt && hasUserVipCode ? userProfile.vipExpiresAt : null;

  const vipRemainingText = (() => {
    if (!isVip) return null;
    if (userProfile?.vipExpiresAt && hasUserVipCode) {
      const diffMs = new Date(userProfile.vipExpiresAt).getTime() - nowMs;
      if (diffMs > 0) {
        const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const mins = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));
        if (days >= 1) {
          return `Còn ${days} ngày ${hours > 0 ? `${hours}h` : ''}`.trim();
        }
        return `Còn ${hours}h ${mins}p`;
      }
    }
    return enableVipFeatures ? 'Vô hạn (Hệ thống)' : null;
  })();

  // Đồng bộ trạng thái VIP/Admin ra localStorage để tắt toàn bộ quảng cáo cho tài khoản VIP
  useEffect(() => {
    localStorage.setItem('sys_user_is_vip', String(isVip || isAdmin));
  }, [isVip, isAdmin]);

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
        enableVipFeatures,
        enableAds,
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
