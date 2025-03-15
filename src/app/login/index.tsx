import { redirect } from 'next/navigation';

import { enableFirebaseAuth } from '@/const/auth';
import { DEFAULT_LANG } from '@/const/locale';
import { RouteVariants } from '@/utils/server/routeVariants';

/**
 * 登录页面重定向组件
 * 重定向到正确的带变体的Firebase登录页面
 */
export default function LoginRedirect() {
  // 检查是否启用了Firebase认证
  if (enableFirebaseAuth) {
    // 生成默认变体路径
    const defaultVariant = RouteVariants.serializeVariants({
      isMobile: false,
      locale: DEFAULT_LANG,
      theme: 'light',
    });
    
    // 重定向到带变体的Firebase登录页面
    redirect(`/${defaultVariant}/login/firebase`);
  } else {
    // 如果未启用Firebase认证，返回404页面
    redirect('/404');
  }
}
