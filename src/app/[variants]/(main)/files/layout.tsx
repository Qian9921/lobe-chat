import { notFound } from 'next/navigation';
import { PropsWithChildren } from 'react';

import { serverFeatureFlags } from '@/config/featureFlags';

export default function Layout({ children }: PropsWithChildren) {
  // 移除知识库功能检查，始终允许访问
  // const enableKnowledgeBase = serverFeatureFlags().enableKnowledgeBase;
  
  // if (!enableKnowledgeBase) return notFound();
  
  return <>{children}</>;
};
