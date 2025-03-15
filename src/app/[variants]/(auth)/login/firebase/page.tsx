'use client';

import { Alert, Button, Divider, Form, Input, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import { BRANDING_SITE } from '@/const/branding';
import { loginUser } from '@/libs/firebase/auth';

import GoogleButton from './GoogleButton';

const { Text, Title } = Typography;

const FirebaseLogin = () => {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      setLoading(true);
      setError(null);
      
      await loginUser(values.email, values.password);
      
      // 登录成功后跳转到主页
      router.push('/');
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    router.push('/signup/firebase');
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const handleGoogleError = (error: Error) => {
    setError(error.message);
  };

  return (
    <Center padding={24} style={{ minHeight: '100vh' }}>
      <Flexbox style={{ maxWidth: 400, width: '100%' }}>
        <Title level={2} style={{ margin: '0 0 24px', textAlign: 'center' }}>
          {t('login')}
        </Title>
        
        {error && (
          <Alert
            message={error}
            showIcon
            style={{ marginBottom: 24 }}
            type="error"
          />
        )}
        
        <Form layout="vertical" name="loginForm" onFinish={onFinish}>
          <Form.Item
            label={t('email')}
            name="email"
            rules={[
              { message: t('emailRequired'), required: true },
              { message: t('emailInvalid'), type: 'email' },
            ]}
          >
            <Input placeholder={t('emailPlaceholder')} size="large" />
          </Form.Item>
          
          <Form.Item
            label={t('password')}
            name="password"
            rules={[{ message: t('passwordRequired'), required: true }]}
          >
            <Input.Password placeholder={t('passwordPlaceholder')} size="large" />
          </Form.Item>
          
          <Form.Item>
            <Button block htmlType="submit" loading={loading} size="large" type="primary">
              {t('loginButton')}
            </Button>
          </Form.Item>
          
          <Form.Item>
            <Flexbox align="center" gap={8} horizontal justify="space-between">
              <Button onClick={handleSignUp} type="link">
                {t('signup')}
              </Button>
              <Button onClick={handleForgotPassword} type="link">
                {t('forgotPassword')}
              </Button>
            </Flexbox>
          </Form.Item>
        </Form>

        <Divider>{t('orContinueWith')}</Divider>
        
        <GoogleButton onError={handleGoogleError} />
        
        <Flexbox align="center" gap={8} style={{ marginTop: 24 }}>
          <Text type="secondary">
            {t('poweredBy')} <a href={BRANDING_SITE} rel="noreferrer" target="_blank">{t('brandName')}</a>
          </Text>
        </Flexbox>
      </Flexbox>
    </Center>
  );
};

export default FirebaseLogin;
