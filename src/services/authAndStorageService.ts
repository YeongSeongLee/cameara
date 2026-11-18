import { UserProfile, AnalysisRecord } from '../types/motion';
import { saveMediaBlob, getMediaBlob, deleteMediaBlob } from './indexedDbMediaService';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

const STORAGE_USERS_KEY = 'motion_ai_users_db';
const STORAGE_CURRENT_USER_KEY = 'motion_ai_current_user';
const STORAGE_ANALYSES_KEY = 'motion_ai_analyses_db';

export function mapAuthErrorMessage(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 Firebase에 등록된 이메일 계정입니다. 로그인해 주세요.';
    case 'auth/invalid-email':
      return '올바른 이메일 형식이 아닙니다.';
    case 'auth/weak-password':
      return '비밀번호가 너무 취약합니다. 최소 6자 이상 입력해 주세요.';
    case 'auth/user-not-found':
      return '등록되지 않은 이메일 계정입니다.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호가 일치하지 않습니다.';
    case 'auth/too-many-requests':
      return '비정상적인 요청이 감지되어 일시 차단되었습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결이 원활하지 않습니다. 인터넷 연결을 확인해 주세요.';
    default:
      return error?.message || '인증 처리 중 오류가 발생했습니다.';
  }
}

export function generateRandomTestUser(): {
  email: string;
  name: string;
  gender: 'male' | 'female';
  age: number;
  height: number;
  weight: number;
  phone: string;
  password: string;
} {
  const firstNames = ['민준', '서준', '도윤', '예준', '시우', '하은', '서아', '지우', '서윤', '지아', '지호', '수아'];
  const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오'];
  const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
  const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
  const name = `${randomLast}${randomFirst}`;

  const isMale = Math.random() > 0.5;
  const gender: 'male' | 'female' = isMale ? 'male' : 'female';
  const age = Math.floor(Math.random() * 20) + 20; // 20 - 40
  const height = isMale ? Math.floor(Math.random() * 18) + 170 : Math.floor(Math.random() * 16) + 158;
  const weight = isMale ? Math.floor(Math.random() * 20) + 68 : Math.floor(Math.random() * 15) + 50;
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const phone = `010-${Math.floor(1000 + Math.random() * 9000)}-${randomDigits}`;
  const email = `athlete.${randomDigits}@motion.ai`;
  const password = `Test${randomDigits}!`;

  return { email, name, gender, age, height, weight, phone, password };
}

export function getUsers(): Record<string, UserProfile & { passwordHash: string }> {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return getInitialUsers();
}

function getInitialUsers(): Record<string, UserProfile & { passwordHash: string }> {
  const demo: UserProfile & { passwordHash: string } = {
    id: 'user_demo_01',
    email: 'demo@motion.ai',
    name: '김모션',
    gender: 'male',
    age: 27,
    height: 178,
    weight: 75,
    phone: '010-1234-5678',
    passwordHash: 'demo1234',
    createdAt: new Date().toISOString(),
  };
  const map = { [demo.email]: demo };
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(map));
  } catch {}
  return map;
}

// Unconditionally return null if not logged in so First Screen is ALWAYS Login/Signup!
export function getCurrentUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function setCurrentUser(user: UserProfile | null): void {
  if (user) {
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Firebase signOut notice:', err);
  }
  localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
}

/**
 * Register user directly into Firebase Authentication and save profile to Firestore /users/{uid}
 */
export async function registerUser(data: {
  email: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  height: number;
  weight: number;
  phone: string;
  password: string;
}): Promise<UserProfile> {
  const cleanEmail = data.email.trim().toLowerCase();

  try {
    // 1. Firebase Authentication User Creation
    const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, data.password);
    const fbUser = userCredential.user;

    // 2. Set Firebase Auth Display Name
    try {
      await updateAuthProfile(fbUser, { displayName: data.name.trim() });
    } catch (profErr) {
      console.warn('Firebase profile displayName update warning:', profErr);
    }

    const profile: UserProfile = {
      id: fbUser.uid,
      email: cleanEmail,
      name: data.name.trim(),
      gender: data.gender,
      age: data.age,
      height: data.height,
      weight: data.weight,
      phone: data.phone.trim(),
      createdAt: new Date().toISOString(),
    };

    // 3. Save to Firestore under /users/{uid}
    try {
      await setDoc(doc(db, 'users', fbUser.uid), profile);
    } catch (fsErr) {
      console.warn('Firestore user profile save notice:', fsErr);
    }

    // 4. Update local cache
    const users = getUsers();
    users[cleanEmail] = { ...profile, passwordHash: data.password };
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));

    return profile;
  } catch (err: any) {
    throw new Error(mapAuthErrorMessage(err));
  }
}

/**
 * Login user via Firebase Authentication, retrieve Firestore profile
 */
export async function loginUser(email: string, password: string): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    // 1. Firebase Authentication Sign-In
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const fbUser = userCredential.user;

    let profile: UserProfile | null = null;

    // 2. Fetch User Profile from Firestore /users/{uid}
    try {
      const snap = await getDoc(doc(db, 'users', fbUser.uid));
      if (snap.exists()) {
        profile = snap.data() as UserProfile;
      }
    } catch (fsErr) {
      console.warn('Firestore load profile notice:', fsErr);
    }

    // Fallback if firestore document does not exist yet
    if (!profile) {
      const cachedUsers = getUsers();
      const cached = cachedUsers[cleanEmail];
      profile = {
        id: fbUser.uid,
        email: cleanEmail,
        name: cached?.name || fbUser.displayName || '회원',
        gender: cached?.gender || 'male',
        age: cached?.age || 27,
        height: cached?.height || 175,
        weight: cached?.weight || 70,
        phone: cached?.phone || '',
        createdAt: cached?.createdAt || new Date().toISOString(),
      };
      // Save it now to Firestore
      try {
        await setDoc(doc(db, 'users', fbUser.uid), profile);
      } catch {}
    }

    setCurrentUser(profile);
    return profile;
  } catch (err: any) {
    // If demo account login requested and not yet created in Firebase, auto-create it
    if (cleanEmail === 'demo@motion.ai' && password === 'demo1234') {
      try {
        return await registerUser({
          email: 'demo@motion.ai',
          name: '김모션 데모',
          gender: 'male',
          age: 27,
          height: 178,
          weight: 75,
          phone: '010-1234-5678',
          password: 'demo1234',
        });
      } catch {
        // Fallback to local demo profile
        const localUsers = getUsers();
        if (localUsers[cleanEmail]) {
          const { passwordHash, ...demoProf } = localUsers[cleanEmail];
          setCurrentUser(demoProf);
          return demoProf;
        }
      }
    }

    throw new Error(mapAuthErrorMessage(err));
  }
}

// 아이디(이메일) 찾기: 이름과 전화번호로 검색
export function findUserEmail(name: string, phone: string): string {
  const users = getUsers();
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const cleanName = name.trim();

  for (const user of Object.values(users)) {
    const userCleanPhone = (user.phone || '').replace(/[^0-9]/g, '');
    if (user.name === cleanName && userCleanPhone === cleanPhone) {
      return user.email;
    }
  }

  throw new Error('일치하는 회원 정보를 찾을 수 없습니다. 이름과 전화번호를 확인해 주세요.');
}

// 비밀번호 찾기 및 Firebase 재설정 이메일 발송
export async function resetUserPassword(email: string, newPassword?: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return {
      success: true,
      message: `${cleanEmail} 주소로 Firebase 비밀번호 재설정 링크를 전송했습니다. 이메일을 확인해 주세요.`,
    };
  } catch (err: any) {
    // If offline or user not found in Firebase, check local cache fallback
    const users = getUsers();
    const user = users[cleanEmail];

    if (user && newPassword && newPassword.length >= 6) {
      user.passwordHash = newPassword;
      users[cleanEmail] = user;
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
      return { success: true, message: '비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.' };
    }

    throw new Error(mapAuthErrorMessage(err));
  }
}

export const resetPassword = resetUserPassword;

export async function updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  const current = getCurrentUser();
  if (!current) throw new Error('로그인이 필요합니다.');

  const updated: UserProfile = { ...current, ...data };
  const users = getUsers();
  if (users[current.email]) {
    users[current.email] = { ...users[current.email], ...updated };
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  }
  setCurrentUser(updated);

  // Sync to Firestore
  try {
    if (current.id) {
      await setDoc(doc(db, 'users', current.id), updated, { merge: true });
    }
  } catch (fsErr) {
    console.warn('Firestore profile update warning:', fsErr);
  }

  return updated;
}

export function getUserAnalyses(userId?: string): AnalysisRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_ANALYSES_KEY);
    if (!raw) return [];
    const all: AnalysisRecord[] = JSON.parse(raw);
    if (!userId) return all;
    return all.filter((r) => r.userId === userId);
  } catch {
    return [];
  }
}

export async function saveAnalysisRecord(
  record: AnalysisRecord,
  mediaBlobOrUrl?: Blob | string
): Promise<void> {
  try {
    // 1. If mediaBlobOrUrl is provided, persist it in IndexedDB for 100% reliable replay
    if (mediaBlobOrUrl instanceof Blob) {
      await saveMediaBlob(record.id, mediaBlobOrUrl);
    } else if (typeof mediaBlobOrUrl === 'string' && mediaBlobOrUrl.startsWith('blob:')) {
      try {
        const resp = await fetch(mediaBlobOrUrl);
        const blob = await resp.blob();
        if (blob && blob.size > 0) {
          await saveMediaBlob(record.id, blob);
        }
      } catch (fetchErr) {
        console.warn('Could not fetch blob URL to cache in IndexedDB:', fetchErr);
      }
    }

    // 2. Save metadata & biomechanics timeline in local cache
    const existing = getUserAnalyses();
    const updated = [record, ...existing.filter((r) => r.id !== record.id)];
    localStorage.setItem(STORAGE_ANALYSES_KEY, JSON.stringify(updated.slice(0, 50)));

    // 3. Sync record to Firebase Firestore under user's collection
    try {
      if (record.userId) {
        // Strip out large in-memory blob URLs before saving to Firestore document
        const firestorePayload = {
          ...record,
          mediaUrl: record.mediaType === 'image' && !record.mediaUrl?.startsWith('blob:') ? record.mediaUrl : '',
          syncedAt: new Date().toISOString(),
        };
        const ref = doc(db, 'users', record.userId, 'analyses', record.id);
        await setDoc(ref, firestorePayload, { merge: true });
      }
    } catch (fsErr) {
      console.warn('Firestore analysis sync notice (offline or rules):', fsErr);
    }
  } catch (err) {
    console.error('Failed to save analysis record:', err);
  }
}

export async function loadRecordMediaUrl(record: AnalysisRecord): Promise<string> {
  // First check if video blob exists in IndexedDB
  const blob = await getMediaBlob(record.id);
  if (blob) {
    return URL.createObjectURL(blob);
  }
  // Fallback to record's mediaUrl if it's an online URL or dataURL
  if (record.mediaUrl && !record.mediaUrl.startsWith('blob:')) {
    return record.mediaUrl;
  }
  return '';
}

export async function deleteAnalysisRecord(id: string, userId?: string): Promise<void> {
  try {
    // 1. Remove from localStorage
    const existing = getUserAnalyses();
    const updated = existing.filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_ANALYSES_KEY, JSON.stringify(updated));

    // 2. Remove media from IndexedDB
    await deleteMediaBlob(id);

    // 3. Remove from Firestore if user is specified
    if (userId) {
      try {
        const ref = doc(db, 'users', userId, 'analyses', id);
        await deleteDoc(ref);
      } catch (fsErr) {
        console.warn('Firestore delete notice:', fsErr);
      }
    }
  } catch (err) {
    console.error('Failed to delete analysis record:', err);
  }
}

