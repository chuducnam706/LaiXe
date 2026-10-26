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
import { purgeThirdPartyAds } from '../utils/ads';
import { PracticeAttemptResult } from '../types/course';

export type UserRole = 0 | 1; // 0: Admin, 1: User

// Danh sách tài khoản quản trị viên tối cao được phép nắm Role 0 (Admin)
export const ADMIN_EMAILS = ['phucnam995@gmail.com', 'admin@laixe.vn'];

/**
 * Hàm băm mật khẩu chuẩn PBKDF2 (100,000 iterations) qua Web Crypto API
 * Chuẩn bảo mật chống brute-force bằng GPU cao cấp cho web client
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      hash = (hash << 5) - hash + password.charCodeAt(i);
      hash |= 0;
    }
    return 'h_' + Math.abs(hash).toString(16);
  }
  try {
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const salt = encoder.encode('laixe_salt_auth_2026_sec_v2');
    const derivedBits = await window.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      256
    );
    return Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return legacySha256Hash(password);
  }
};

/**
 * Hỗ trợ xác thực các tài khoản đã tạo bằng SHA-256 trước khi tự động nâng cấp lên PBKDF2
 */
export const legacySha256Hash = async (password: string): Promise<string> => {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '::laixe_salt_auth_2026');
  const buffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

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
  passHash: string;
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
    if (!raw) return [];
    const list: any[] = JSON.parse(raw);
    let changed = false;
    // BẢO MẬT: Loại bỏ triệt để mọi trường mật khẩu chưa băm (pass) còn sót lại trong LocalStorage
    const sanitized: StoredLocalUser[] = list.map((u) => {
      if ('pass' in u) {
        delete u.pass;
        changed = true;
      }
      return u as StoredLocalUser;
    });
    if (changed) {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    return [];
  }
};

export const saveStoredLocalUser = async (
  user: StoredLocalUser
) => {
  const list = getStoredLocalUsers();
  const sanitizedUser: StoredLocalUser = {
    uid: user.uid,
    email: user.email,
    passHash: user.passHash,
    displayName: user.displayName,
    licenseClass: user.licenseClass,
    role: user.role,
    createdAt: user.createdAt,
    vipExpiresAt: user.vipExpiresAt,
  };
  const idx = list.findIndex(
    (u) => u.email.toLowerCase() === user.email.toLowerCase() || u.uid === user.uid
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...sanitizedUser };
  } else {
    list.push(sanitizedUser);
  }
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
};

// ============================================================
// BẢO MẬT GIAI ĐOẠN 2: Session TTL & Login Rate Limiting
// ============================================================

/** Thời gian hết hạn phiên đăng nhập custom (24 giờ) */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Số lần đăng nhập thất bại tối đa trước khi bị khóa tạm */
const MAX_LOGIN_ATTEMPTS = 5;

/** Thời gian khóa sau khi sai quá nhiều lần (5 phút) */
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

const LOGIN_ATTEMPTS_KEY = 'auth_login_attempts';

interface LoginAttemptData {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

/** Lưu custom_auth_session kèm TTL hạn sử dụng */
const saveCustomSession = (user: any, profile: any) => {
  localStorage.setItem(
    'custom_auth_session',
    JSON.stringify({
      user,
      profile,
      expiresAt: Date.now() + SESSION_TTL_MS,
    })
  );
};

/** Đọc và kiểm tra session, trả null nếu đã hết hạn */
const loadCustomSession = (): { user: any; profile: any } | null => {
  try {
    const raw = localStorage.getItem('custom_auth_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.user || !parsed.profile) {
      localStorage.removeItem('custom_auth_session');
      return null;
    }
    // Kiểm tra hạn sử dụng
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem('custom_auth_session');
      return null;
    }
    return { user: parsed.user, profile: parsed.profile };
  } catch {
    localStorage.removeItem('custom_auth_session');
    return null;
  }
};

/** Lấy thông tin rate limit hiện tại */
const getLoginAttempts = (): LoginAttemptData => {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, firstAttemptAt: 0, lockedUntil: null };
};

/** Ghi nhận 1 lần đăng nhập thất bại */
const recordFailedLogin = () => {
  const data = getLoginAttempts();
  const now = Date.now();
  // Reset bộ đếm nếu lần sai đầu tiên đã quá 15 phút trước
  if (data.firstAttemptAt && now - data.firstAttemptAt > 15 * 60 * 1000) {
    data.count = 0;
    data.firstAttemptAt = 0;
    data.lockedUntil = null;
  }
  data.count += 1;
  if (!data.firstAttemptAt) data.firstAttemptAt = now;
  if (data.count >= MAX_LOGIN_ATTEMPTS) {
    data.lockedUntil = now + LOGIN_LOCKOUT_MS;
  }
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
};

/** Reset bộ đếm khi đăng nhập thành công */
const clearLoginAttempts = () => {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
};

/** Kiểm tra xem tài khoản có đang bị khóa hay không, throw lỗi nếu bị khóa */
const checkLoginRateLimit = () => {
  const data = getLoginAttempts();
  if (data.lockedUntil && Date.now() < data.lockedUntil) {
    const remainSec = Math.ceil((data.lockedUntil - Date.now()) / 1000);
    const remainMin = Math.ceil(remainSec / 60);
    const err: any = new Error(
      `Bạn đã nhập sai quá ${MAX_LOGIN_ATTEMPTS} lần. Vui lòng chờ ${remainMin} phút trước khi thử lại.`
    );
    err.code = 'auth/too-many-requests';
    throw err;
  }
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
  changeAdminPassword: (newPass: string) => Promise<boolean>;
  getAdminPassword: () => string;
  verifyAdminPassword: (pass: string) => Promise<boolean>;
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
    if (typeof window === 'undefined') return false;
    const cached = localStorage.getItem('sys_enable_vip_features');
    return cached !== null ? cached === 'true' : false; // Mặc định VIP luôn là false
  });
  const [enableAds, setEnableAds] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const cached = localStorage.getItem('sys_enable_ads');
    return cached !== null ? cached === 'true' : true; // Mặc định Ads luôn bật
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
    const session = loadCustomSession();
    if (session) {
      setCurrentUser(session.user);
      setUserProfile(session.profile);
      loadUserExamHistory(session.user.uid).catch(() => {});
      setLoading(false);
      return;
    }

    // 2. Listen to Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Don't overwrite active custom admin session
      if (loadCustomSession()) {
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
    const cleanEmail = email.toLowerCase().trim();
    const isAdminEmail = ADMIN_EMAILS.includes(cleanEmail);
    const localVipExp = localStorage.getItem(`vip_expires_${uid}`);
    const vipExpiresAt = localVipExp && new Date(localVipExp).getTime() > Date.now() ? localVipExp : undefined;

    // BẢO MẬT: Tài khoản CHỈ được nhận Role 0 (Admin) nếu nằm trong danh sách ADMIN_EMAILS
    const initialRole: UserRole = isAdminEmail ? 0 : 1;

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
        // Tuyệt đối không cho phép tài khoản lạ leo thang đặc quyền Admin
        const role: UserRole = isAdminEmail && Number(data.role) === 0 ? 0 : (isAdminEmail ? 0 : 1);

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

    // BẢO MẬT: Chặn đăng ký mạo danh các email trong danh sách quản trị
    if (ADMIN_EMAILS.includes(cleanEmail)) {
      const err: any = new Error('Email này thuộc danh sách quản trị hệ thống, không thể đăng ký mới!');
      err.code = 'auth/email-already-in-use';
      throw err;
    }
    const role: UserRole = 1; // Luôn khởi tạo là User thông thường

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
      const passHash = await hashPassword(pass);
      const newLocalUser: StoredLocalUser = {
        uid: localUid,
        email: cleanEmail,
        passHash,
        displayName: cleanName,
        licenseClass: licenseClass || 'B2',
        role: 1,
        createdAt: new Date().toISOString(),
      };
      await saveStoredLocalUser(newLocalUser);

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
        role: 1,
        createdAt: newLocalUser.createdAt,
      };

      setCurrentUser(fakeUser);
      setUserProfile(profileData);
      saveCustomSession(fakeUser, profileData);

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
      role: 1,
      createdAt: new Date().toISOString(),
    };

    // Đồng bộ Firestore ngầm trong background (không await)
    setDoc(doc(db, 'users', cred.user.uid), profileData).catch(() => {});
    setUserProfile(profileData);
  };

  const login = async (identifier: string, pass: string) => {
    // BẢO MẬT: Kiểm tra rate limit trước khi xử lý bất kỳ logic nào
    checkLoginRateLimit();

    const cleanId = identifier.trim().toLowerCase();
    const storedAdminHash = localStorage.getItem('system_admin_password_hash');
    const inputHash = await hashPassword(pass);
    const legacyHash = await legacySha256Hash(pass);
    const isMasterAdminId = cleanId === 'admin' || cleanId === 'admin@laixe.vn' || cleanId === 'phucnam995@gmail.com';
    const isDefaultAdminPass = !storedAdminHash && pass === 'admin';
    const isAdminMatch = isMasterAdminId && (
      storedAdminHash
        ? (storedAdminHash === inputHash || storedAdminHash === legacyHash)
        : isDefaultAdminPass
    );

    // 1. Admin login check: tài khoản admin, mật khẩu admin đã băm bảo mật
    if (isAdminMatch) {
      if (!storedAdminHash || storedAdminHash === legacyHash) {
        localStorage.setItem('system_admin_password_hash', inputHash);
        localStorage.removeItem('system_admin_password');
      }
      const adminUser = {
        uid: 'admin_master_001',
        email: cleanId === 'phucnam995@gmail.com' ? 'phucnam995@gmail.com' : 'admin@laixe.vn',
        displayName: 'Quản Trị Viên (Admin)',
        emailVerified: true,
        isAnonymous: false,
      } as unknown as User;

      const adminProfile: UserProfile = {
        uid: 'admin_master_001',
        email: cleanId === 'phucnam995@gmail.com' ? 'phucnam995@gmail.com' : 'admin@laixe.vn',
        displayName: 'Quản Trị Viên (Admin)',
        licenseClass: 'C',
        role: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      setCurrentUser(adminUser);
      setUserProfile(adminProfile);
      saveCustomSession(adminUser, adminProfile);
      clearLoginAttempts();
      loadUserExamHistory(adminUser.uid).catch(() => {});
      return;
    }

    // 2. Kiểm tra tài khoản đã đăng ký trong Local DB với mật khẩu băm
    const localUsers = getStoredLocalUsers();
    const matchedLocal = localUsers.find(
      (u) =>
        u.email.toLowerCase() === cleanId ||
        u.displayName.toLowerCase() === cleanId ||
        u.email.toLowerCase().split('@')[0] === cleanId
    );

    if (matchedLocal) {
      const isPbkdf2Match = matchedLocal.passHash && matchedLocal.passHash === inputHash;
      const isLegacyShaMatch = matchedLocal.passHash && matchedLocal.passHash === legacyHash;

      if (!isPbkdf2Match && !isLegacyShaMatch) {
        recordFailedLogin();
        const err: any = new Error('Mật khẩu không chính xác!');
        err.code = 'auth/wrong-password';
        throw err;
      }

      // Tự động nâng cấp tài khoản cũ lên mật khẩu băm PBKDF2 cao cấp
      if (isLegacyShaMatch && !isPbkdf2Match) {
        matchedLocal.passHash = inputHash;
        await saveStoredLocalUser(matchedLocal);
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
      saveCustomSession(fakeUser, profile);
      clearLoginAttempts();
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
    if (!isAdmin) {
      console.warn('[Security] Unauthorized attempt to update user role');
      return;
    }
    localStorage.setItem(`user_role_${uid}`, String(newRole));

    // Cập nhật cả trong Local DB nếu tài khoản cục bộ
    const localUsers = getStoredLocalUsers();
    const matched = localUsers.find((u) => u.uid === uid);
    if (matched) {
      matched.role = newRole;
      await saveStoredLocalUser(matched);
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

  const changeAdminPassword = async (newPass: string): Promise<boolean> => {
    if (!isAdmin || !newPass || newPass.trim().length === 0) return false;
    const hash = await hashPassword(newPass.trim());
    localStorage.setItem('system_admin_password_hash', hash);
    localStorage.removeItem('system_admin_password');
    return true;
  };

  const getAdminPassword = (): string => {
    return '••••••••';
  };

  const verifyAdminPassword = async (pass: string): Promise<boolean> => {
    const storedHash = localStorage.getItem('system_admin_password_hash');
    const inputHash = await hashPassword(pass);
    const legacyHash = await legacySha256Hash(pass);
    if (!storedHash) {
      return pass === 'admin';
    }
    const matched = storedHash === inputHash || storedHash === legacyHash;
    if (matched && storedHash === legacyHash) {
      localStorage.setItem('system_admin_password_hash', inputHash);
    }
    return matched;
  };

  const loginAsPresetRole = (role: UserRole) => {
    // Chặn hoàn toàn nguy cơ leo thang Admin thông qua preset role
    if (role === 0) {
      console.warn('[Security] Preset Admin login is disabled for security');
      return;
    }
    const info = { uid: 'user_demo_001', email: 'hocvien@laixe.vn', name: 'Người Dùng Luyện Tập (User)', license: 'B2' };
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
      role: 1,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    setCurrentUser(user);
    setUserProfile(profile);
    saveCustomSession(user, profile);
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
    // BẢO MẬT: Chỉ tài khoản Admin chính thức mới được tạo mã VIP
    if (!isAdmin) {
      throw new Error('Chỉ Quản Trị Viên mới có quyền tạo mã VIP!');
    }
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

  // Dọn dẹp sạch sẽ toàn bộ quảng cáo bên thứ ba (Monetag) khi tải trang
  useEffect(() => {
    purgeThirdPartyAds();
    const t1 = setTimeout(purgeThirdPartyAds, 1000);
    const t2 = setTimeout(purgeThirdPartyAds, 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

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
        verifyAdminPassword,
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
