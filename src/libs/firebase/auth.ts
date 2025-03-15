import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';

import { firebaseAuth, firebaseDb } from './firebase';

/**
 * 用户数据类型
 */
export interface UserData {
  created_time: Timestamp;
  display_name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  role?: string;
  uid: string;
}

// 检查Firebase是否已初始化
const checkFirebaseAuth = () => {
  if (!firebaseAuth) {
    throw new Error('Firebase Auth 未初始化，请检查您的环境');
  }
  return firebaseAuth;
};

const checkFirebaseDb = () => {
  if (!firebaseDb) {
    throw new Error('Firebase Firestore 未初始化，请检查您的环境');
  }
  return firebaseDb;
};

/**
 * 登录用户
 * @param email 邮箱
 * @param password 密码
 */
export const loginUser = async (email: string, password: string) => {
  try {
    const auth = checkFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    throw new Error(`登录失败: ${error.message}`);
  }
};

/**
 * 使用谷歌账号登录
 */
export const loginWithGoogle = async () => {
  try {
    const auth = checkFirebaseAuth();
    const db = checkFirebaseDb();
    
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // 检查用户是否已存在于 Firestore
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    // 如果用户不存在，则创建新用户记录
    if (!userDoc.exists()) {
      const { user } = userCredential;
      const userData: UserData = {
        created_time: Timestamp.now(),
        display_name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        photo_url: user.photoURL || '',
        uid: user.uid,
      };
      
      await setDoc(userDocRef, userData);
    }
    
    return userCredential.user;
  } catch (error: any) {
    throw new Error(`Google登录失败: ${error.message}`);
  }
};

/**
 * 注册用户
 * @param email 邮箱
 * @param password 密码
 * @param displayName 显示名称
 */
export const registerUser = async (email: string, password: string, displayName: string) => {
  try {
    const auth = checkFirebaseAuth();
    const db = checkFirebaseDb();
    
    // 创建用户
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 更新用户资料
    await updateProfile(user, {
      displayName,
    });
    
    // 创建用户数据
    const userData: UserData = {
      created_time: Timestamp.now(),
      display_name: displayName,
      email: email,
      photo_url: user.photoURL || '',
      uid: user.uid,
    };
    
    await setDoc(doc(db, 'users', user.uid), userData);
    
    return user;
  } catch (error: any) {
    throw new Error(`注册失败: ${error.message}`);
  }
};

/**
 * 退出登录
 */
export const logoutUser = async () => {
  try {
    const auth = checkFirebaseAuth();
    await signOut(auth);
    return true;
  } catch (error: any) {
    throw new Error(`退出失败: ${error.message}`);
  }
};

/**
 * 获取当前登录用户
 */
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    if (!firebaseAuth) {
      resolve(null);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

/**
 * 获取用户详细信息
 * @param uid 用户ID
 */
export const getUserData = async (uid: string): Promise<UserData | null> => {
  try {
    const db = checkFirebaseDb();
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    } else {
      return null;
    }
  } catch (error: any) {
    throw new Error(`获取用户数据失败: ${error.message}`);
  }
};

/**
 * 发送密码重置邮件
 * @param email 邮箱
 */
export const resetPassword = async (email: string) => {
  try {
    const auth = checkFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: any) {
    throw new Error(`发送密码重置邮件失败: ${error.message}`);
  }
};
