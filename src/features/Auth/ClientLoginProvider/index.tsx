'use client';

import { ReactNode } from 'react';

import LoginOverlay from '../LoginOverlay';

/**
 * 客户端登录提供者组件
 * 包含登录遮罩，用于强制未登录用户登录
 */
export const ClientLoginProvider = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {children}
      <LoginOverlay />
    </>
  );
};

export default ClientLoginProvider;
