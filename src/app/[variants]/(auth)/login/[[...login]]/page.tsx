import { SignIn } from '@clerk/nextjs';
import { notFound, redirect } from 'next/navigation';

import { enableClerk, enableFirebaseAuth } from '@/const/auth';
import { BRANDING_NAME } from '@/const/branding';
import { DEFAULT_LANG } from '@/const/locale';
import { metadataModule } from '@/server/metadata';
import { translation } from '@/server/translation';
import { DynamicLayoutProps } from '@/types/next';
import { RouteVariants } from '@/utils/server/routeVariants';

export const generateMetadata = async (props: DynamicLayoutProps) => {
  const locale = await RouteVariants.getLocale(props);
  const { t } = await translation('clerk', locale);
  return metadataModule.generate({
    description: t('signIn.start.subtitle'),
    title: t('signIn.start.title', { applicationName: BRANDING_NAME }),
    url: '/login',
  });
};

// 使用服务器组件处理登录路由
export default async function Page(props: DynamicLayoutProps) {
  // 如果启用了Firebase认证
  if (enableFirebaseAuth) {
    // 检查是否是Firebase路径
    const url = props.params ? await props.params : { variants: '' };
    const loginParams = props.params && 'login' in props.params ? props.params.login : [];
    const isFirebasePath = Array.isArray(loginParams) && loginParams.includes('firebase');
    
    // 如果不是Firebase路径，重定向到Firebase登录页面
    if (!isFirebasePath) {
      const variantsObj = await RouteVariants.getVariantsFromProps(props);
      const variant = RouteVariants.serializeVariants(variantsObj);
      
      // 重定向到Firebase登录页面
      redirect(`/${variant}/login/firebase`);
    }
  }
  
  // 如果启用了Clerk认证，显示Clerk登录页面
  if (enableClerk) {
    return <SignIn path="/login" />;
  }
  
  // 如果都没有启用，显示404页面
  return notFound();
}
