import { StateCreator } from 'zustand/vanilla';

import { enableAuth, enableClerk, enableNextAuth, enableFirebaseAuth } from '@/const/auth';

import { UserStore } from '../../store';

export interface UserAuthAction {
  enableAuth: () => boolean;
  /**
   * universal logout method
   */
  logout: () => Promise<void>;
  /**
   * universal login method
   */
  openLogin: () => Promise<void>;
}

export const createAuthSlice: StateCreator<
  UserStore,
  [['zustand/devtools', never]],
  [],
  UserAuthAction
> = (set, get) => ({
  enableAuth: () => {
    return enableAuth;
  },
  logout: async () => {
    if (enableClerk) {
      get().clerkSignOut?.({ redirectUrl: location.toString() });

      return;
    }

    if (enableNextAuth) {
      const { signOut } = await import('next-auth/react');
      signOut();
    }
    
    // 处理 Firebase 登出
    if (enableFirebaseAuth) {
      try {
        const { logoutUser } = await import('@/libs/firebase/auth');
        await logoutUser();
        
        // 清除用户状态
        set({ isSignedIn: false, user: undefined });
        
        // 重定向到登录页
        window.location.href = '/login';
      } catch (error) {
        console.error('Firebase 登出失败:', error);
      }
    }
  },
  openLogin: async () => {
    if (enableClerk) {
      const reditectUrl = location.toString();
      get().clerkSignIn?.({
        fallbackRedirectUrl: reditectUrl,
        signUpForceRedirectUrl: reditectUrl,
        signUpUrl: '/signup',
      });

      return;
    }

    if (enableNextAuth) {
      const { signIn } = await import('next-auth/react');
      // Check if only one provider is available
      const providers = get()?.oAuthSSOProviders;
      if (providers && providers.length === 1) {
        signIn(providers[0]);
        return;
      }
      signIn();
      return;
    }
    
    // 处理 Firebase 认证的登录跳转
    if (enableFirebaseAuth) {
      // 直接跳转到登录页面
      window.location.href = '/login';
      return;
    }
  },
});
