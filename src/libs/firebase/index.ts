// 导出 Firebase 相关模块
export * from './auth';
export * from './firebase';

// 导出 Firebase 上下文和组件
export {
  FirebaseAuthProvider,
  FirebaseContext,
  useFirebase,
  useFirebaseAuth,
} from './firebase-context';

// 导出类型（使用 export type 语法）
export type { FirebaseContextType,FirebaseUserData } from './firebase-context';
