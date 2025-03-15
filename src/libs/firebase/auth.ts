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

import { auth, db } from './firebase';

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

/**
 * 登录用户
 * @param email 邮箱
 * @param password 密码
 */
export const loginUser = async (email: string, password: string) => {
  try {
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
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // 检查用户是否已存在于 Firestore
    const userDocRef = doc(db, 'users', userCredential.user.uid);
    const userDoc = await getDoc(userDocRef);
    
    // 如果用户不存在，则创建新用户记录
    if (!userDoc.exists()) {
      const userData: UserData = {
        created_time: Timestamp.now(),
        display_name: userCredential.user.displayName || '',
        email: userCredential.user.email || '',
        photo_url: userCredential.user.photoURL || '',
        role: 'USER',
        uid: userCredential.user.uid,
      };
      
      await setDoc(userDocRef, userData);
    }
    
    return userCredential.user;
  } catch (error: any) {
    throw new Error(`Google 登录失败: ${error.message}`);
  }
};

/**
 * 注册新用户
 * @param email 邮箱
 * @param password 密码
 * @param displayName 显示名称
 */
export const registerUser = async (email: string, password: string, displayName: string) => {
  try {
    // 创建用户
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 更新用户资料
    await updateProfile(user, { displayName });
    
    // 在 Firestore 中创建用户文档
    const userData: UserData = {
      created_time: Timestamp.now(),
      display_name: displayName,
      email: user.email || '',
      first_name: '',
      last_name: '',
      photo_url: '',
      role: 'USER',
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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
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
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return userDoc.data() as UserData;
    }
    
    return null;
  } catch (error) {
    console.error('获取用户数据失败:', error);
    return null;
  }
};

/**
 * 发送密码重置邮件
 * @param email 邮箱
 */
export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error: any) {
    throw new Error(`发送密码重置邮件失败: ${error.message}`);
  }
};
