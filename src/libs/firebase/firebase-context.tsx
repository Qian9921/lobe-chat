'use client';

import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, getFirestore, onSnapshot } from 'firebase/firestore';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { firebaseApp } from './firebase';
import { useUserStore } from '@/store/user';
import { LobeUser } from '@/types/user';

// 定义用户数据接口
export interface FirebaseUserData {
  display_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  role?: string;
}

// Firebase 上下文类型
export interface FirebaseContextType {
  isOnline: boolean;
  loading: boolean;
  user: User | null;
  userData: FirebaseUserData | null;
}

// 创建 Firebase 上下文
export const FirebaseContext = createContext<FirebaseContextType>({
  isOnline: true,
  loading: true,
  user: null,
  userData: null,
});

// Firebase 钩子函数
export const useFirebase = () => useContext(FirebaseContext);
export const useFirebaseAuth = () => useContext(FirebaseContext);

export const FirebaseAuthProvider = ({ children }: { children: ReactNode }) => {
  console.log(" [Firebase Auth] Provider 初始化开始");
  
  // 初始化 Firebase 服务
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);
  
  // 状态管理
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<FirebaseUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // 获取 setUserStateInit 方法用于初始化用户状态
  const setUserStateInit = useUserStore((s) => s.setUserStateInit);
  
  // 清理函数引用
  const firestoreUnsubscribeRef = useRef<(() => void) | null>(null);
  
  // 网络状态监听
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // 用于更新用户状态的封装函数
  const updateUserState = useCallback((isSignedIn: boolean, userData?: LobeUser) => {
    const setUserStore = useUserStore.setState;
    
    // 更新全局状态
    setUserStore((state) => ({
      ...state,
      isLoaded: true,
      isSignedIn,
      user: userData || (isSignedIn ? state.user : undefined),
    }));
    
    console.log(` [Firebase Auth] 用户状态已更新: isSignedIn=${isSignedIn}, userData=`, userData);
  }, []);
  
  // 认证状态监听
  useEffect(() => {
    let firestoreUnsubscribe: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    // 设置超时，确保页面不会一直加载
    const setupTimeoutProtection = () => {
      timeoutId = setTimeout(() => {
        if (loading) {
          console.log(" [Firebase Auth] 认证状态检查超时，强制结束加载状态");
          setLoading(false);
        }
      }, 10_000);
    };
    
    try {
      setupTimeoutProtection();
      
      // 监听 Firebase 认证状态变化
      const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        try {
          if (authUser) {
            console.log(" [Firebase Auth] 用户已登录:", authUser.uid, authUser.email);
            setUser(authUser);
            
            // 清理之前的监听器
            if (firestoreUnsubscribeRef.current) {
              console.log(" [Firebase Auth] 清理之前的 Firestore 监听器");
              firestoreUnsubscribeRef.current();
              firestoreUnsubscribeRef.current = null;
            }
            
            // 获取用户数据
            const userDocRef = doc(db, 'users', authUser.uid);
            
            try {
              // 首先尝试获取一次数据
              const docSnap = await getDoc(userDocRef);
              
              if (docSnap.exists()) {
                const data = docSnap.data() as FirebaseUserData;
                console.log(" [Firebase Auth] 成功从 Firestore 获取用户数据");
                setUserData(data);
                
                // 创建 Lobe 用户对象
                const lobeUser: LobeUser = {
                  avatar: data.photo_url || authUser.photoURL || '',
                  email: data.email || authUser.email || '',
                  fullName: data.display_name || authUser.displayName || '',
                  id: authUser.uid,
                  username: data.display_name || authUser.displayName || authUser.email?.split('@')[0] || '',
                };
                
                // 更新用户状态
                updateUserState(true, lobeUser);
                
                console.log(" [Firebase Auth] 用户数据已更新到全局状态", lobeUser);
              } else {
                console.log(" [Firebase Auth] Firestore 中没有用户文档");
                
                // 使用 Firebase 认证数据创建简单的用户资料
                const lobeUser: LobeUser = {
                  avatar: authUser.photoURL || '',
                  email: authUser.email || '',
                  fullName: authUser.displayName || '',
                  id: authUser.uid,
                  username: authUser.displayName || authUser.email?.split('@')[0] || '',
                };
                
                // 更新用户状态
                updateUserState(true, lobeUser);
                
                console.log(" [Firebase Auth] 基本用户数据已更新到全局状态", lobeUser);
              }
              
              // 设置用户状态初始化标志
              setUserStateInit(true);
            } catch (error) {
              console.error(" [Firebase Auth] 获取用户数据失败:", error);
            }
            
            // 在网络连接正常的情况下设置实时监听器
            console.log(" [Firebase Auth] 当前网络状态:", isOnline ? "在线" : "离线");
            if (isOnline) {
              console.log(" [Firebase Auth] 设置 Firestore 实时数据监听器");
              try {
                const unsubscribe = onSnapshot(
                  userDocRef,
                  (doc) => {
                    if (doc.exists()) {
                      console.log(" [Firebase Auth] 用户数据从实时监听器更新");
                      const data = doc.data() as FirebaseUserData;
                      setUserData(data);
                      
                      // 创建 Lobe 用户对象
                      const lobeUser: LobeUser = {
                        avatar: data.photo_url || authUser.photoURL || '',
                        email: data.email || authUser.email || '',
                        fullName: data.display_name || authUser.displayName || '',
                        id: authUser.uid,
                        username: data.display_name || authUser.displayName || authUser.email?.split('@')[0] || '',
                      };
                      
                      // 更新用户数据，保持登录状态
                      useUserStore.setState((state) => ({
                        ...state, 
                        user: lobeUser,
                      }));
                      
                      console.log(" [Firebase Auth] 用户数据已从实时监听器更新到全局状态");
                    } else {
                      console.log(" [Firebase Auth] 实时监听器：用户文档不存在");
                    }
                  },
                  (error) => {
                    console.warn(" [Firebase Auth] 实时监听器错误:", error);
                  }
                );
                
                firestoreUnsubscribe = unsubscribe;
                firestoreUnsubscribeRef.current = unsubscribe;
                console.log(" [Firebase Auth] 实时监听器设置成功");
              } catch (error) {
                console.error(" [Firebase Auth] 设置 Firestore 监听器失败:", error);
              }
            } else {
              console.log(" [Firebase Auth] 离线状态，跳过实时监听器设置");
            }
          } else {
            console.log(" [Firebase Auth] 用户未登录，清除用户数据");
            setUser(null);
            setUserData(null);
            
            // 更新用户状态为未登录
            updateUserState(false);
            
            console.log(" [Firebase Auth] 用户已注销，全局状态已更新");
          }
          
          console.log(" [Firebase Auth] 完成认证状态处理，设置 loading = false");
          setLoading(false);
        } catch (error) {
          console.error(" [Firebase Auth] 处理认证状态错误:", error);
          setLoading(false);
        }
      });
      
      // 清理函数
      return () => {
        console.log(" [Firebase Auth] 清理认证状态监听器");
        if (timeoutId) clearTimeout(timeoutId);
        unsubscribe();
        
        // 清理 Firestore 监听器
        if (firestoreUnsubscribe) {
          console.log(" [Firebase Auth] 清理 Firestore 监听器");
          firestoreUnsubscribe();
        }
      };
    } catch (error) {
      console.error(" [Firebase Auth] 设置认证状态监听器失败:", error);
      // 确保即使设置监听器失败，也要结束加载状态
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, [auth, db, isOnline, loading, setUserStateInit, updateUserState]);
  
  // 计算上下文值
  const contextValue = useMemo(() => {
    const isAuthenticated = !!user;
    const hasUserData = !!userData;
    
    console.log(" [Firebase Auth] Provider 渲染，状态:", {
      hasUserData,
      isAuthenticated,
      isOnline,
      loading
    });
    
    return {
      isOnline,
      loading,
      user,
      userData,
    };
  }, [user, userData, loading, isOnline]);
  
  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};
