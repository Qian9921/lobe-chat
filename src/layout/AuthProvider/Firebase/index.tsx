'use client';

import { PropsWithChildren, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { FirebaseAuthProvider, useFirebaseAuth } from '@/libs/firebase';
import { useUserStore } from '@/store/user';

/**
 * Firebase 认证提供者的用户更新组件
 */
const UserUpdater = ({ children }: PropsWithChildren) => {
  const { user, loading } = useFirebaseAuth();
  const router = useRouter();
  
  // 使用用户状态的值和设置方法
  const isUserStateInit = useUserStore((s) => s.isUserStateInit);
  const refreshUserState = useUserStore((s) => s.refreshUserState);
  const setUserStateInit = useUserStore((s) => s.setUserStateInit);
  
  console.log(" [Auth Provider] UserUpdater 加载状态:", loading ? "加载中" : "已完成");
  console.log(" [Auth Provider] UserUpdater 用户状态:", user ? "已登录" : "未登录");
  console.log(" [Auth Provider] 用户初始化状态:", isUserStateInit ? "已初始化" : "未初始化");

  // 监听用户状态，根据需要重定向
  useEffect(() => {
    console.log(" [Auth Provider] 认证状态变更：", loading ? "加载中" : "已完成");
    
    if (loading) {
      console.log(" [Auth Provider] 认证加载中，等待完成...");
      return;
    }
    
    console.log(" [Auth Provider] 认证加载完成，用户状态:", user ? "已登录" : "未登录");
    
    // 如果认证加载完成但用户状态未初始化，触发用户状态设置
    if (!loading && !isUserStateInit) {
      console.log(" [Auth Provider] 等待600ms后将用户状态标记为已初始化");
      
      const timeoutId = setTimeout(async () => {
        try {
          console.log(" [Auth Provider] 尝试刷新用户状态");
          await refreshUserState();
          
          // 直接设置用户状态为已初始化
          console.log(" [Auth Provider] 直接设置用户状态为已初始化");
          setUserStateInit(true);
          
          console.log(" [Auth Provider] 用户状态更新完成");
        } catch (error) {
          console.error(" [Auth Provider] 刷新用户状态失败:", error);
        }
      }, 600);
      
      return () => clearTimeout(timeoutId);
    }
    
    // 此处可以根据需要添加其他逻辑
  }, [user, loading, router, isUserStateInit, refreshUserState, setUserStateInit]);

  return children;
};

/**
 * Firebase 认证提供者组件
 */
const Firebase = ({ children }: PropsWithChildren) => {
  console.log(" [Auth Provider] Firebase 组件渲染");
  
  return (
    <FirebaseAuthProvider>
      <UserUpdater>{children}</UserUpdater>
    </FirebaseAuthProvider>
  );
};

export default Firebase;
