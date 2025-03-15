import { notFound } from 'next/navigation';
import { PropsWithChildren } from 'react';

import { serverFeatureFlags } from '@/config/featureFlags';
import { isServerMode } from '@/const/version';

export default function Layout({ children }: PropsWithChildren) {
  // 移除服务器模式检查，始终允许访问
  // const enableKnowledgeBase = serverFeatureFlags().enableKnowledgeBase;
  
  // if (!isServerMode || !enableKnowledgeBase) return notFound();
  
  return <>{children}</>;
};
