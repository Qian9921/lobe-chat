'use client';

import { ReactNode } from 'react';
import LoginOverlay from '@/features/Auth/LoginOverlay';

/**
 * 客户端认证容器
 * 用于包装需要访问客户端认证状态的组件
 */
const AuthContainer = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {children}
      <LoginOverlay />
    </>
  );
};

export default AuthContainer;
