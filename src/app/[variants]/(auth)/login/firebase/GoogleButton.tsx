'use client';

import { Button } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { loginWithGoogle } from '@/libs/firebase/auth';

// 内联 Google 图标组件，避免路径导入问题
const GoogleIcon = () => (
  <svg height="1em" style={{ marginRight: 8 }} viewBox="0 0 48 48" width="1em">
    <path
      d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"
      fill="#4285F4"
    />
    <path d="M3.9 13.9l7.4 5.4c2-4.2 6.3-7.2 11.2-7.2 3.1 0 5.9 1.1 8.1 2.9L37 8.7C34.6 4.1 29.6 2 24 2 15.5 2 8.2 6.7 3.9 13.9z" fill="#EA4335" />
    <path d="M24 48c5.6 0 10.6-2.1 14-5.6l-6.5-5.5c-2.1 1.4-4.8 2.2-7.6 2.2-6.1 0-11.3-4.1-13.1-9.6l-6.8 5.2C7.8 42.8 15.4 48 24 48z" fill="#34A853" />
    <path d="M3.9 34.7C3.2 33 2.8 31 2.8 29c0-2 .4-4 1.1-5.9l-7-5.2C3.1 7.2 4.6 3.3 6.5 0L3.9 34.7z" fill="#FBBC05" />
  </svg>
);

interface GoogleButtonProps {
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

const GoogleButton = ({ onSuccess, onError }: GoogleButtonProps) => {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      await loginWithGoogle();
      onSuccess?.();
      router.push('/');
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button block icon={<GoogleIcon />} loading={loading} onClick={handleGoogleLogin}>
      {t('loginWithGoogle')}
    </Button>
  );
};

export default GoogleButton;
