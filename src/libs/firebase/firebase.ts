'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore, Firestore } from 'firebase/firestore';

// 检查环境
const isBrowser = typeof window !== 'undefined';
const isEdgeRuntime = typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'edge';
const canInitializeFirebase = isBrowser && !isEdgeRuntime;

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCQ9JCc2Zz5XEFyivJBQcgqpjOLG9gGdf4",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:827682634474:web:b39f177bc25dc341dbb593",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "open-impact-lab-zob4aq.firebaseapp.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "827682634474",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "open-impact-lab-zob4aq",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "open-impact-lab-zob4aq.firebasestorage.app"
};

// 初始化 Firebase，只在适当的环境中执行
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;

// 安全地初始化Firebase，避免在Edge环境中执行
if (canInitializeFirebase) {
  try {
    firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    
    // 获取 Auth 实例
    firebaseAuth = getAuth(firebaseApp);
    
    // 获取 Firestore 实例
    firebaseDb = getFirestore(firebaseApp);
    
    console.log("Firebase 初始化状态:", firebaseConfig.projectId ? "配置正常" : "配置缺失");
  } catch (error) {
    console.error("Firebase 初始化失败:", error);
    firebaseApp = null;
    firebaseAuth = null;
    firebaseDb = null;
  }
} else {
  console.log("环境不支持初始化Firebase");
  firebaseApp = null;
  firebaseAuth = null;
  firebaseDb = null;
}

// 启用离线持久化（仅在客户端环境且已初始化Firebase）
const initPersistence = async () => {
  if (firebaseDb) {
    try {
      await enableIndexedDbPersistence(firebaseDb);
      console.log('Firestore 持久化已启用');
    } catch (error) {
      console.error('无法启用 Firestore 持久化:', error);
    }
  }
};

// 只在适当的环境中初始化持久化存储
if (canInitializeFirebase && firebaseDb) {
  void initPersistence();
}

// 导出Firebase实例
export { firebaseApp, firebaseAuth, firebaseDb };
