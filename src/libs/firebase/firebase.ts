'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { enableIndexedDbPersistence, getFirestore } from 'firebase/firestore';

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCQ9JCc2Zz5XEFyivJBQcgqpjOLG9gGdf4",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:827682634474:web:b39f177bc25dc341dbb593",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "open-impact-lab-zob4aq.firebaseapp.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "827682634474",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "open-impact-lab-zob4aq",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "open-impact-lab-zob4aq.firebasestorage.app"
};

// 初始化 Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 导出 Firebase App 实例以供其他模块使用
export const firebaseApp = app;

// 获取 Auth 实例
const auth = getAuth(app);

// 获取 Firestore 实例
const db = getFirestore(app);

// 启用离线持久化（仅在客户端环境）
const initPersistence = async () => {
  if (typeof window !== 'undefined') {
    try {
      await enableIndexedDbPersistence(db);
    } catch (err: any) {
      if (err.code === 'failed-precondition') {
        // 可能有多个标签页打开，只有一个可以启用持久化
        console.warn('Firebase persistence failed: Multiple tabs open');
      } else if (err.code === 'unimplemented') {
        // 当前浏览器不支持所有需要的功能
        console.warn('Firebase persistence failed: Browser not supported');
      }
    }
  }
};

// 初始化持久化存储
void initPersistence();

// 连接状态监控
console.log("Firebase 初始化状态:", firebaseConfig.projectId ? "配置正常" : "配置缺失");

export { auth, db };
