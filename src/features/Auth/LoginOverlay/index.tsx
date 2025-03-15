'use client';

import { Button, Modal } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';
import { usePathname } from 'next/navigation';

import { enableAuth, enableFirebaseAuth } from '@/const/auth';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

/**
 * 登录遮罩组件 - 为未登录用户显示模糊化界面和强制登录提示
 */
const LoginOverlay = memo(() => {
  const { t } = useTranslation('auth');
  const [visible, setVisible] = useState(false);
  const isLogin = useUserStore(authSelectors.isLogin);
  const openLogin = useUserStore((s) => s.openLogin);
  const pathname = usePathname();
  
  // 客户端渲染标记，避免水合错误
  const [mounted, setMounted] = useState(false);
  
  // 检查当前是否在登录/注册页面
  const isAuthPage = pathname?.includes('/login') || pathname?.includes('/signup');

  useEffect(() => {
    // 标记组件已挂载到客户端
    setMounted(true);
    
    // 显示登录提示弹窗
    if (!isLogin && !isAuthPage) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [isLogin, isAuthPage]);

  const handleLogin = () => {
    openLogin();
    
    // 如果是 Firebase 认证，直接跳转到登录页面
    if (enableFirebaseAuth) {
      window.location.href = '/login';
    }
  };

  // 如果未启用认证或已登录或当前在认证页面，或组件未挂载到客户端，则不显示遮罩
  if (!enableAuth || isLogin || isAuthPage || !mounted) return null;

  return (
    <>
      {/* 模糊化遮罩层 */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(5px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      />
      
      {/* 登录提示弹窗 */}
      <Modal
        centered
        closable={false}
        open={visible}
        title={t('loginRequired', { defaultValue: '需要登录' })}
        footer={null}
        maskClosable={false}
      >
        <Flexbox gap={16} padding={16}>
          <div>{t('loginRequiredDesc', { defaultValue: '请登录以使用全部功能' })}</div>
          <Button type="primary" block onClick={handleLogin}>
            {t('loginNow', { defaultValue: '立即登录' })}
          </Button>
        </Flexbox>
      </Modal>
    </>
  );
});

export default LoginOverlay;
